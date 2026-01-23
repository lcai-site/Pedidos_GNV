import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Logistics } from './pages/Logistics';
import { Customers } from './pages/Customers';
import { Sales, Subscriptions, Recovery } from './pages/OtherPages';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/Settings';
import { DateFilterProvider } from './context/DateFilterContext';
import { ThemeProvider } from './context/ThemeContext';
import { supabase } from './lib/supabase';
import { Loader2 } from 'lucide-react';

// Componente para proteger rotas privadas
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verifica sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Ouve mudanças na autenticação (login, logout, refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="text-slate-500 text-sm">Carregando sistema...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <ThemeProvider>
      <DateFilterProvider>
        <HashRouter>
          <Routes>
            {/* Rota Pública */}
            <Route path="/login" element={<LoginPage />} />

            {/* Rotas Privadas */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="logistics" element={<Logistics />} />
              <Route path="sales" element={<Sales />} />
              <Route path="customers" element={<Customers />} />
              <Route path="subscriptions" element={<Subscriptions />} />
              <Route path="recovery" element={<Recovery />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </DateFilterProvider>
    </ThemeProvider>
  );
}

export default App;