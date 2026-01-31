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
            title="Editar Pedido"
            size="lg"
        >
            <div className="space-y-6">
                {/* Alerta de Erros */}
                {hasErrors && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                                    Campos com erros
                                </h4>
                                <p className="text-xs text-red-600 dark:text-red-400">
                                    Por favor, corrija os campos marcados em vermelho antes de salvar.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Informações do Pedido */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-500 dark:text-slate-400">Código:</span>
                            <span className="ml-2 font-medium text-slate-700 dark:text-slate-300">
                                {order.codigo_transacao || order.id?.slice(0, 8)}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-500 dark:text-slate-400">Produto:</span>
                            <span className="ml-2 font-medium text-slate-700 dark:text-slate-300">
                                {order.descricao_pacote || 'N/D'}
                            </span>
                        </div>
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

                {/* Botões */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <X className="w-4 h-4 inline-block mr-1" />
                        Cancelar
                    </button>

                    <button
                        onClick={onSave}
                        disabled={saving || hasErrors}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Salvar Alterações
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
