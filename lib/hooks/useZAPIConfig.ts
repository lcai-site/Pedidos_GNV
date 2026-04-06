import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { toast } from 'sonner';

// ============================================
// TIPOS
// ============================================

export interface ZAPIConfig {
  id: string;
  instance_id: string;
  token: string;
  client_token: string;
  status: 'connected' | 'disconnected' | 'connecting';
  phone_connected: string | null;
  nome_instancia: string;
  updated_at: string;
  created_at: string;
}

export interface ZAPIStatus {
  connected: boolean;
  smartphoneConnected: boolean;
  session: string;
  webhookUrl?: string;
}

// ============================================
// HELPER: Chama Edge Function zapi-proxy
// Todas as chamadas à Z-API passam pelo proxy
// para evitar CORS do browser
// ============================================
async function callZAPIProxy(action: string, instanceId: string, token: string, clientToken?: string) {
  // Forçar refresh do token se expirado usando getUser()
  // getSession() retorna cache local que pode estar expirado
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  let accessToken = session?.access_token;

  // Se não tem sessão ou o token pode estar expirado, tentar refresh
  if (!accessToken || sessionError) {
    const { data: refreshData } = await supabase.auth.refreshSession();
    accessToken = refreshData?.session?.access_token;
  }

  if (!accessToken) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  // Invocar Edge Function com token explícito no header
  const { data, error } = await supabase.functions.invoke('zapi-proxy', {
    body: {
      action,
      instance_id: instanceId,
      token,
      client_token: clientToken || undefined,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) throw new Error(error.message || 'Erro ao conectar com o proxy Z-API');

  // A Edge Function sempre retorna 200, erros ficam em data.ok=false
  if (data && data.ok === false) {
    // Log de diagnóstico para debug
    if (data._debug) {
      console.error('[Z-API Debug]', JSON.stringify(data._debug, null, 2));
    }
    console.error('[Z-API Response]', JSON.stringify(data, null, 2));

    // Para qr-code-image, retornamos o data para o hook tratar o fallback
    if (action === 'qr-code-image') return data;
    // Para outros, lançamos erro com detalhes
    const debugInfo = data._debug ? ` [Instance: ${data._debug.instance_id_used}]` : '';
    throw new Error((data.error || `Erro na ação '${action}'`) + debugInfo);
  }

  return data;
}

// ============================================
// HOOKS
// ============================================

/**
 * Busca a configuração Z-API ativa
 */
export function useZAPIConfig() {
  return useQuery({
    queryKey: ['zapi-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zapi_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as ZAPIConfig | null;
    },
    staleTime: 30_000,
  });
}

/**
 * Salva ou atualiza configuração Z-API
 */
export function useSaveZAPIConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Partial<ZAPIConfig>) => {
      // Verificar se já existe config
      const { data: existing } = await supabase
        .from('zapi_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('zapi_config')
          .update({
            instance_id: config.instance_id,
            token: config.token,
            client_token: config.client_token,
            nome_instancia: config.nome_instancia,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('zapi_config')
          .insert({
            instance_id: config.instance_id,
            token: config.token,
            client_token: config.client_token,
            nome_instancia: config.nome_instancia || 'Principal',
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zapi-config'] });
      toast.success('Configuração Z-API salva!');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });
}

/**
 * Gera QR Code via Edge Function proxy (sem CORS)
 */
export function useZAPIQRCode() {
  return useMutation({
    mutationFn: async ({ instanceId, token, clientToken }: { instanceId: string; token: string; clientToken?: string }) => {
      const data = await callZAPIProxy('qr-code-image', instanceId, token, clientToken);

      // Se retornou erro da Z-API, mostrar diagnóstico
      if (data?.ok === false) {
        const debugInfo = data._debug
          ? `\n[Debug] Instance enviado: ${data._debug.instance_id_used} (${data._debug.instance_id_length} chars), Token: ${data._debug.token_length} chars`
          : '';
        console.error('[useZAPIQRCode] Z-API error:', data);
        throw new Error((data.error || 'Erro Z-API') + debugInfo);
      }

      // Se retornou imagem base64
      if (data?.image) {
        return { image: data.image };
      }

      // Se retornou JSON (pode indicar que já está conectado)
      if (data?.connected) {
        return { connected: true };
      }

      // Tentar endpoint JSON de QR Code como fallback
      const fallback = await callZAPIProxy('qr-code', instanceId, token, clientToken);
      if (fallback?.value) {
        return { qrValue: fallback.value };
      }

      throw new Error(data?.error || 'Não foi possível gerar o QR Code');
    },
    onError: (error: any) => {
      toast.error('Erro ao gerar QR Code: ' + error.message);
    },
  });
}

/**
 * Verifica status da conexão WhatsApp via proxy
 */
export function useZAPIStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ instanceId, token, clientToken }: { instanceId: string; token: string; clientToken?: string }) => {
      const data = await callZAPIProxy('status', instanceId, token, clientToken);

      // Atualizar status no banco
      const { data: config } = await supabase
        .from('zapi_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (config) {
        await supabase
          .from('zapi_config')
          .update({
            status: data.connected ? 'connected' : 'disconnected',
            phone_connected: data.smartphoneConnected ? data.session : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', config.id);

        queryClient.invalidateQueries({ queryKey: ['zapi-config'] });
      }

      return data as ZAPIStatus;
    },
  });
}

/**
 * Desconecta a instância Z-API via proxy
 */
export function useZAPIDisconnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ instanceId, token, clientToken }: { instanceId: string; token: string; clientToken?: string }) => {
      await callZAPIProxy('disconnect', instanceId, token, clientToken);

      // Atualizar status no banco
      const { data: config } = await supabase
        .from('zapi_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (config) {
        await supabase
          .from('zapi_config')
          .update({
            status: 'disconnected',
            phone_connected: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', config.id);

        queryClient.invalidateQueries({ queryKey: ['zapi-config'] });
      }

      return true;
    },
    onSuccess: () => {
      toast.success('WhatsApp desconectado!');
    },
  });
}
