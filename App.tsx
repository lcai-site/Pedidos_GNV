import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { DateFilterProvider } from './context/DateFilterContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './lib/contexts/AuthContext';
import { NotificationProvider } from './lib/contexts/NotificationContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

// Lazy loaded pages for better code splitting
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Logistics = lazy(() => import('./pages/Logistics').then(m => ({ default: m.Logistics })));
const Customers = lazy(() => import('./pages/Customers').then(m => ({ default: m.Customers })));
const Sales = lazy(() => import('./pages/Sales').then(m => ({ default: m.Sales })));
const Subscriptions = lazy(() => import('./pages/Subscriptions').then(m => ({ default: m.Subscriptions })));
const Recovery = lazy(() => import('./pages/Recovery').then(m => ({ default: m.Recovery })));
const SettingsPage = lazy(() => import('./pages/Settings').then(m => ({ default: m.SettingsPage })));
const SolicitacoesPage = lazy(() => import('./pages/Solicitacoes').then(m => ({ default: m.SolicitacoesPage })));
const NovaSolicitacaoPage = lazy(() => import('./pages/Solicitacoes/NovaSolicitacao').then(m => ({ default: m.NovaSolicitacaoPage })));
const DetalhesSolicitacaoPage = lazy(() => import('./pages/Solicitacoes/DetalhesSolicitacao').then(m => ({ default: m.DetalhesSolicitacaoPage })));
const TestSupabasePage = lazy(() => import('./pages/TestSupabase').then(m => ({ default: m.TestSupabasePage })));
const EstoquePage = lazy(() => import('./pages/Estoque').then(m => ({ default: m.EstoquePage })));
const DesempenhoVendedoras = lazy(() => import('./pages/DesempenhoVendedoras').then(m => ({ default: m.DesempenhoVendedoras })));
const CRMChat = lazy(() => import('./pages/CRM/Chat').then(m => ({ default: m.CRMChat })));
const CRMLeads = lazy(() => import('./pages/CRM/Leads').then(m => ({ default: m.CRMLeads })));
const CRMConfig = lazy(() => import('./pages/CRM/Config').then(m => ({ default: m.CRMConfig })));
const CRMPipelines = lazy(() => import('./pages/CRM/Pipelines').then(m => ({ default: m.CRMPipelines })));
const CRMEtapas = lazy(() => import('./pages/CRM/Etapas').then(m => ({ default: m.CRMEtapas })));
const CRMTags = lazy(() => import('./pages/CRM/Tags').then(m => ({ default: m.CRMTags })));
const CRMAutomacoes = lazy(() => import('./pages/CRM/Automacoes').then(m => ({ default: m.CRMAutomacoes })));
const CRMMensagens = lazy(() => import('./pages/CRM/Mensagens').then(m => ({ default: m.CRMMensagens })));
const CRMDashboard = lazy(() => import('./pages/CRM/DashboardCRM').then(m => ({ default: m.CRMDashboard })));
const UsuariosPage = lazy(() => import('./pages/Usuarios').then(m => ({ default: m.UsuariosPage })));

