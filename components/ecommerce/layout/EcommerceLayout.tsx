import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Layers,
  Tag,
  ShoppingCart,
  Users,
  Ticket,
  ShoppingBag,
  Settings,
  LucideIcon,
  Store,
  Network
} from 'lucide-react';

interface NavTab {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

const tabs: NavTab[] = [
  { to: '/ecommerce', icon: Store, label: 'Visão Geral', end: true },
  { to: '/ecommerce/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ecommerce/products', icon: Package, label: 'Produtos' },
  { to: '/ecommerce/categories', icon: FolderTree, label: 'Categorias' },
  { to: '/ecommerce/collections', icon: Layers, label: 'Coleções' },
  { to: '/ecommerce/offers', icon: Tag, label: 'Ofertas' },
  { to: '/ecommerce/orders', icon: ShoppingCart, label: 'Pedidos' },
  { to: '/ecommerce/customers', icon: Users, label: 'Clientes' },
  { to: '/ecommerce/coupons', icon: Ticket, label: 'Cupons' },
  { to: '/ecommerce/carts', icon: ShoppingBag, label: 'Carrinhos' },
  { to: '/ecommerce/affiliates', icon: Network, label: 'Rede (Gerentes & Afiliados)' },
  { to: '/ecommerce/settings', icon: Settings, label: 'Config' },
];

export const EcommerceLayout: React.FC = () => {
  const location = useLocation();

  return (
    <div className="space-y-6">
      {/* Horizontal Tab Navigation */}
      <div className="border-b border-border -mx-6 lg:-mx-10 px-6 lg:px-10">
        <nav
          className="flex gap-1 overflow-x-auto custom-scrollbar pb-px"
          role="tablist"
          aria-label="Navegação E-commerce"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.end
              ? location.pathname === tab.to
              : location.pathname.startsWith(tab.to);

            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                role="tab"
                aria-selected={isActive}
                className={`
                  flex items-center gap-2 px-3 py-3 text-xs font-bold uppercase tracking-wider
                  whitespace-nowrap border-b-2 transition-all duration-200 shrink-0
                  ${isActive
                    ? 'border-[#a3e635] text-[#a3e635]'
                    : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
                  }
                `}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Page Content */}
      <div className="animate-fade-in">
        <Outlet />
      </div>
    </div>
  );
};
