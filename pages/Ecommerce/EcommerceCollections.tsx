import React, { useState } from 'react';
import { Plus, Layers, Image as ImageIcon, Edit2 } from 'lucide-react';
import { EcommercePageHeader } from '../../components/ecommerce/layout/EcommercePageHeader';
import { EcommerceEmptyState } from '../../components/ecommerce/ui/EcommerceEmptyState';
import { useEcommerceCollections } from '../../lib/hooks/useEcommerceMisc';
import { EcommerceCollectionModal } from '../../components/ecommerce/modals/EcommerceCollectionModal';
import type { EcommerceCollection } from '../../types/ecommerce';

export const EcommerceCollections: React.FC = () => {
  const { data: collections = [], isLoading } = useEcommerceCollections();
  const hasCollections = collections.length > 0;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [collectionToEdit, setCollectionToEdit] = useState<EcommerceCollection | null>(null);

  const handleOpenNew = () => {
    setCollectionToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (collection: EcommerceCollection) => {
    setCollectionToEdit(collection);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <EcommercePageHeader
        title="Coleções"
        description="Agrupe produtos em coleções para vitrines e campanhas."
        actionLabel="Nova coleção"
        actionIcon={Plus}
        onAction={handleOpenNew}
      />

      {isLoading ? (
        <div className="p-8 text-center text-slate-500 text-sm">Carregando coleções...</div>
      ) : hasCollections ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map(collection => (
            <div key={collection.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 transition-all hover:border-slate-500 group relative">
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleOpenEdit(collection)}
                  className="p-1.5 bg-slate-800/80 backdrop-blur text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 hover:border-slate-600"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              <div className="aspect-video bg-slate-800/80 rounded-lg mb-3 flex items-center justify-center overflow-hidden border border-slate-700/50">
                {collection.imagem_url ? (
                  <img src={collection.imagem_url} alt={collection.nome} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-slate-600" />
                )}
              </div>
              <div className="font-bold text-slate-200 truncate mb-1" title={collection.nome}>{collection.nome}</div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${collection.tipo === 'automatica' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                  {collection.tipo}
                </span>
                <span className={`text-[10px] font-mono ${collection.publicada ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {collection.publicada ? 'Publicada' : 'Rascunho'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <EcommerceEmptyState
            icon={Layers}
            title="Nenhuma coleção criada"
            description="Coleções permitem agrupar produtos por tema, temporada ou campanha."
            actionLabel="Nova coleção"
            onAction={handleOpenNew}
          />
        </div>
      )}

      <EcommerceCollectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        collectionToEdit={collectionToEdit}
      />
    </div>
  );
};