// E-commerce Module
const EcommerceLayoutPage = lazy(() => import('./components/ecommerce/layout/EcommerceLayout').then(m => ({ default: m.EcommerceLayout })));
const EcommerceOverview = lazy(() => import('./pages/Ecommerce').then(m => ({ default: m.EcommerceOverview })));
const EcommerceDashboard = lazy(() => import('./pages/Ecommerce/EcommerceDashboard').then(m => ({ default: m.EcommerceDashboard })));
const EcommerceProducts = lazy(() => import('./pages/Ecommerce/EcommerceProducts').then(m => ({ default: m.EcommerceProducts })));
const EcommerceCategories = lazy(() => import('./pages/Ecommerce/EcommerceCategories').then(m => ({ default: m.EcommerceCategories })));
const EcommerceCollections = lazy(() => import('./pages/Ecommerce/EcommerceCollections').then(m => ({ default: m.EcommerceCollections })));
const EcommerceOffers = lazy(() => import('./pages/Ecommerce/EcommerceOffers').then(m => ({ default: m.EcommerceOffers })));
const EcommerceOrders = lazy(() => import('./pages/Ecommerce/EcommerceOrders').then(m => ({ default: m.EcommerceOrders })));
const EcommerceCustomers = lazy(() => import('./pages/Ecommerce/EcommerceCustomers').then(m => ({ default: m.EcommerceCustomers })));
const EcommerceCoupons = lazy(() => import('./pages/Ecommerce/EcommerceCoupons').then(m => ({ default: m.EcommerceCoupons })));
const EcommerceCarts = lazy(() => import('./pages/Ecommerce/EcommerceCarts').then(m => ({ default: m.EcommerceCarts })));
const EcommerceAffiliates = lazy(() => import('./pages/Ecommerce/EcommerceAffiliates').then(m => ({ default: m.EcommerceAffiliates })));
const EcommerceSettingsPage = lazy(() => import('./pages/Ecommerce/EcommerceSettings').then(m => ({ default: m.EcommerceSettings })));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      <span className="text-slate-500 text-sm">Carregando...</span>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode; permission?: any }> = ({ children, permission }) => {
  const { session, loading, profile, error, can } = useAuth();
  const [showLoading, setShowLoading] = React.useState(true);

  // Timeout de segurança: não ficar em loading por mais de 3 segundos
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Mostrar loading apenas se estiver carregando E ainda não passou o timeout
  if (loading && showLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="text-slate-500 text-sm">Carregando sistema...</span>
        </div>
      </div>
    );
  }

  // Conta aguardando aprovação — mostrar tela bloqueada
  if (error?.message?.includes('aguardando aprovação') || (profile && !profile.ativo)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-surface border border-amber-500/30 rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Acesso Pendente</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Sua conta está aguardando aprovação do administrador.
            Você será notificado quando o acesso for liberado.
          </p>
          <button
            onClick={async () => { const { supabase } = await import('./lib/supabase'); await supabase.auth.signOut(); window.location.replace('/'); }}
            className="mt-6 text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Usar outra conta
          </button>
        </div>
      </div>
    );
  }

  // Se não tem sessão após o loading (ou timeout), redireciona para login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // SE tem permissão requerida, checar agora
  if (permission && !can(permission)) {
    console.warn(`Acesso negado para permissão: ${permission}`);
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const SuspensePage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  </ErrorBoundary>
);

