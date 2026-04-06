import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { PlusCircle, Loader2, Save, X } from 'lucide-react';
import { Modal } from './ui/Modal';
import { toast } from 'sonner';

interface BotaoCriarPedidoManualProps {
  onSuccess: () => void;
}

export function BotaoCriarPedidoManual({ onSuccess }: BotaoCriarPedidoManualProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Estados dos campos do formulário
  const [formData, setFormData] = useState({
    nome_cliente: '',
    cpf: '',
    telefone: '',
    email: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    produto_principal: '',
    descricao_pacote: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // 1. Validar campos básicos
      if (!formData.nome_cliente || !formData.cep || !formData.produto_principal) {
        throw new Error('Preencha os campos obrigatórios (Nome, CEP, Produto)');
      }

      // 2. Chamar RPC que cria o pedido na base
      const { data, error } = await supabase.rpc('criar_pedido_manual', {
        p_nome_cliente: formData.nome_cliente,
        p_cpf: formData.cpf,
        p_telefone: formData.telefone,
        p_email: formData.email,
        p_cep: formData.cep,
        p_logradouro: formData.logradouro,
        p_numero: formData.numero,
        p_complemento: formData.complemento,
        p_bairro: formData.bairro,
        p_cidade: formData.cidade,
        p_estado: formData.estado,
        p_produto_principal: formData.produto_principal,
        p_descricao_pacote: formData.descricao_pacote || formData.produto_principal,
      });

      if (error) throw error;
      if (data?.status === 'error') throw new Error(data.message);

      toast.success('Pedido manual criado com sucesso!');
      setIsOpen(false);
      setFormData({
        nome_cliente: '', cpf: '', telefone: '', email: '', cep: '',
        logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
        produto_principal: '', descricao_pacote: '',
      });
      onSuccess(); // Recarrega a listagem
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar pedido manual');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors border-none cursor-pointer"
        title="Criar Pedido Manual"
      >
        <PlusCircle className="w-4 h-4" />
        <span className="hidden sm:inline">Pedido Manual</span>
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Novo Pedido Manual" size="lg">
        <form onSubmit={handleCreate} className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-lg flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-emerald-500" /> Detalhes do Pedido (Reenvio/Influenciador)
            </h3>
            
            <div className="space-y-4 pt-2">
              <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Destinatário</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    name="nome_cliente"
                    value={formData.nome_cliente}
                    onChange={handleChange}
                    className="w-full bg-slate-100 dark:bg-[#1a1c23] border border-slate-300 dark:border-card text-foreground px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                    placeholder="Nome do cliente"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">CPF (apenas números)</label>
                  <input
                    type="text"
                    name="cpf"
                    value={formData.cpf}
                    onChange={handleChange}
                    className="w-full bg-slate-100 dark:bg-[#1a1c23] border border-slate-300 dark:border-card text-foreground px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    name="telefone"
                    value={formData.telefone}
                    onChange={handleChange}
                    className="w-full bg-slate-100 dark:bg-[#1a1c23] border border-slate-300 dark:border-card text-foreground px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                    placeholder="(11) 99999-9999"
                  />
                </div>
                 <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">E-mail</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-slate-100 dark:bg-[#1a1c23] border border-slate-300 dark:border-card text-foreground px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div className="h-px bg-slate-200 dark:bg-slate-700 my-4" />
              
              <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Endereço de Entrega</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">CEP *</label>
                  <input
                    type="text"
                    required
                    name="cep"
                    value={formData.cep}
                    onChange={handleChange}
                    className="w-full bg-slate-100 dark:bg-[#1a1c23] border border-slate-300 dark:border-card text-foreground px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                    placeholder="00000-000"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Logradouro (Rua, Av...) *</label>
                  <input
                    type="text"
                    required
                    name="logradouro"
                    value={formData.logradouro}
                    onChange={handleChange}
                    className="w-full bg-slate-100 dark:bg-[#1a1c23] border border-slate-300 dark:border-card text-foreground px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                    placeholder="Nome da rua"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Número *</label>
                  <input
                    type="text"
                    required
                    name="numero"
                    value={formData.numero}
                    onChange={handleChange}
                    className="w-full bg-slate-100 dark:bg-[#1a1c23] border border-slate-300 dark:border-card text-foreground px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                    placeholder="Ex: 123"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Bairro *</label>
                  <input
                    type="text"
                    required
                    name="bairro"
                    value={formData.bairro}
                    onChange={handleChange}
                    className="w-full bg-slate-100 dark:bg-[#1a1c23] border border-slate-300 dark:border-card text-foreground px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Complemento</label>
                  <input
                    type="text"
                    name="complemento"
                    value={formData.complemento}
                    onChange={handleChange}
                    className="w-full bg-slate-100 dark:bg-[#1a1c23] border border-slate-300 dark:border-card text-foreground px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                    placeholder="Apto, Sala..."
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Cidade *</label>
                  <input
                    type="text"
                    required
                    name="cidade"
                    value={formData.cidade}
                    onChange={handleChange}
                    className="w-full bg-slate-100 dark:bg-[#1a1c23] border border-slate-300 dark:border-card text-foreground px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Estado (UF) *</label>
                  <input
                    type="text"
                    required
                    name="estado"
                    value={formData.estado}
                    onChange={handleChange}
                    maxLength={2}
                    className="w-full bg-slate-100 dark:bg-[#1a1c23] border border-slate-300 dark:border-card text-foreground px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm uppercase"
                    placeholder="SP"
                  />
                </div>
              </div>

               <div className="h-px bg-slate-200 dark:bg-slate-700 my-4" />
              
              <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Produtos</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Produto (Nome visível na tela) *</label>
                  <input
                    type="text"
                    required
                    name="produto_principal"
                    value={formData.produto_principal}
                    onChange={handleChange}
                    className="w-full bg-slate-100 dark:bg-[#1a1c23] border border-slate-300 dark:border-card text-foreground px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                    placeholder="Ex: Desejo Proibido - Kit Influenciador"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Descrição do Pacote (Para Etiqueta) *</label>
                  <input
                    type="text"
                    required
                    name="descricao_pacote"
                    value={formData.descricao_pacote}
                    onChange={handleChange}
                    className="w-full bg-slate-100 dark:bg-[#1a1c23] border border-slate-300 dark:border-card text-foreground px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                    placeholder="Ex: DP - KIT REENVIO"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    É importante usar as siglas (DP, BF ou BL) para facilitar a geração da etiqueta!
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md shadow-sm transition-colors cursor-pointer"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</>
              ) : (
                <><Save className="w-4 h-4" /> Criar Pedido Manual</>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
