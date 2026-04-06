import React, { useState } from 'react';
import { Plus, Search, Filter, Package, Image as ImageIcon, Edit2 } from 'lucide-react';
import { EcommercePageHeader } from '../../components/ecommerce/layout/EcommercePageHeader';
import { EcommerceEmptyState } from '../../components/ecommerce/ui/EcommerceEmptyState';
import { EcommerceStatusBadge } from '../../components/ecommerce/ui/EcommerceStatusBadge';
import { EcommerceProductModal } from '../../components/ecommerce/modals/EcommerceProductModal';
import { useEcommerceProducts } from '../../lib/hooks/useEcommerceProducts';
import type { TableColumn, EcommerceProduct } from '../../types/ecommerce';

const columns: TableColumn[] = [
  { key: 'imagem', label: '', width: 'w-12' },
  { key: 'nome', label: 'Produto' },
  { key: 'sku', label: 'SKU' },
  { key: 'preco', label: 'Preço', align: 'right' },
  { key: 'estoque', label: 'Estoque', align: 'center' },
  { key: 'status', label: 'Status', align: 'center' },
  { key: 'actions', label: '', align: 'right', width: 'w-10' },
];

export const EcommerceProducts: React.FC = () => {
  const { data: products = [], isLoading } = useEcommerceProducts();
  const hasProducts = products.length > 0;
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<EcommerceProduct | null>(null);

  const handleOpenNew = () => {
    setProductToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: EcommerceProduct) => {
    setProductToEdit(product);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <EcommercePageHeader
        title="Produtos"
        description="Gerencie o catálogo de produtos da sua loja."
        actionLabel="Adicionar produto"
        actionIcon={Plus}
        onAction={handleOpenNew}
      />

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome, SKU..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#a3e635]/40 focus:ring-1 focus:ring-[#a3e635]/20 transition-colors"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors shrink-0">
          <Filter className="h-4 w-4" />
          Filtros
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        {/* Table Header */}
        <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-4">
          {columns.map((col) => (
            <div
              key={col.key}
              className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono ${col.width || 'flex-1'} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
            >
              {col.label}
            </div>
          ))}
        </div>

        {/* Table Body */}
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Carregando produtos...</div>
        ) : hasProducts ? (
          <div className="divide-y divide-slate-800/50">
            {products.map((product) => (
              <div key={product.id} className="px-4 py-3 flex items-center gap-4 hover:bg-white/5 transition-colors group">
                <div className="w-12 shrink-0">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700/50 overflow-hidden">
                    {product.imagem_url ? (
                      <img src={product.imagem_url} alt={product.nome} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200 truncate">{product.nome}</div>
                </div>
                
                <div className="flex-1 text-sm text-slate-400 font-mono">
                  {product.sku}
                </div>
                
                <div className="flex-1 text-sm text-slate-300 text-right font-medium">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.preco)}
                </div>
                
                <div className="flex-1 text-sm text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${product.estoque > 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {product.estoque} {product.estoque === 1 ? 'unidade' : 'unidades'}
                  </span>
                </div>
                
                <div className="flex-1 flex justify-center">
                  <EcommerceStatusBadge status={product.status as any} />
                </div>
                
                <div className="w-10 shrink-0 flex justify-end">
                  <button
                    onClick={() => handleOpenEdit(product)}
                    className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EcommerceEmptyState
            icon={Package}
            title="Nenhum produto cadastrado"
            description="Cadastre seu primeiro produto para começar a vender na loja."
            actionLabel="Adicionar produto"
            onAction={handleOpenNew}
          />
        )}
      </div>

      <EcommerceProductModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productToEdit={productToEdit}
      />
    </div>
  );
};
