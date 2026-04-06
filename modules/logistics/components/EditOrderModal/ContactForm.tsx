// ================================================================
// CONTACT FORM COMPONENT
// ================================================================
// Formulário de contato para edição de pedidos

import React from 'react';
import { User, Phone, Mail, FileText } from 'lucide-react';
import { EditOrderForm, ValidationErrors } from '../../types/logistics.types';
import { getCpfWarning } from '../../services/orderValidationService';

interface ContactFormProps {
    form: EditOrderForm;
    errors: ValidationErrors;
    onChange: (field: keyof EditOrderForm, value: string) => void;
}

export const ContactForm: React.FC<ContactFormProps> = ({ form, errors, onChange }) => {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-widest uppercase text-[#22d3ee] mb-3 bg-[#22d3ee]/10 p-2 border border-[#22d3ee]/20">
                <User className="w-3.5 h-3.5" />
                DADOS DO CLIENTE
            </div>

            <div>
                <label className="block text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-1">
                    NOME COMPLETO *
                </label>
                <input
                    type="text"
                    value={form.nome}
                    onChange={(e) => onChange('nome', e.target.value)}
                    placeholder="Ex: Maria da Silva"
                    className={`w-full px-3 py-2 bg-[#020617] border text-xs font-mono font-bold uppercase tracking-widest text-slate-200 focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] rounded-none transition-colors ${errors.nome ? 'border-[#ef4444] shadow-[inset_0_0_8px_rgba(239,68,68,0.2)]' : 'border-slate-800'
                        }`}
                />
                {errors.nome && (
                    <p className="text-[9px] font-mono text-[#ef4444] uppercase tracking-widest mt-1 bg-[#ef4444]/10 p-1">:: {errors.nome}</p>
                )}
            </div>

            {/* CPF */}
            <div>
                <label className="block text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-1">
                    CPF *
                </label>
                <input
                    type="text"
                    value={form.cpf}
                    onChange={(e) => onChange('cpf', e.target.value)}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={`w-full px-3 py-2 bg-[#020617] border text-xs font-mono font-bold uppercase tracking-widest text-slate-200 focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] rounded-none transition-colors ${getCpfWarning(form.cpf) ? 'border-[#fb923c] shadow-[inset_0_0_8px_rgba(251,146,60,0.2)]' : 'border-slate-800'
                        }`}
                />
                {getCpfWarning(form.cpf) && (
                    <p className="text-[9px] font-mono uppercase tracking-widest text-[#fb923c] mt-1 bg-[#fb923c]/10 p-1">:: {getCpfWarning(form.cpf)}</p>
                )}
            </div>

            {/* Telefone */}
            <div>
                    TELEFONE
                <input
                    type="text"
                    value={form.telefone}
                    onChange={(e) => onChange('telefone', e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-2 bg-[#020617] border border-slate-800 text-xs font-mono font-bold uppercase tracking-widest text-slate-200 focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] rounded-none transition-colors"
                />
            </div>

            {/* Email */}
            <div>
                    E-MAIL
                <input
                    type="email"
                    value={form.email}
                    onChange={(e) => onChange('email', e.target.value)}
                    placeholder="exemplo@email.com"
                    className="w-full px-3 py-2 bg-[#020617] border border-slate-800 text-xs font-mono font-bold uppercase tracking-widest text-slate-200 focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] rounded-none transition-colors"
                />
            </div>

            {/* Observação */}
            <div>
                    OBSERVAÇÕES DO PEDIDO
                <textarea
                    value={form.observacao}
                    onChange={(e) => onChange('observacao', e.target.value)}
                    placeholder="Insira notas ou observações adicionais..."
                    rows={3}
                    className="w-full px-3 py-2 bg-[#020617] border border-slate-800 text-xs font-mono font-bold tracking-widest uppercase text-slate-200 focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] rounded-none transition-colors resize-none"
                />
            </div>
        </div>
    );
};
