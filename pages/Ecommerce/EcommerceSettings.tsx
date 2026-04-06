import React from 'react';
import { Save, Store, CreditCard, Truck, Bell } from 'lucide-react';
import { EcommercePageHeader } from '../../components/ecommerce/layout/EcommercePageHeader';

interface SettingsSectionProps {
  icon: React.FC<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ icon: Icon, title, description, children }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
    <div className="p-5 border-b border-slate-800">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-400">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-200">{title}</h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
    </div>
    <div className="p-5 space-y-4">
      {children}
    </div>
  </div>
);

interface FieldProps {
  label: string;
  placeholder: string;
  type?: string;
  value?: string;
  disabled?: boolean;
}

const Field: React.FC<FieldProps> = ({ label, placeholder, type = 'text', value = '', disabled = false }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
      {label}
    </label>
    <input
      type={type}
      placeholder={placeholder}
      defaultValue={value}
      disabled={disabled}
      className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#a3e635]/40 focus:ring-1 focus:ring-[#a3e635]/20 transition-colors disabled:opacity-50"
    />
  </div>
);

interface ToggleProps {
  label: string;
  description: string;
  checked?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({ label, description, checked = false }) => (
  <div className="flex items-center justify-between py-2">
    <div>
      <p className="text-sm font-medium text-slate-200">{label}</p>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
    <button
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
        checked ? 'bg-[#a3e635]' : 'bg-slate-700'
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

export const EcommerceSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <EcommercePageHeader
        title="Configurações"
        description="Configure as preferências da sua loja online."
        actionLabel="Salvar"
        actionIcon={Save}
        onAction={() => {}}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store Info */}
        <SettingsSection
          icon={Store}
          title="Informações da Loja"
          description="Dados básicos da sua loja"
        >
          <Field label="Nome da Loja" placeholder="Ex: Minha Loja" />
          <Field label="E-mail de Contato" placeholder="contato@minhaloja.com" type="email" />
          <Field label="Telefone" placeholder="(11) 99999-9999" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Moeda" placeholder="BRL" value="BRL" disabled />
            <Field label="Timezone" placeholder="America/Sao_Paulo" value="America/Sao_Paulo" disabled />
          </div>
        </SettingsSection>

        {/* Payments */}
        <SettingsSection
          icon={CreditCard}
          title="Pagamentos"
          description="Métodos de pagamento aceitos"
        >
          <Toggle label="PIX" description="Aceitar pagamentos via PIX" checked />
          <Toggle label="Cartão de Crédito" description="Aceitar cartões de crédito" checked />
          <Toggle label="Boleto Bancário" description="Aceitar boleto bancário" />
          <div className="pt-3 border-t border-slate-800">
            <div className="flex gap-2">
              {['Sandbox', 'Produção'].map((env) => (
                <button
                  key={env}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                    env === 'Sandbox'
                      ? 'border-amber-500/40 text-amber-400 bg-amber-500/5'
                      : 'border-slate-700 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {env}
                </button>
              ))}
            </div>
          </div>
        </SettingsSection>

        {/* Shipping */}
        <SettingsSection
          icon={Truck}
          title="Frete"
          description="Configurações de envio"
        >
          <Toggle label="Correios" description="Calcular frete automaticamente via Correios" checked />
          <Field label="CEP de Origem" placeholder="00000-000" />
          <Field label="Prazo de Despacho (dias)" placeholder="2" type="number" />
          <Field label="Frete Grátis acima de (R$)" placeholder="200" type="number" />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection
          icon={Bell}
          title="Notificações"
          description="Alertas e comunicações automáticas"
        >
          <Toggle label="E-mail: Novo Pedido" description="Receber e-mail quando houver um novo pedido" checked />
          <Toggle label="E-mail: Envio" description="Notificar cliente por e-mail quando enviar" checked />
          <Toggle label="WhatsApp: Novo Pedido" description="Notificar via WhatsApp em novos pedidos" />
          <Toggle label="WhatsApp: Envio" description="Notificar cliente via WhatsApp ao enviar" />
        </SettingsSection>
      </div>
    </div>
  );
};
