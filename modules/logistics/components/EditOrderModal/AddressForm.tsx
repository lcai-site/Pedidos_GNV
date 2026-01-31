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
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                <MapPin className="w-4 h-4" />
                Endereço
            </div>

            {/* CEP */}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    CEP *
                </label>
                <input
                    type="text"
                    value={form.cep}
                    onChange={(e) => onChange('cep', e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white ${errors.cep ? 'border-red-500' : 'border-slate-300'
                        }`}
                />
                {errors.cep && (
                    <p className="text-xs text-red-500 mt-1">{errors.cep}</p>
                )}
            </div>

            {/* Logradouro */}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Logradouro *
                </label>
                <input
                    type="text"
                    value={form.logradouro}
                    onChange={(e) => onChange('logradouro', e.target.value)}
                    placeholder="Rua, Avenida, etc."
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white ${errors.logradouro ? 'border-red-500' : 'border-slate-300'
                        }`}
                />
                {errors.logradouro && (
                    <p className="text-xs text-red-500 mt-1">{errors.logradouro}</p>
                )}
            </div>

            {/* Número e Complemento */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Número *
                    </label>
                    <input
                        type="text"
                        value={form.numero}
                        onChange={(e) => onChange('numero', e.target.value)}
                        placeholder="123"
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white ${errors.numero ? 'border-red-500' : 'border-slate-300'
                            }`}
                    />
                    {errors.numero && (
                        <p className="text-xs text-red-500 mt-1">{errors.numero}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Complemento
                    </label>
                    <input
                        type="text"
                        value={form.complemento}
                        onChange={(e) => onChange('complemento', e.target.value)}
                        placeholder="Apto, Bloco, etc."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                </div>
            </div>

            {/* Bairro */}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Bairro *
                </label>
                <input
                    type="text"
                    value={form.bairro}
                    onChange={(e) => onChange('bairro', e.target.value)}
                    placeholder="Centro, Jardim, etc."
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white ${errors.bairro ? 'border-red-500' : 'border-slate-300'
                        }`}
                />
                {errors.bairro && (
                    <p className="text-xs text-red-500 mt-1">{errors.bairro}</p>
                )}
            </div>

            {/* Cidade e Estado */}
            <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Cidade *
                    </label>
                    <input
                        type="text"
                        value={form.cidade}
                        onChange={(e) => onChange('cidade', e.target.value)}
                        placeholder="São Paulo"
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white ${errors.cidade ? 'border-red-500' : 'border-slate-300'
                            }`}
                    />
                    {errors.cidade && (
                        <p className="text-xs text-red-500 mt-1">{errors.cidade}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        UF *
                    </label>
                    <input
                        type="text"
                        value={form.estado}
                        onChange={(e) => onChange('estado', e.target.value.toUpperCase())}
                        placeholder="SP"
                        maxLength={2}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white uppercase ${errors.estado ? 'border-red-500' : 'border-slate-300'
                            }`}
                    />
                    {errors.estado && (
                        <p className="text-xs text-red-500 mt-1">{errors.estado}</p>
                    )}
                </div>
            </div>
        </div>
    );
};
