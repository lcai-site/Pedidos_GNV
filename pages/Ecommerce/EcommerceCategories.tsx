import React, { useState } from 'react';
import { Plus, FolderTree, Edit2 } from 'lucide-react';
import { EcommercePageHeader } from '../../components/ecommerce/layout/EcommercePageHeader';
import { EcommerceEmptyState } from '../../components/ecommerce/ui/EcommerceEmptyState';
import { useEcommerceCategories } from '../../lib/hooks/useEcommerceMisc';
import { EcommerceCategoryModal } from '../../components/ecommerce/modals/EcommerceCategoryModal';
import type { EcommerceCategory } from '../../types/ecommerce';

export const EcommerceCategories: React.FC = () => {
  const { data: categories = [], isLoading } = useEcommerceCategories();
  const hasCategories = categories.length > 0;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<EcommerceCategory | null>(null);

  const handleOpenNew = () => {
    setCategoryToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (category: EcommerceCategory) => {
    setCategoryToEdit(category);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <EcommercePageHeader
        title="Categorias"
        description="Organize seus produtos em categorias hierárquicas."
        actionLabel="Nova categoria"
        actionIcon={Plus}
        onAction={handleOpenNew}
      />

      {/* Categories Grid/List */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        {/* Table Header */}
        <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-4">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono flex-1">
            Nome
          </div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-48 text-center">
            Slug
          </div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-24 text-center">
            Posição
          </div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono w-10 text-right">
            
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Carregando categorias...</div>
        ) : hasCategories ? (
          <div className="divide-y divide-slate-800/50">
            {categories.map((category) => (
              <div key={category.id} className="px-4 py-3 flex items-center gap-4 hover:bg-white/5 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200">{category.nome}</div>
                  {category.descricao && <div className="text-xs text-slate-500 truncate">{category.descricao}</div>}
                </div>
                
                <div className="w-48 text-sm text-slate-400 font-mono text-center">
                  {category.slug}
                </div>
                
                <div className="w-24 text-sm text-slate-400 font-mono text-center">
                  {category.posicao}
                </div>
                
                <div className="w-10 shrink-0 flex justify-end">
                  <button
                    onClick={() => handleOpenEdit(category)}
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
            icon={FolderTree}
            title="Nenhuma categoria criada"
            description="Crie categorias para organizar seus produtos e facilitar a navegação dos clientes."
            actionLabel="Nova categoria"
            onAction={handleOpenNew}
          />
        )}
      </div>

      <EcommerceCategoryModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        categoryToEdit={categoryToEdit}
      />
    </div>
  );
};
