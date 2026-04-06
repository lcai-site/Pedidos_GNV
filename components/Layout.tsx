import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, RefreshCw, ShoppingBag, Menu, X, LogOut, User as UserIcon, Settings, Users, FileText, Box, Trophy, UserCog, MessageSquare, BarChart3, Store } from 'lucide-react';
import { DateRangeFilter } from './ui/DateRangeFilter';
import { NotificationMenu } from './NotificationMenu';
import { useAuth } from '../lib/contexts/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NavItem = ({ to, icon: Icon, label, end = false }: { to: string; icon: any; label: string; end?: boolean }) => {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 transition-all duration-200 group relative rounded-r-lg ${isActive
          ? 'text-[#a3e635] bg-[#a3e635]/15 font-bold shadow-[0_0_15px_rgba(163,230,53,0.15)]'
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 font-medium'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Active Indicator Bar */}
          {isActive && (
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#a3e635] shadow-[0_0_10px_rgba(163,230,53,0.8)] rounded-r-full" />
          )}
          {/* Active Glow Effect */}
          {isActive && (
            <div className="absolute inset-0 bg-[#a3e635]/5 rounded-r-lg pointer-events-none" />
          )}
          <Icon className={`w-[18px] h-[18px] transition-all duration-200 ${isActive ? 'scale-110 drop-shadow-[0_0_4px_rgba(163,230,53,0.6)]' : 'group-hover:scale-110'}`} />
          <span className="text-sm tracking-wide relative z-10">{label}</span>
        </>
      )}
    </NavLink>
  );
};

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, signOut, can } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { logoUrl } = useTheme();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const getPageTitle = () => {
    if (location.pathname.startsWith('/solicitacoes')) return 'Solicitações';

    if (location.pathname.startsWith('/ecommerce')) return 'E-commerce';

    switch (location.pathname) {
      case '/': return 'Dashboard';
      case '/logistics': return 'Logística & Envios';
      case '/estoque': return 'Controle de Estoque';
      case '/sales': return 'Vendas';
      case '/customers': return 'Base de Clientes';
      case '/subscriptions': return 'Assinaturas';
      case '/recovery': return 'Carrinhos Abandonados';
      case '/pos-venda': return 'Desempenho Pós-Venda';
      case '/settings': return 'Configurações';
      default: return 'Gestão Pedidos GNV';
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex overflow-hidden selection:bg-[#a3e635] selection:text-black transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Floating Module Sidebar (Command Center) */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 h-screen transform transition-transform duration-300 ease-in-out flex flex-col
          bg-surface backdrop-blur-lg border-r border-border
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-20 flex items-center px-6 shrink-0 justify-between">
          <div className="flex items-center gap-2">
            <img
              src={logoUrl}
              alt="Gestão Pedidos GNV"
              className="h-10 w-auto object-contain drop-shadow-md"
            />
          </div>
          <button
            className="lg:hidden text-slate-400 hover:text-white p-2"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-0 space-y-0.5 mt-2 flex-1 overflow-y-auto custom-scrollbar">
          <NavItem to="/" icon={LayoutDashboard} label="DASHBOARD" end />
          
          <div className="pt-6 pb-2">
            <p className="px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Operations</p>
          </div>
          {can('logistics:view') && <NavItem to="/logistics" icon={Package} label="LOGÍSTICA" />}
          {can('estoque:view') && <NavItem to="/estoque" icon={Box} label="ESTOQUE" />}
          {can('solicitacoes:create') && <NavItem to="/solicitacoes" icon={FileText} label="SOLICITAÇÕES" />}
          {can('pedidos:view') && <NavItem to="/sales" icon={ShoppingCart} label="VENDAS" />}
          {can('clientes:view') && <NavItem to="/customers" icon={Users} label="CLIENTES" />}
          
          <div className="pt-6 pb-2">
            <p className="px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Growth</p>
          </div>
          {can('assinaturas:view') && <NavItem to="/subscriptions" icon={RefreshCw} label="ASSINATURAS" />}
          {can('recuperacao:view') && <NavItem to="/recovery" icon={ShoppingBag} label="RECUPERAÇÃO" />}
          {can('dashboard_posvenda:view_all') && <NavItem to="/pos-venda" icon={Trophy} label="PÓS-VENDA" />}

          <div className="pt-6 pb-2">
            <p className="px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Commerce</p>
          </div>
          {can('ecommerce:view') && <NavItem to="/ecommerce" icon={Store} label="E-COMMERCE" />}
          
          <div className="pt-6 pb-2">
            <p className="px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">CRM</p>
          </div>
          {can('crm:view') && <NavItem to="/crm/chat" icon={MessageSquare} label="CONVERSAS" />}
          {can('crm:view') && <NavItem to="/crm/dashboard" icon={BarChart3} label="DASHBOARD CRM" />}
          {can('crm:view') && <NavItem to="/crm/leads" icon={Users} label="FUNIS" />}
          {can('crm:config') && <NavItem to="/crm/mensagens" icon={MessageSquare} label="MENSAGENS" />}
          {can('crm:config') && <NavItem to="/crm/config" icon={Settings} label="CONFIG CRM" />}

          <div className="pt-6 pb-2">
            <p className="px-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">System</p>
          </div>
          {can('settings:view') && <NavItem to="/settings" icon={Settings} label="CONFIGURAÇÕES" />}
          {can('usuarios:manage_atendentes') && <NavItem to="/usuarios" icon={UserCog} label="USUÁRIOS" />}
        </nav>

        {/* User Card */}
        <div className="p-5 border-t border-border bg-surface shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#a3e635]/10 border border-[#a3e635]/30 flex items-center justify-center text-xs font-bold text-[#a3e635] shadow-[0_0_10px_rgba(163,230,53,0.1)]">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text-primary truncate">
                {profile?.nome_completo || profile?.email?.split('@')[0] || 'Operator'}
              </p>
              <p className="text-[10px] text-slate-400 truncate uppercase tracking-widest font-mono">
                {profile?.role || 'SYSTEM_ADMIN'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-text-primary text-[11px] font-extrabold uppercase tracking-widest transition-colors border border-border"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background relative">
        {/* Header - Transparent/Brutalist */}
        <header className="h-[72px] flex items-center justify-between px-6 lg:px-10 z-30 shrink-0 border-b border-border">
          <div className="flex items-center gap-5">
            <button
              className="lg:hidden p-2 text-slate-400 hover:text-[#a3e635] transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-black text-text-primary tracking-tight hidden sm:block uppercase">
                {getPageTitle()}
              </h1>
              {import.meta.env.VITE_ENVIRONMENT === 'development' && (
                <div className="px-2 py-0.5 bg-[#fb923c]/10 border border-[#fb923c]/30 text-[#fb923c] text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-1.5" title="Staging Environment">
                  <div className="w-1 h-1 bg-[#fb923c] animate-pulse"></div>
                  <span className="hidden sm:inline">STAGING_ENV</span>
                  <span className="sm:hidden">STG</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6 flex-1 justify-end">
            <DateRangeFilter />
            <NotificationMenu />
          </div>
        </header>

        {/* Scrollable Work Area (Command Viewport) */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 lg:p-10 custom-scrollbar relative z-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};