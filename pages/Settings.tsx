import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Moon, Sun, Monitor, Shield, Smartphone, Wifi, WifiOff, QrCode, Loader2, Save, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { useZAPIConfig, useSaveZAPIConfig, useZAPIQRCode, useZAPIStatus, useZAPIDisconnect } from '../lib/hooks/useZAPIConfig';
import { useAuth } from '../lib/contexts/AuthContext';
import { toast } from 'sonner';

// ============================================
// COMPONENTE Z-API CONFIG (Sugestão 3)
// ============================================
const ZAPIConfigSection: React.FC = () => {
  const { data: config, isLoading } = useZAPIConfig();
  const saveConfig = useSaveZAPIConfig();
  const generateQR = useZAPIQRCode();
  const checkStatus = useZAPIStatus();
  const disconnect = useZAPIDisconnect();

  const [showTokens, setShowTokens] = useState(false);
  const [formData, setFormData] = useState({
    instance_id: '',
    token: '',
    client_token: '',
    nome_instancia: 'Principal',
  });
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('disconnected');

  // Preencher form com dados existentes
  useEffect(() => {
    if (config) {
      setFormData({
        instance_id: config.instance_id || '',
        token: config.token || '',
        client_token: config.client_token || '',
        nome_instancia: config.nome_instancia || 'Principal',
      });
      setConnectionStatus(config.status === 'connected' ? 'connected' : 'disconnected');
    }
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.instance_id.trim() || !formData.token.trim()) {
      toast.error('Instance ID e Token são obrigatórios');
      return;
    }
    await saveConfig.mutateAsync(formData);
  };

  const handleGenerateQR = async () => {
    if (!formData.instance_id || !formData.token) {
      toast.error('Salve as credenciais primeiro');
      return;
    }

    try {
      const result = await generateQR.mutateAsync({
        instanceId: formData.instance_id,
        token: formData.token,
        clientToken: formData.client_token || undefined,
      });

      if (result?.image) {
        // Imagem retornada como base64 via proxy
        setQrCodeData(result.image);
        toast.success('QR Code gerado! Escaneie com o WhatsApp');
      } else if (result?.connected) {
        setConnectionStatus('connected');
        setQrCodeData(null);
        toast.success('WhatsApp já está conectado!');
      } else {
        toast.error('Não foi possível gerar o QR Code');
      }
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleCheckStatus = async () => {
    if (!formData.instance_id || !formData.token) return;

    setConnectionStatus('checking');
    try {
      const result = await checkStatus.mutateAsync({
        instanceId: formData.instance_id,
        token: formData.token,
        clientToken: formData.client_token || undefined,
      });

      setConnectionStatus(result.connected ? 'connected' : 'disconnected');

      if (result.connected) {
        setQrCodeData(null);
        toast.success('WhatsApp conectado!');
      } else {
        toast.info('WhatsApp não está conectado');
      }
    } catch {
      setConnectionStatus('disconnected');
      toast.error('Não foi possível verificar o status. Verifique suas credenciais.');
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Deseja desconectar o WhatsApp?')) return;

    await disconnect.mutateAsync({
      instanceId: formData.instance_id,
      token: formData.token,
      clientToken: formData.client_token || undefined,
    });
    setConnectionStatus('disconnected');
    setQrCodeData(null);
  };

  if (isLoading) {
    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm p-6">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando configuração Z-API...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-emerald-500" />
          WhatsApp Z-API
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Conecte sua instância WhatsApp para integrar com o CRM.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Status da conexão */}
        <div className={`flex items-center justify-between p-4 rounded-xl border ${
          connectionStatus === 'connected'
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : connectionStatus === 'checking'
            ? 'bg-amber-500/5 border-amber-500/20'
            : 'bg-slate-800/50 border-slate-700'
        }`}>
          <div className="flex items-center gap-3">
            {connectionStatus === 'connected' ? (
              <>
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <div>
                  <p className="font-medium text-emerald-300">Conectado</p>
                  <p className="text-xs text-emerald-400/60">
                    {config?.phone_connected || 'WhatsApp ativo'}
                  </p>
                </div>
              </>
            ) : connectionStatus === 'checking' ? (
              <>
                <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                <p className="font-medium text-amber-300">Verificando...</p>
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6 text-slate-500" />
                <div>
                  <p className="font-medium text-slate-400">Desconectado</p>
                  <p className="text-xs text-slate-500">Configure abaixo e gere o QR Code</p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' && (
              <button
                onClick={handleDisconnect}
                disabled={disconnect.isPending}
                className="px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
              >
                Desconectar
              </button>
            )}
            <button
              onClick={handleCheckStatus}
              disabled={!formData.instance_id || !formData.token || checkStatus.isPending}
              className="px-3 py-1.5 text-xs text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-30"
            >
              Verificar Status
            </button>
          </div>
        </div>

        {/* Formulário de credenciais */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Nome da Instância
              </label>
              <input
                type="text"
                value={formData.nome_instancia}
                onChange={(e) => setFormData({ ...formData, nome_instancia: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 text-sm"
                placeholder="Ex: Atendimento Principal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Instance ID *
              </label>
              <input
                type="text"
                value={formData.instance_id}
                onChange={(e) => setFormData({ ...formData, instance_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 text-sm"
                placeholder="Cole o Instance ID da Z-API"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Token *
              </label>
              <div className="relative">
                <input
                  type={showTokens ? 'text' : 'password'}
                  value={formData.token}
                  onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                  className="w-full px-3 py-2 pr-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 text-sm"
                  placeholder="Cole o Token"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowTokens(!showTokens)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showTokens ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Client Token *
              </label>
              <input
                type={showTokens ? 'text' : 'password'}
                value={formData.client_token}
                onChange={(e) => setFormData({ ...formData, client_token: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 text-sm"
                placeholder="Z-API → Minha conta → Segurança"
                required
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saveConfig.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saveConfig.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar Credenciais
            </button>

            <button
              type="button"
              onClick={handleGenerateQR}
              disabled={!formData.instance_id || !formData.token || generateQR.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {generateQR.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
              {generateQR.isPending ? 'Gerando...' : 'Gerar QR Code'}
            </button>
          </div>
        </form>

        {/* QR Code Display */}
        {qrCodeData && (
          <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-medium text-slate-600">Escaneie com o WhatsApp</h4>
            <div className="p-4 bg-white rounded-lg">
              <img
                src={qrCodeData}
                alt="QR Code WhatsApp"
                className="w-64 h-64 object-contain"
              />
            </div>
            <p className="text-xs text-slate-400 text-center max-w-sm">
              Abra o WhatsApp no celular → Configurações → Aparelhos conectados → Conectar aparelho
            </p>
            <button
              onClick={handleCheckStatus}
              className="text-sm text-blue-500 hover:text-blue-400 underline"
            >
              Já escaneei, verificar conexão
            </button>
          </div>
        )}

        {/* Info box */}
        <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
          <p className="text-xs text-blue-300/70">
            💡 Para obter suas credenciais, acesse{' '}
            <a
              href="https://z-api.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline"
            >
              z-api.io
            </a>
            {' '}→ Minha conta → Instâncias. Cada instância corresponde a um número de WhatsApp.
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================================
// PÁGINA PRINCIPAL DE CONFIGURAÇÕES
// ============================================
export const SettingsPage: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { can } = useAuth();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Configurações</h2>
        <p className="text-slate-500 dark:text-slate-400">Gerencie suas preferências de visualização e conta.</p>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-blue-500" />
            Aparência
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Escolha como a aplicação é exibida para você.</p>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-yellow-100 text-yellow-600'}`}>
                {theme === 'dark' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-200">Tema Atual: {theme === 'dark' ? 'Escuro' : 'Claro'}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Alterne entre o modo claro e escuro para melhor visibilidade.</p>
              </div>
            </div>

            <button
              onClick={toggleTheme}
              className={`
                  relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2
                  ${theme === 'dark' ? 'bg-blue-600' : 'bg-slate-300'}
                `}
            >
              <span className="sr-only">Toggle Theme</span>
              <span
                aria-hidden="true"
                className={`
                    pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out
                    ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}
                  `}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm opacity-60">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-500" />
            Segurança
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configurações de conta e senha (Em breve).</p>
        </div>
        <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
          Gerenciado pelo Administrador do Sistema.
        </div>
      </div>

      {/* Z-API WhatsApp Config — Sugestão 3 (apenas adm) */}
      {can('settings:edit') && <ZAPIConfigSection />}

    </div>
  );
};