function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const isSetPasswordFlow =
    searchParams.get('auth_flow') === 'set-password' ||
    hashParams.get('auth_flow') === 'set-password';

  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <DateFilterProvider>
            {isSetPasswordFlow ? (
              <SetPasswordPage />
            ) : (
            <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Routes>
                {/* Rota Pública */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/test-supabase" element={
                  <SuspensePage><TestSupabasePage /></SuspensePage>
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
                  <Route index element={<SuspensePage><Dashboard /></SuspensePage>} />
                  <Route path="logistics" element={<ProtectedRoute permission="logistics:view"><SuspensePage><Logistics /></SuspensePage></ProtectedRoute>} />
                  <Route path="estoque" element={<ProtectedRoute permission="estoque:view"><SuspensePage><EstoquePage /></SuspensePage></ProtectedRoute>} />
                  <Route path="sales" element={<ProtectedRoute permission="pedidos:view"><SuspensePage><Sales /></SuspensePage></ProtectedRoute>} />
                  <Route path="customers" element={<ProtectedRoute permission="clientes:view"><SuspensePage><Customers /></SuspensePage></ProtectedRoute>} />
                  <Route path="subscriptions" element={<ProtectedRoute permission="assinaturas:view"><SuspensePage><Subscriptions /></SuspensePage></ProtectedRoute>} />
                  <Route path="recovery" element={<ProtectedRoute permission="recuperacao:view"><SuspensePage><Recovery /></SuspensePage></ProtectedRoute>} />
                  <Route path="pos-venda" element={<ProtectedRoute permission="dashboard_posvenda:view_all"><SuspensePage><DesempenhoVendedoras /></SuspensePage></ProtectedRoute>} />
                  <Route path="crm/dashboard" element={<ProtectedRoute permission="crm:view"><SuspensePage><CRMDashboard /></SuspensePage></ProtectedRoute>} />
                  <Route path="crm/chat" element={<ProtectedRoute permission="crm:view"><SuspensePage><CRMChat /></SuspensePage></ProtectedRoute>} />
                  <Route path="crm/leads" element={<ProtectedRoute permission="crm:view"><SuspensePage><CRMLeads /></SuspensePage></ProtectedRoute>} />
                  <Route path="crm/config" element={<ProtectedRoute permission="crm:config"><SuspensePage><CRMConfig /></SuspensePage></ProtectedRoute>} />
                  <Route path="crm/pipelines" element={<ProtectedRoute permission="crm:config"><SuspensePage><CRMPipelines /></SuspensePage></ProtectedRoute>} />
                  <Route path="crm/etapas" element={<ProtectedRoute permission="crm:config"><SuspensePage><CRMEtapas /></SuspensePage></ProtectedRoute>} />
                  <Route path="crm/tags" element={<ProtectedRoute permission="crm:config"><SuspensePage><CRMTags /></SuspensePage></ProtectedRoute>} />
                  <Route path="crm/automacoes" element={<ProtectedRoute permission="crm:config"><SuspensePage><CRMAutomacoes /></SuspensePage></ProtectedRoute>} />
                  <Route path="crm/mensagens" element={<ProtectedRoute permission="crm:config"><SuspensePage><CRMMensagens /></SuspensePage></ProtectedRoute>} />
                  <Route path="crm/dashboard" element={<ProtectedRoute permission="crm:view"><SuspensePage><CRMDashboard /></SuspensePage></ProtectedRoute>} />
                  <Route path="usuarios" element={<ProtectedRoute permission="usuarios:manage_atendentes"><SuspensePage><UsuariosPage /></SuspensePage></ProtectedRoute>} />
                  
                  <Route path="solicitacoes" element={<ProtectedRoute permission="solicitacoes:create"><SuspensePage><SolicitacoesPage /></SuspensePage></ProtectedRoute>} />
                  <Route path="solicitacoes/nova" element={<ProtectedRoute permission="solicitacoes:create"><SuspensePage><NovaSolicitacaoPage /></SuspensePage></ProtectedRoute>} />
                  <Route path="solicitacoes/:id" element={<ProtectedRoute permission="solicitacoes:create"><SuspensePage><DetalhesSolicitacaoPage /></SuspensePage></ProtectedRoute>} />
                  <Route path="settings" element={<ProtectedRoute permission="settings:view"><SuspensePage><SettingsPage /></SuspensePage></ProtectedRoute>} />

                  {/* E-commerce Module — Nested Routes */}
                  <Route path="ecommerce" element={<ProtectedRoute permission="ecommerce:view"><SuspensePage><EcommerceLayoutPage /></SuspensePage></ProtectedRoute>}>
                    <Route index element={<SuspensePage><EcommerceOverview /></SuspensePage>} />
                    <Route path="dashboard" element={<SuspensePage><EcommerceDashboard /></SuspensePage>} />
                    <Route path="products" element={<SuspensePage><EcommerceProducts /></SuspensePage>} />
                    <Route path="categories" element={<SuspensePage><EcommerceCategories /></SuspensePage>} />
                    <Route path="collections" element={<SuspensePage><EcommerceCollections /></SuspensePage>} />
                    <Route path="offers" element={<SuspensePage><EcommerceOffers /></SuspensePage>} />
                    <Route path="orders" element={<SuspensePage><EcommerceOrders /></SuspensePage>} />
                    <Route path="customers" element={<SuspensePage><EcommerceCustomers /></SuspensePage>} />
                    <Route path="coupons" element={<SuspensePage><EcommerceCoupons /></SuspensePage>} />
                    <Route path="carts" element={<SuspensePage><EcommerceCarts /></SuspensePage>} />
                    <Route path="affiliates" element={<SuspensePage><EcommerceAffiliates /></SuspensePage>} />
                    <Route path="settings" element={<SuspensePage><EcommerceSettingsPage /></SuspensePage>} />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </HashRouter>
            )}
          </DateFilterProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
