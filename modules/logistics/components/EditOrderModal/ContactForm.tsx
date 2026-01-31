// ================================================================
// CONTACT FORM COMPONENT
// ================================================================
// Formulário de contato para edição de pedidos

import React from 'react';
import { User, Phone, Mail, FileText } from 'lucide-react';
import { EditOrderForm, ValidationErrors } from '../../types/logistics.types';

interface ContactFormProps {
    form: EditOrderForm;
    errors: ValidationErrors;
    onChange: (field: keyof EditOrderForm, value: string) => void;
}

export const ContactForm: React.FC<ContactFormProps> = ({ form, errors, onChange }) => {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                <User className="w-4 h-4" />
                Dados do Cliente
            </div>

            {/* Nome */}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nome Completo *
                </label>
                <input
                    type="text"
                    value={form.nome}
                    onChange={(e) => onChange('nome', e.target.value)}
                    placeholder="João da Silva"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white ${errors.nome ? 'border-red-500' : 'border-slate-300'
                        }`}
                />
                {errors.nome && (
                    <p className="text-xs text-red-500 mt-1">{errors.nome}</p>
                )}
            </div>

            {/* CPF */}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    CPF *
                </label>
                <input
                    type="text"
                    value={form.cpf}
                    onChange={(e) => onChange('cpf', e.target.value)}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white ${errors.cpf ? 'border-red-500' : 'border-slate-300'
                        }`}
                />
                {errors.cpf && (
                    <p className="text-xs text-red-500 mt-1">{errors.cpf}</p>
                )}
            </div>

            {/* Telefone */}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    Telefone
                </label>
                <input
                    type="text"
                    value={form.telefone}
                    onChange={(e) => onChange('telefone', e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
            </div>

            {/* Email */}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    Email
                </label>
                <input
                    type="email"
                    value={form.email}
                    onChange={(e) => onChange('email', e.target.value)}
                    placeholder="cliente@email.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
            </div>

            {/* Observação */}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Observação
                </label>
                <textarea
                    value={form.observacao}
                    onChange={(e) => onChange('observacao', e.target.value)}
                    placeholder="Observações sobre o pedido..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white resize-none"
                />
            </div>
        </div>
    );
};
