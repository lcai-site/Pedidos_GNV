// ================================================================
// EDIT ORDER MODAL COMPONENT
// ================================================================
// Modal para edição de pedidos

import React from 'react';
import { Modal } from '../../../../components/ui/Modal';
import { Save, X, AlertCircle } from 'lucide-react';
import { AddressForm } from './AddressForm';
import { ContactForm } from './ContactForm';
import { EditOrderForm, ValidationErrors, PedidoUnificado } from '../../types/logistics.types';

interface EditOrderModalProps {
    isOpen: boolean;
    order: PedidoUnificado | null;
    form: EditOrderForm;
    errors: ValidationErrors;
    saving: boolean;
    onClose: () => void;
    onSave: () => void;
    onChange: (field: keyof EditOrderForm, value: string) => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
    isOpen,
    order,
    form,
    errors,
    saving,
    onClose,
    onSave,
    onChange
}) => {
    if (!order) return null;

    const hasErrors = Object.keys(errors).length > 0;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="EDITAR DADOS DO PEDIDO"
            size="lg"
        >
            <div className="space-y-6">
                {/* Alerta de Erros */}
                {/* Alerta de Erros CPU */}
                {hasErrors && (
                    <div className="bg-[#ef4444]/5 border border-[#ef4444]/40 p-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-[#ef4444] flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#ef4444] mb-1">
                                    ATENÇÃO: VERIFIQUE OS CAMPOS
                                </h4>
                                <p className="text-[10px] font-mono uppercase text-slate-400">
                                    Corrija os campos marcados em vermelho antes de salvar as alterações.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Informações do Pedido Terminal */}
                <div className="bg-[#0f172a] border border-slate-800 p-4 space-y-2">
                    <div className="text-xs font-mono uppercase tracking-widest flex items-center">
                        <span className="text-slate-500 w-24">CÓDIGO:</span>
                        <span className="font-bold text-[#a3e635] break-all">
                            {order.codigo_transacao || order.id?.slice(0, 8)}
                        </span>
                    </div>
                    <div className="text-xs font-mono uppercase tracking-widest flex items-center">
                        <span className="text-slate-500 w-24">PRODUTO:</span>
                        <span className="font-bold text-slate-200 pl-2 border-l border-slate-700 ml-2">
                            {order.descricao_pacote || order.nome_oferta || 'UNREGISTERED_DATA'}
                        </span>
                    </div>
                </div>

                {/* Formulários */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Dados do Cliente */}
                    <ContactForm
                        form={form}
                        errors={errors}
                        onChange={onChange}
                    />

                    {/* Endereço */}
                    <AddressForm
                        form={form}
                        errors={errors}
                        onChange={onChange}
                    />
                </div>

                {/* Botões Terminal */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 bg-[#020617]">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-5 py-2.5 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 border border-slate-800 hover:text-slate-300 hover:border-slate-500 disabled:opacity-50 transition-colors flex items-center justify-center min-w-[120px]"
                    >
                        CANCELAR
                    </button>

                    <button
                        onClick={onSave}
                        disabled={saving || hasErrors}
                        className="px-5 py-2.5 text-[10px] font-mono font-bold uppercase tracking-widest text-[#020617] bg-[#a3e635] hover:bg-[#84cc16] disabled:opacity-50 transition-colors flex items-center justify-center min-w-[180px] gap-2 shadow-[inset_0_1px_3px_rgba(255,255,255,0.3)]"
                    >
                        {saving ? (
                            <>
                                <div className="w-3.5 h-3.5 border border-[#020617] border-t-transparent animate-spin" />
                                SALVANDO...
                            </>
                        ) : (
                            <>
                                <Save className="w-3.5 h-3.5" />
                                SALVAR ALTERAÇÕES
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
