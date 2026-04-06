import { supabase } from '../supabase';
import { logger } from '../utils/logger';

export interface ZApiConfig {
  instanceId: string;
  instanceToken: string;
  apiToken: string;
  baseUrl?: string;
}

export interface SendMessageParams {
  phone: string;
  message: string;
  mediaUrl?: string;
  delay?: number;
}

export interface MessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  zaapiMessageId?: string;
}

// Buscar configuração do Z-API
export async function getZApiConfig(): Promise<ZApiConfig | null> {
  const { data, error } = await supabase
    .from('crm_config_zapi')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    logger.error('Erro ao buscar config Z-API', error, { service: 'ZApiService', action: 'getZApiConfig' });
    return null;
  }

  return {
    instanceId: data.instance_id,
    instanceToken: data.instance_token,
    apiToken: data.api_token,
    baseUrl: `https://api.z-api.io/instances/${data.instance_id}/token/${data.instance_token}`
  };
}

// Salvar configuração
export async function saveZApiConfig(config: Omit<ZApiConfig, 'baseUrl'>): Promise<boolean> {
  const { error } = await supabase
    .from('crm_config_zapi')
    .upsert({
      instance_id: config.instanceId,
      instance_token: config.instanceToken,
      api_token: config.apiToken,
      updated_at: new Date().toISOString()
    });

  if (error) {
    logger.error('Erro ao salvar config Z-API', error, { service: 'ZApiService', action: 'saveZApiConfig' });
    return false;
  }

  return true;
}

// Enviar mensagem via Z-API
export async function sendWhatsAppMessage(
  config: ZApiConfig,
  params: SendMessageParams
): Promise<MessageResponse> {
  try {
    const phone = params.phone.replace(/\D/g, '');
    const url = `${config.baseUrl}/send-text`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': config.apiToken
      },
      body: JSON.stringify({
        phone: phone,
        message: params.message,
        delayMessage: params.delay || 0,
        delayTyping: params.delay ? Math.min(params.delay * 1000, 5000) : 0
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Erro ao enviar mensagem'
      };
    }

    return {
      success: true,
      messageId: data.messageId || data.zaapId,
      zaapiMessageId: data.zaapId
    };
  } catch (error: any) {
    logger.apiError('ZApiService', 'sendWhatsAppMessage', error, { phone: params.phone });
    return {
      success: false,
      error: error.message || 'Erro de conexão'
    };
  }
}

// Enviar mídia (imagem, vídeo, etc)
export async function sendWhatsAppMedia(
  config: ZApiConfig,
  params: SendMessageParams
): Promise<MessageResponse> {
  try {
    const phone = params.phone.replace(/\D/g, '');
    const url = `${config.baseUrl}/send-image`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': config.apiToken
      },
      body: JSON.stringify({
        phone: phone,
        image: params.mediaUrl,
        caption: params.message,
        delayMessage: params.delay || 0
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Erro ao enviar mídia'
      };
    }

    return {
      success: true,
      messageId: data.messageId || data.zaapId
    };
  } catch (error: any) {
    logger.apiError('ZApiService', 'sendWhatsAppMedia', error, { phone: params.phone, mediaUrl: params.mediaUrl });
    return {
      success: false,
      error: error.message || 'Erro de conexão'
    };
  }
}

// Verificar status da instância
export async function checkInstanceStatus(config: ZApiConfig): Promise<{
  connected: boolean;
  qrCode?: string;
  phone?: string;
}> {
  try {
    const url = `${config.baseUrl}/status`;

    const response = await fetch(url, {
      headers: {
        'Client-Token': config.apiToken
      }
    });

    const data = await response.json();

    return {
      connected: data.connected || false,
      qrCode: data.qrcode,
      phone: data.phone
    };
  } catch (error) {
    logger.apiError('ZApiService', 'checkInstanceStatus', error, { instanceId: config.instanceId });
    return { connected: false };
  }
}

// Desconectar instância
export async function disconnectInstance(config: ZApiConfig): Promise<boolean> {
  try {
    const url = `${config.baseUrl}/disconnect`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Client-Token': config.apiToken
      }
    });

    return response.ok;
  } catch (error) {
    logger.apiError('ZApiService', 'disconnectInstance', error, { instanceId: config.instanceId });
    return false;
  }
}

// Gerar QR Code para conexão
export async function generateQRCode(config: ZApiConfig): Promise<string | null> {
  try {
    const url = `${config.baseUrl}/qr-code`;

    const response = await fetch(url, {
      headers: {
        'Client-Token': config.apiToken
      }
    });

    if (!response.ok) return null;

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    logger.apiError('ZApiService', 'generateQRCode', error, { instanceId: config.instanceId });
    return null;
  }
}
