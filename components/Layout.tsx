import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, RefreshCw, ShoppingBag, Menu, X, Bell, LogOut, User as UserIcon, Settings, Users, FileText } from 'lucide-react';
import { DateRangeFilter } from './ui/DateRangeFilter';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { useTheme } from '../context/ThemeContext';

const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${isActive
          ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-600/20 shadow-sm'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
        }`
      }
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium text-sm">{label}</span>
    </NavLink>
  );
};

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { logoUrl } = useTheme();

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (data) {
          setProfile(data);
        } else {
          setProfile({
            id: user.id,
            email: user.email || '',
            role: 'usuario',
            created_at: new Date().toISOString()
          });
        }
      }
    };
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const getPageTitle = () => {
    if (location.pathname.startsWith('/solicitacoes')) return 'Solicitações';

    switch (location.pathname) {
      case '/': return 'Dashboard';
      case '/logistics': return 'Logística & Envios';
      case '/sales': return 'Vendas';
      case '/customers': return 'Base de Clientes';
      case '/subscriptions': return 'Assinaturas';
      case '/recovery': return 'Carrinhos Abandonados';
      case '/settings': return 'Configurações';
      default: return 'Gestão Pedidos GNV';
    }
  };

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex overflow-hidden transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 bg-surface border-r border-border transform transition-transform duration-300 ease-in-out flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-20 flex items-center px-6 border-b border-border shrink-0 justify-between">
          <div className="flex items-center gap-2">
            <img
              src={logoUrl}
              alt="Gestão Pedidos GNV"
              className="h-10 w-auto object-contain transition-all duration-300"
            />
          </div>
          <button
            className="lg:hidden text-slate-400"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="p-4 space-y-1 mt-4 flex-1 overflow-y-auto">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
          <div className="pt-4 pb-2">
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Operação</p>
          </div>
          <NavItem to="/logistics" icon={Package} label="Logística" />
          <NavItem to="/solicitacoes" icon={FileText} label="Solicitações" />
          <NavItem to="/sales" icon={ShoppingCart} label="Vendas" />
          <NavItem to="/customers" icon={Users} label="Clientes" />
          <div className="pt-4 pb-2">
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Growth</p>
          </div>
          <NavItem to="/subscriptions" icon={RefreshCw} label="Assinaturas" />
          <NavItem to="/recovery" icon={ShoppingBag} label="Recuperação" />

          <div className="pt-4 pb-2">
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sistema</p>
          </div>
          <NavItem to="/settings" icon={Settings} label="Configurações" />
        </nav>

        <div className="p-4 border-t border-border bg-surface shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate">
                {profile?.email?.split('@')[0] || 'Usuário'}
              </p>
              <p className="text-xs text-slate-500 truncate capitalize">
                {profile?.role || 'Carregando...'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 text-slate-600 dark:text-slate-400 text-xs font-medium transition-colors border border-border"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair da Conta
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 z-30 sticky top-0 gap-4 transition-colors">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 hidden sm:block">{getPageTitle()}</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-end">
            <DateRangeFilter />

            <button className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-background"></span>
            </button>
          </div>
        </header>

        {/* Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};