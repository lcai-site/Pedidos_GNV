import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import { logger } from '../utils/logger';

export interface Usuario {
  id: string;
  email: string;
  nome_completo: string | null;
  role: 'atendente' | 'gestor' | 'adm';
  ativo: boolean;
  vendedora_nome: string | null;
  meta_mensal: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUsuarioDTO {
  email: string;
  nome_completo: string;
  role: 'atendente' | 'gestor' | 'adm';
  vendedora_nome?: string;
  meta_mensal?: number;
}

export interface UpdateUsuarioDTO {
  id: string;
  nome_completo?: string;
  role?: 'atendente' | 'gestor' | 'adm';
  ativo?: boolean;
  vendedora_nome?: string | null;
  meta_mensal?: number | null;
}

// Hook para listar todos os usuários
export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Usuario[];
    }
  });
}

// Hook para buscar um usuário específico
export function useUsuario(id: string | null) {
  return useQuery({
    queryKey: ['usuario', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Usuario;
    },
    enabled: !!id
  });
}

// Função auxiliar para obter descrição do cargo
function getRoleDescription(role: string): string {
  switch (role) {
    case 'adm':
      return 'Administrador - Acesso completo a todas as funcionalidades';
    case 'gestor':
      return 'Gestor - Pode gerenciar atendentes, visualizar relatórios e aprovar solicitações';
    case 'atendente':
      return 'Atendente - Acesso às funcionalidades operacionais do dia a dia';
    default:
      return 'Usuário do sistema';
  }
}

// Hook para criar novo usuário via CONVITE
export function useCreateUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateUsuarioDTO) => {
      // Gerar senha temporária aleatória
      const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);

      // 1. Criar usuário no Auth com senha temporária
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: dto.email,
        password: tempPassword,
        options: {
          data: {
            nome_completo: dto.nome_completo,
            role: dto.role,
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Erro ao criar usuário');

      // 2. Atualizar o profile criado automaticamente com os dados
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          nome_completo: dto.nome_completo,
          role: dto.role,
          vendedora_nome: dto.vendedora_nome || null,
          meta_mensal: dto.meta_mensal || null,
          ativo: true
        })
        .eq('id', authData.user.id);

      if (profileError) throw profileError;

      // 3. Enviar email de redefinição de senha (convite)
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(dto.email, {
        redirectTo: `${window.location.origin}/#/login`,
      });

      if (resetError) {
        logger.warn('Email de convite não enviado', {
          hook: 'useCreateUsuario',
          email: dto.email,
          message: resetError.message
        });
      }

      return { user: authData.user, role: dto.role };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      const roleLabel = data.role === 'adm' ? 'Administrador' : data.role === 'gestor' ? 'Gestor' : 'Atendente';
      toast.success(`Convite enviado! ${roleLabel} criado com sucesso.`);
    },
    onError: (error: any) => {
      toast.error('Erro ao criar usuário: ' + error.message);
    }
  });
}

// Hook para atualizar usuário
export function useUpdateUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: UpdateUsuarioDTO) => {
      const { id, ...updates } = dto;

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Usuário atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar usuário: ' + error.message);
    }
  });
}

// Hook para ativar/desativar usuário
export function useToggleUsuarioStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ativo })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success(vars.ativo ? 'Usuário ativado!' : 'Usuário desativado!');
    },
    onError: (error: any) => {
      toast.error('Erro: ' + error.message);
    }
  });
}

// Hook para reenviar convite (redefinição de senha)
export function useReenviarConvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/#/login`
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Convite reenviado! O usuário receberá um email para criar sua senha.');
    },
    onError: (error: any) => {
      toast.error('Erro ao reenviar convite: ' + error.message);
    }
  });
}

// Hook para redefinir senha do usuário
export function useResetPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/settings`
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Email de redefinição de senha enviado!');
    },
    onError: (error: any) => {
      toast.error('Erro: ' + error.message);
    }
  });
}
