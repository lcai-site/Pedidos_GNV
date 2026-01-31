import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DateFilterProvider } from './context/DateFilterContext';
import { ThemeProvider } from './context/ThemeContext';
import { useAuth } from './lib/hooks/useAuth';
import { Loader2 } from 'lucide-react';

// Lazy loaded pages for better code splitting
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Logistics = lazy(() => import('./pages/Logistics').then(m => ({ default: m.Logistics })));
const Customers = lazy(() => import('./pages/Customers').then(m => ({ default: m.Customers })));
const Sales = lazy(() => import('./pages/OtherPages').then(m => ({ default: m.Sales })));
const Subscriptions = lazy(() => import('./pages/OtherPages').then(m => ({ default: m.Subscriptions })));
const Recovery = lazy(() => import('./pages/OtherPages').then(m => ({ default: m.Recovery })));
const SettingsPage = lazy(() => import('./pages/Settings').then(m => ({ default: m.SettingsPage })));
const SolicitacoesPage = lazy(() => import('./pages/Solicitacoes').then(m => ({ default: m.SolicitacoesPage })));
const NovaSolicitacaoPage = lazy(() => import('./pages/Solicitacoes/NovaSolicitacao').then(m => ({ default: m.NovaSolicitacaoPage })));
const DetalhesSolicitacaoPage = lazy(() => import('./pages/Solicitacoes/DetalhesSolicitacao').then(m => ({ default: m.DetalhesSolicitacaoPage })));
const TestSupabasePage = lazy(() => import('./pages/TestSupabase').then(m => ({ default: m.TestSupabasePage })));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      <span className="text-slate-500 text-sm">Carregando...</span>
    </div>
  </div>
);

// Componente para proteger rotas privadas com RBAC
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();

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
            <Route path="/test-supabase" element={
              <Suspense fallback={<PageLoader />}>
                <TestSupabasePage />
              </Suspense>
            } />

            {/* Rotas Privadas */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={
                <Suspense fallback={<PageLoader />}>
                  <Dashboard />
                </Suspense>
              } />
              <Route path="logistics" element={
                <Suspense fallback={<PageLoader />}>
                  <Logistics />
                </Suspense>
              } />
              <Route path="sales" element={
                <Suspense fallback={<PageLoader />}>
                  <Sales />
                </Suspense>
              } />
              <Route path="customers" element={
                <Suspense fallback={<PageLoader />}>
                  <Customers />
                </Suspense>
              } />
              <Route path="subscriptions" element={
                <Suspense fallback={<PageLoader />}>
                  <Subscriptions />
                </Suspense>
              } />
              <Route path="recovery" element={
                <Suspense fallback={<PageLoader />}>
                  <Recovery />
                </Suspense>
              } />
              <Route path="solicitacoes" element={
                <Suspense fallback={<PageLoader />}>
                  <SolicitacoesPage />
                </Suspense>
              } />
              <Route path="solicitacoes/nova" element={
                <Suspense fallback={<PageLoader />}>
                  <NovaSolicitacaoPage />
                </Suspense>
              } />
              <Route path="solicitacoes/:id" element={
                <Suspense fallback={<PageLoader />}>
                  <DetalhesSolicitacaoPage />
                </Suspense>
              } />
              <Route path="settings" element={
                <Suspense fallback={<PageLoader />}>
                  <SettingsPage />
                </Suspense>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </DateFilterProvider>
    </ThemeProvider>
  );
}

export default App;