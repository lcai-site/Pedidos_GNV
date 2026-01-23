import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Moon, Sun, Monitor, Shield } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

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
          <p className="text-sm text-slate-500 mt-1">Escolha como a aplicação é exibida para você.</p>
        </div>
        
        <div className="p-6">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className={`p-3 rounded-full ${theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-yellow-100 text-yellow-600'}`}>
                    {theme === 'dark' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
                 </div>
                 <div>
                    <p className="font-medium text-slate-900 dark:text-slate-200">Tema Atual: {theme === 'dark' ? 'Escuro' : 'Claro'}</p>
                    <p className="text-sm text-slate-500">Alterne entre o modo claro e escuro para melhor visibilidade.</p>
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
          <p className="text-sm text-slate-500 mt-1">Configurações de conta e senha (Em breve).</p>
        </div>
        <div className="p-6 text-center text-slate-500 text-sm">
           Gerenciado pelo Administrador do Sistema.
        </div>
      </div>
    </div>
  );
};