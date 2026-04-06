import React, { useEffect, useState } from 'react';
import { Package, Plus, Trash2, Edit2, History, RefreshCw, AlertTriangle } from 'lucide-react';
import { useEstoque, useMovimentacoes, useCadastrarProduto, useAtualizarEstoque, useDeletarProduto } from '../lib/hooks/useEstoque';
import type { Estoque, EstoqueMovimentacao } from '../lib/types/estoque';
import { Skeleton } from '../components/ui/Skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { logger } from '../lib/utils/logger';
import { useAuth } from '../lib/contexts/AuthContext';

// Modal para cadastrar novo produto
const NewProductModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (codigo: string, nome: string, quantidade: number, limiteAlerta: number) => Promise<void>;
}> = ({ isOpen, onClose, onConfirm }) => {
    const { can } = useAuth();
    const [codigo, setCodigo] = useState('');
    const [nome, setNome] = useState('');
    const [quantidade, setQuantidade] = useState('');
    const [limiteAlerta, setLimiteAlerta] = useState('100');
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const qty = parseInt(quantidade, 10);
        const limite = parseInt(limiteAlerta, 10);

        if (!codigo.trim()) {
            toast.error('Informe o código do produto');
            return;
        }
        if (!nome.trim()) {
            toast.error('Informe o nome do produto');
            return;
        }
        if (isNaN(qty) || qty < 0) {
            toast.error('Quantidade inválida');
            return;
        }

        setSaving(true);
        try {
            await onConfirm(codigo.trim(), nome.trim(), qty, limite || 100);
            setCodigo('');
            setNome('');
            setQuantidade('');
            setLimiteAlerta('100');
            onClose();
        } catch (err: any) {
            logger.error('Erro ao cadastrar produto', err, { module: 'Estoque', codigo, nome });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-xl shadow-2xl w-full max-w-md border border-border">
                <div className="p-6 border-b border-border">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Plus className="w-5 h-5 text-emerald-500" />
                        Cadastrar Novo Produto
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Código
                            </label>
                            <input
                                type="text"
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-slate-900 dark:text-white uppercase"
                                placeholder="Ex: DP"
                                maxLength={10}
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Quantidade
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={quantidade}
                                onChange={(e) => setQuantidade(e.target.value)}
                                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-slate-900 dark:text-white"
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Nome do Produto
                        </label>
                        <input
                            type="text"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-slate-900 dark:text-white"
                            placeholder="Ex: Desejo Proibido"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Limite de Alerta (opcional)
                        </label>
                        <input
                            type="number"
                            min="0"
                            value={limiteAlerta}
                            onChange={(e) => setLimiteAlerta(e.target.value)}
                            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-slate-900 dark:text-white"
                            placeholder="100"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Alerta quando estoque atingir este limite</p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-border rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            Cancelar
                        </button>
                        {can('estoque:add') ? (
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Cadastrar
                            </button>
                        ) : (
                            <div className="flex-1 px-4 py-2 bg-slate-800 text-slate-500 rounded-lg font-medium flex items-center justify-center gap-2 cursor-not-allowed">
                                Bloqueado
                            </div>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

// Modal para editar estoque
const EditStockModal: React.FC<{
    isOpen: boolean;
    produto: Estoque | null;
    onClose: () => void;
    onConfirm: (novaQuantidade: number, motivo: string) => Promise<void>;
}> = ({ isOpen, produto, onClose, onConfirm }) => {
    const { can } = useAuth();
    const [quantidade, setQuantidade] = useState('');
    const [motivo, setMotivo] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (produto) {
            setQuantidade(produto.quantidade_atual.toString());
        }
    }, [produto]);

    if (!isOpen || !produto) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const qty = parseInt(quantidade, 10);
        if (isNaN(qty) || qty < 0) {
            toast.error('Quantidade inválida');
            return;
        }
        if (!motivo.trim()) {
            toast.error('Informe o motivo da alteração');
            return;
        }

        setSaving(true);
        try {
            await onConfirm(qty, motivo.trim());
            setMotivo('');
            onClose();
        } catch (err) {
            logger.error('Erro ao atualizar estoque', err as Error, { module: 'Estoque', produtoId: produto.id });
        } finally {
            setSaving(false);
        }
    };

    const diferenca = parseInt(quantidade, 10) - produto.quantidade_atual;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-xl shadow-2xl w-full max-w-md border border-border">
                <div className="p-6 border-b border-border">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Edit2 className="w-5 h-5 text-blue-500" />
                        Editar Estoque - {produto.nome_produto}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Quantidade atual: <span className="font-bold">{produto.quantidade_atual}</span>
                        </label>
                        <input
                            type="number"
                            min="0"
                            value={quantidade}
                            onChange={(e) => setQuantidade(e.target.value)}
                            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                        {!isNaN(diferenca) && diferenca !== 0 && (
                            <p className={`text-sm mt-1 ${diferenca > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {diferenca > 0 ? '+' : ''}{diferenca} unidades
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Motivo da alteração
                        </label>
                        <input
                            type="text"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-slate-900 dark:text-white"
                            placeholder="Ex: Reposição, Ajuste de inventário..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-border rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            Cancelar
                        </button>
                        {can('estoque:edit') ? (
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                                Salvar
                            </button>
                        ) : (
                            <div className="flex-1 px-4 py-2 bg-slate-800 text-slate-500 rounded-lg font-medium flex items-center justify-center gap-2 cursor-not-allowed">
                                Bloqueado
                            </div>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

// Card de produto
const ProductCard: React.FC<{
    produto: Estoque;
    onEdit: () => void;
    onDelete: () => void;
}> = ({ produto, onEdit, onDelete }) => {
    const { can } = useAuth();
    const porcentagem = produto.limite_alerta > 0
        ? Math.min((produto.quantidade_atual / produto.limite_alerta) * 100, 100)
        : 100;

    const isBaixo = produto.quantidade_atual <= produto.limite_alerta;
    const corBarra = isBaixo ? 'bg-amber-500' : 'bg-emerald-500';
    const corCard = isBaixo ? 'border-amber-500/30' : 'border-emerald-500/30';

    return (
        <div className={`bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border ${corCard} shadow-lg`}>
            <div className="flex justify-between items-start mb-3">
                <div>
                    <span className="text-xs font-mono text-slate-400">{produto.produto}</span>
                    <h3 className="text-lg font-semibold text-white">{produto.nome_produto}</h3>
                </div>
                <div className="flex gap-1">
                    {isBaixo && (
                        <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Baixo
                        </span>
                    )}
                </div>
            </div>

            <div className="mb-4">
                <span className="text-sm text-slate-400">Quantidade em Estoque</span>
                <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-bold ${isBaixo ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {produto.quantidade_atual}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-sm">unidades</span>
                </div>
            </div>

            <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Alerta: {produto.limite_alerta}</span>
                    <span>{Math.round(porcentagem)}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${corBarra} transition-all duration-500`}
                        style={{ width: `${porcentagem}%` }}
                    />
                </div>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Criado em {format(new Date(produto.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>

            <div className="flex gap-2">
                {can('estoque:edit') && (
                    <button
                        onClick={onEdit}
                        className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                    >
                        <Edit2 className="w-4 h-4" />
                        Editar
                    </button>
                )}
                {can('estoque:delete') && (
                    <button
                        onClick={onDelete}
                        className="px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
};

// Página principal
export const EstoquePage: React.FC = () => {
    const { can } = useAuth();
    const { data: estoque = [], isLoading: loadingEstoque, refetch: refetchEstoque } = useEstoque();
    const { data: movimentacoes = [], isLoading: loadingMov } = useMovimentacoes(20);
    const cadastrarMutation = useCadastrarProduto();
    const atualizarMutation = useAtualizarEstoque();
    const deletarMutation = useDeletarProduto();

    const [showNewModal, setShowNewModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Estoque | null>(null);

    const loading = loadingEstoque || loadingMov;

    const handleNewProduct = async (codigo: string, nome: string, quantidade: number, limiteAlerta: number) => {
        await cadastrarMutation.mutateAsync({ codigo, nome, quantidade, limiteAlerta });
    };

    const handleEditStock = async (novaQuantidade: number, motivo: string) => {
        if (!editingProduct) return;
        await atualizarMutation.mutateAsync({ estoqueId: editingProduct.id, novaQuantidade, motivo });
    };

    const handleDeleteProduct = async (produto: Estoque) => {
        if (!confirm(`Deseja realmente excluir "${produto.nome_produto}"?`)) return;
        await deletarMutation.mutateAsync(produto.id);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Controle de Estoque</h1>
                    <p className="text-slate-500 dark:text-slate-400">Gerencie o estoque dos produtos</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => refetchEstoque()}
                        className="px-4 py-2 border border-border rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>
                    {can('estoque:add') && (
                        <button
                            onClick={() => setShowNewModal(true)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Novo Produto
                        </button>
                    )}
                </div>
            </div>

            {/* Grid de produtos */}
            {loadingEstoque ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-64 rounded-xl" />
                    ))}
                </div>
            ) : estoque.length === 0 ? (
                <div className="text-center py-16 bg-surface rounded-xl border border-border">
                    <Package className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-2">
                        Nenhum produto cadastrado
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-4">Clique em "Novo Produto" para começar</p>
                    {can('estoque:add') && (
                        <button
                            onClick={() => setShowNewModal(true)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium inline-flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Cadastrar Produto
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {estoque.map((produto) => (
                        <ProductCard
                            key={produto.id}
                            produto={produto}
                            onEdit={() => setEditingProduct(produto)}
                            onDelete={() => handleDeleteProduct(produto)}
                        />
                    ))}
                </div>
            )}

            {/* Histórico de Movimentações */}
            <div className="bg-surface rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <History className="w-5 h-5 text-slate-500" />
                        Histórico de Movimentações
                    </h2>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Últimas 20</span>
                </div>

                {movimentacoes.length === 0 ? (
                    <p className="text-center text-slate-500 dark:text-slate-400 py-8">Nenhuma movimentação registrada</p>
                ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {movimentacoes.map((mov) => (
                            <div key={mov.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                                <div className="flex items-center gap-3">
                                    <span className={`px-2 py-1 text-xs font-medium rounded ${mov.tipo === 'entrada'
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {mov.tipo === 'entrada' ? '+' : '-'}{mov.quantidade}
                                    </span>
                                    <span className="text-sm text-slate-300">{mov.motivo || 'Sem motivo'}</span>
                                </div>
                                <span className="text-xs text-slate-500">
                                    {format(new Date(mov.created_at), "dd/MM HH:mm", { locale: ptBR })}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modais */}
            <NewProductModal
                isOpen={showNewModal}
                onClose={() => setShowNewModal(false)}
                onConfirm={handleNewProduct}
            />

            <EditStockModal
                isOpen={!!editingProduct}
                produto={editingProduct}
                onClose={() => setEditingProduct(null)}
                onConfirm={handleEditStock}
            />
        </div>
    );
};

export default EstoquePage;
