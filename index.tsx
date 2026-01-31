import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { validateEnvironment, logEnvironmentInfo } from './lib/config/environment';
import { QueryProvider, ToastProvider } from './lib/providers';
import { initSentry } from './lib/services/sentry';

// Inicializar Sentry PRIMEIRO (antes de qualquer código que possa falhar)
initSentry();

// Validar configuração de ambiente
const { valid, errors } = validateEnvironment();
if (!valid) {
  console.error('❌ Erro de configuração de ambiente:');
  errors.forEach(error => console.error(`  - ${error}`));
  throw new Error('Configuração de ambiente inválida. Verifique os arquivos .env');
}

// Log de informações do ambiente (apenas em dev)
logEnvironmentInfo();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryProvider>
  </React.StrictMode>
);