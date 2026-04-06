// ================================================================
// ADDRESS FORM COMPONENT
// ================================================================
// Formulário de endereço para edição de pedidos

import React from 'react';
import { MapPin } from 'lucide-react';
import { EditOrderForm, ValidationErrors } from '../../types/logistics.types';

interface AddressFormProps {
    form: EditOrderForm;
    errors: ValidationErrors;
    onChange: (field: keyof EditOrderForm, value: string) => void;
}

export const AddressForm: React.FC<AddressFormProps> = ({ form, errors, onChange }) => {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-widest uppercase text-[#22d3ee] mb-3 bg-[#22d3ee]/10 p-2 border border-[#22d3ee]/20">
                <MapPin className="w-3.5 h-3.5" />
                ENDEREÇO DE ENTREGA
            </div>

            {/* CEP */}
            <div>
                <label className="block text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-1">
                    CEP *
                </label>
                <input
                    type="text"
                    value={form.cep}
                    onChange={(e) => onChange('cep', e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className={`w-full px-3 py-2 bg-[#020617] border text-xs font-mono font-bold uppercase tracking-widest text-slate-200 focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] rounded-none transition-colors ${errors.cep ? 'border-[#ef4444] shadow-[inset_0_0_8px_rgba(239,68,68,0.2)]' : 'border-slate-800'
                        }`}
                />
                {errors.cep && (
                    <p className="text-[9px] font-mono uppercase tracking-widest text-[#ef4444] mt-1 bg-[#ef4444]/10 p-1">:: {errors.cep}</p>
                )}
            </div>

            {/* Logradouro */}
            <div>
                <label className="block text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-1">
                    LOGRADOURO (RUA/AVENIDA) *
                </label>
                <input
                    type="text"
                    value={form.logradouro}
                    onChange={(e) => onChange('logradouro', e.target.value)}
                    placeholder="Ex: Rua das Flores"
                    className={`w-full px-3 py-2 bg-[#020617] border text-xs font-mono font-bold uppercase tracking-widest text-slate-200 focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] rounded-none transition-colors ${errors.logradouro ? 'border-[#ef4444] shadow-[inset_0_0_8px_rgba(239,68,68,0.2)]' : 'border-slate-800'
                        }`}
                />
                {errors.logradouro && (
                    <p className="text-[9px] font-mono uppercase tracking-widest text-[#ef4444] mt-1 bg-[#ef4444]/10 p-1">:: {errors.logradouro}</p>
                )}
            </div>

            {/* Número */}
            <div>
                <label className="block text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-1">
                    NÚMERO *
                </label>
                <input
                    type="text"
                    value={form.numero}
                    onChange={(e) => onChange('numero', e.target.value)}
                    placeholder="S/N ou Nº"
                    className={`w-full px-3 py-2 bg-[#020617] border text-xs font-mono font-bold uppercase tracking-widest text-slate-200 focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] rounded-none transition-colors ${errors.numero ? 'border-[#ef4444] shadow-[inset_0_0_8px_rgba(239,68,68,0.2)]' : 'border-slate-800'
                        }`}
                />
                {errors.numero && (
                    <p className="text-[9px] font-mono uppercase tracking-widest text-[#ef4444] mt-1 bg-[#ef4444]/10 p-1">:: {errors.numero}</p>
                )}
            </div>

            {/* Complemento — linha própria, largura total */}
            <div>
                <label className="block text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-1">
                    COMPLEMENTO (OPCIONAL)
                </label>
                <input
                    type="text"
                    value={form.complemento}
                    onChange={(e) => onChange('complemento', e.target.value)}
                    placeholder="Ex: Apto 101, Casa A"
                    className="w-full px-3 py-2 bg-[#020617] border border-slate-800 text-xs font-mono font-bold uppercase tracking-widest text-slate-200 focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] rounded-none transition-colors"
                />
            </div>

            {/* Bairro */}
            <div>
                <label className="block text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-1">
                    BAIRRO *
                </label>
                <input
                    type="text"
                    value={form.bairro}
                    onChange={(e) => onChange('bairro', e.target.value)}
                    placeholder="Bairro"
                    className={`w-full px-3 py-2 bg-[#020617] border text-xs font-mono font-bold uppercase tracking-widest text-slate-200 focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] rounded-none transition-colors ${errors.bairro ? 'border-[#ef4444] shadow-[inset_0_0_8px_rgba(239,68,68,0.2)]' : 'border-slate-800'
                        }`}
                />
                {errors.bairro && (
                    <p className="text-[9px] font-mono uppercase tracking-widest text-[#ef4444] mt-1 bg-[#ef4444]/10 p-1">:: {errors.bairro}</p>
                )}
            </div>

            {/* Cidade e Estado */}
            <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                    <label className="block text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-1">
                        CIDADE *
                    </label>
                    <input
                        type="text"
                        value={form.cidade}
                        onChange={(e) => onChange('cidade', e.target.value)}
                        placeholder="Cidade"
                        className={`w-full px-3 py-2 bg-[#020617] border text-xs font-mono font-bold uppercase tracking-widest text-slate-200 focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] rounded-none transition-colors ${errors.cidade ? 'border-[#ef4444] shadow-[inset_0_0_8px_rgba(239,68,68,0.2)]' : 'border-slate-800'
                            }`}
                    />
                    {errors.cidade && (
                        <p className="text-[9px] font-mono uppercase tracking-widest text-[#ef4444] mt-1 bg-[#ef4444]/10 p-1">:: {errors.cidade}</p>
                    )}
                </div>

                <div>
                    <label className="block text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-1">
                        UF *
                    </label>
                    <input
                        type="text"
                        value={form.estado}
                        onChange={(e) => onChange('estado', e.target.value.toUpperCase())}
                        placeholder="UF"
                        maxLength={2}
                        className={`w-full px-3 py-2 bg-[#020617] border text-xs font-mono font-bold uppercase tracking-widest text-slate-200 focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] rounded-none transition-colors uppercase ${errors.estado ? 'border-[#ef4444] shadow-[inset_0_0_8px_rgba(239,68,68,0.2)]' : 'border-slate-800'
                            }`}
                    />
                    {errors.estado && (
                        <p className="text-[9px] font-mono uppercase tracking-widest text-[#ef4444] mt-1 bg-[#ef4444]/10 p-1">:: {errors.estado}</p>
                    )}
                </div>
            </div>
        </div>
    );
};
