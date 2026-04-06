import React from 'react';
import { RevealCard, HoverCard, RevealCardGrid } from './RevealCard';
import { Package, TrendingUp, Users, ShoppingCart, DollarSign, Activity, ArrowRight, Star, Heart, Share2 } from 'lucide-react';

/**
 * Demo page showcasing the RevealCard components
 * These cards reveal dynamic content beautifully when hovered
 */
export const RevealCardDemo: React.FC = () => {
    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-2">Reveal Cards Demo</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
                Hover over cards to reveal dynamic content with beautiful animations
            </p>

            {/* Basic Grid Demo */}
            <section className="mb-12">
                <h2 className="text-xl font-semibold mb-4">Basic Reveal Cards (Slide from Bottom)</h2>
                <RevealCardGrid columns={4} gap={6}>
                    <RevealCard
                        front={
                            <div className="p-6 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl h-full">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-emerald-500/20 rounded-lg">
                                        <Package className="w-6 h-6 text-emerald-400" />
                                    </div>
                                    <span className="text-emerald-400 text-sm font-medium">+12%</span>
                                </div>
                                <h3 className="text-2xl font-bold">1,234</h3>
                                <p className="text-gray-400 text-sm">Pedidos Hoje</p>
                            </div>
                        }
                        reveal={
                            <div className="text-white">
                                <div className="space-y-2">
                                    <p className="text-emerald-300 font-semibold">Detalhes</p>
                                    <ul className="text-sm space-y-1">
                                        <li>• 892 entregues</li>
                                        <li>• 234 em trânsito</li>
                                        <li>• 108 pendentes</li>
                                    </ul>
                                </div>
                            </div>
                        }
                        direction="bottom"
                        glowColor="emerald"
                    />

                    <RevealCard
                        front={
                            <div className="p-6 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl h-full">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-blue-500/20 rounded-lg">
                                        <TrendingUp className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <span className="text-blue-400 text-sm font-medium">+8%</span>
                                </div>
                                <h3 className="text-2xl font-bold">R$ 45.2K</h3>
                                <p className="text-gray-400 text-sm">Faturamento</p>
                            </div>
                        }
                        reveal={
                            <div className="text-white">
                                <div className="space-y-2">
                                    <p className="text-blue-300 font-semibold">Por Período</p>
                                    <ul className="text-sm space-y-1">
                                        <li>• Hoje: R$ 12.5K</li>
                                        <li>• Semana: R$ 45.2K</li>
                                        <li>• Mês: R$ 182K</li>
                                    </ul>
                                </div>
                            </div>
                        }
                        direction="bottom"
                        glowColor="blue"
                    />

                    <RevealCard
                        front={
                            <div className="p-6 bg-gradient-to-br from-violet-500/20 to-violet-600/10 rounded-xl h-full">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-violet-500/20 rounded-lg">
                                        <Users className="w-6 h-6 text-violet-400" />
                                    </div>
                                    <span className="text-violet-400 text-sm font-medium">+24%</span>
                                </div>
                                <h3 className="text-2xl font-bold">856</h3>
                                <p className="text-gray-400 text-sm">Novos Clientes</p>
                            </div>
                        }
                        reveal={
                            <div className="text-white">
                                <div className="space-y-2">
                                    <p className="text-violet-300 font-semibold">Segmentos</p>
                                    <ul className="text-sm space-y-1">
                                        <li>• B2B: 234</li>
                                        <li>• B2C: 522</li>
                                        <li>• VIP: 100</li>
                                    </ul>
                                </div>
                            </div>
                        }
                        direction="bottom"
                        glowColor="violet"
                    />

                    <RevealCard
                        front={
                            <div className="p-6 bg-gradient-to-br from-amber-500/20 to-amber-600/10 rounded-xl h-full">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-amber-500/20 rounded-lg">
                                        <ShoppingCart className="w-6 h-6 text-amber-400" />
                                    </div>
                                    <span className="text-amber-400 text-sm font-medium">-3%</span>
                                </div>
                                <h3 className="text-2xl font-bold">3,421</h3>
                                <p className="text-gray-400 text-sm">Itens Vendidos</p>
                            </div>
                        }
                        reveal={
                            <div className="text-white">
                                <div className="space-y-2">
                                    <p className="text-amber-300 font-semibold">Top Produtos</p>
                                    <ul className="text-sm space-y-1">
                                        <li>• GNV Kit: 1,234</li>
                                        <li>• Conversão: 892</li>
                                        <li>• Manutenção: 567</li>
                                    </ul>
                                </div>
                            </div>
                        }
                        direction="bottom"
                        glowColor="amber"
                    />
                </RevealCardGrid>
            </section>

            {/* Different Directions Demo */}
            <section className="mb-12">
                <h2 className="text-xl font-semibold mb-4">Reveal from Different Directions</h2>
                <div className="grid grid-cols-4 gap-6">
                    <HoverCard direction="top" glowColor="cyan">
                        <div className="p-6 text-center">
                            <Activity className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
                            <h3 className="font-semibold">From Top</h3>
                            <p className="text-sm text-gray-400 mt-1">Slide animation</p>
                        </div>
                    </HoverCard>

                    <HoverCard direction="bottom" glowColor="rose">
                        <div className="p-6 text-center">
                            <DollarSign className="w-10 h-10 text-rose-400 mx-auto mb-3" />
                            <h3 className="font-semibold">From Bottom</h3>
                            <p className="text-sm text-gray-400 mt-1">Slide animation</p>
                        </div>
                    </HoverCard>

                    <HoverCard direction="left" glowColor="purple">
                        <div className="p-6 text-center">
                            <Users className="w-10 h-10 text-purple-400 mx-auto mb-3" />
                            <h3 className="font-semibold">From Left</h3>
                            <p className="text-sm text-gray-400 mt-1">Slide animation</p>
                        </div>
                    </HoverCard>

                    <HoverCard direction="right" glowColor="orange">
                        <div className="p-6 text-center">
                            <Package className="w-10 h-10 text-orange-400 mx-auto mb-3" />
                            <h3 className="font-semibold">From Right</h3>
                            <p className="text-sm text-gray-400 mt-1">Slide animation</p>
                        </div>
                    </HoverCard>
                </div>
            </section>

            {/* Flip Animation Demo */}
            <section className="mb-12">
                <h2 className="text-xl font-semibold mb-4">Flip Animation</h2>
                <RevealCardGrid columns={3} gap={6}>
                    <RevealCard
                        front={
                            <div className="h-full min-h-[200px] bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-6 flex flex-col justify-between">
                                <div className="text-white/80">
                                    <Star className="w-8 h-8 mb-2" />
                                    <h3 className="text-xl font-bold text-white">Produto Premium</h3>
                                    <p className="text-white/70">Clique para ver detalhes</p>
                                </div>
                                <div className="flex items-center gap-2 text-white/60 text-sm">
                                    <span>Avaliação 4.9</span>
                                    <span>•</span>
                                    <span>2.3k reviews</span>
                                </div>
                            </div>
                        }
                        reveal={
                            <div className="h-full min-h-[200px] bg-gradient-to-br from-purple-800 to-indigo-900 rounded-xl p-6 flex flex-col justify-center text-white">
                                <h4 className="text-lg font-bold mb-3">Especificações</h4>
                                <ul className="space-y-2 text-sm">
                                    <li>✓ Garantia vitalícia</li>
                                    <li>✓ Frete grátis</li>
                                    <li>✓ Suporte 24/7</li>
                                    <li>✓ Instalação incluída</li>
                                </ul>
                                <button className="mt-4 bg-white text-purple-900 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-white/90 transition-colors">
                                    Comprar Agora
                                </button>
                            </div>
                        }
                        direction="flip"
                        animation="flip"
                        glowColor="violet"
                    />

                    <RevealCard
                        front={
                            <div className="h-full min-h-[200px] bg-gradient-to-br from-cyan-600 to-blue-700 rounded-xl p-6 flex flex-col justify-between">
                                <div className="text-white/80">
                                    <Activity className="w-8 h-8 mb-2" />
                                    <h3 className="text-xl font-bold text-white">Analytics</h3>
                                    <p className="text-white/70">Dados em tempo real</p>
                                </div>
                                <div className="flex items-center gap-2 text-white/60 text-sm">
                                    <span>● Online</span>
                                    <span>•</span>
                                    <span>1.2k usuários</span>
                                </div>
                            </div>
                        }
                        reveal={
                            <div className="h-full min-h-[200px] bg-gradient-to-br from-blue-800 to-cyan-900 rounded-xl p-6 flex flex-col justify-center text-white">
                                <h4 className="text-lg font-bold mb-3">Métricas</h4>
                                <ul className="space-y-2 text-sm">
                                    <li>📈 +156% crescimento</li>
                                    <li>👥 1.2k usuários ativos</li>
                                    <li>⏱️ 98.5% uptime</li>
                                    <li>💾 2.4ms latência</li>
                                </ul>
                                <button className="mt-4 bg-white text-cyan-900 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-white/90 transition-colors">
                                    Ver Dashboard
                                </button>
                            </div>
                        }
                        direction="flip"
                        animation="flip"
                        glowColor="cyan"
                    />

                    <RevealCard
                        front={
                            <div className="h-full min-h-[200px] bg-gradient-to-br from-rose-600 to-orange-600 rounded-xl p-6 flex flex-col justify-between">
                                <div className="text-white/80">
                                    <Heart className="w-8 h-8 mb-2" />
                                    <h3 className="text-xl font-bold text-white">Favoritos</h3>
                                    <p className="text-white/70">Sua lista de desejos</p>
                                </div>
                                <div className="flex items-center gap-2 text-white/60 text-sm">
                                    <span>❤️ 24 itens</span>
                                    <span>•</span>
                                    <span>R$ 12.5k valor</span>
                                </div>
                            </div>
                        }
                        reveal={
                            <div className="h-full min-h-[200px] bg-gradient-to-br from-orange-800 to-rose-900 rounded-xl p-6 flex flex-col justify-center text-white">
                                <h4 className="text-lg font-bold mb-3">Ações Rápidas</h4>
                                <div className="space-y-2">
                                    <button className="w-full text-left px-3 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-colors">
                                        ➜ Ver todos
                                    </button>
                                    <button className="w-full text-left px-3 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-colors">
                                        ➜ Comparar
                                    </button>
                                    <button className="w-full text-left px-3 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-colors">
                                        ➜ Compartilhar
                                    </button>
                                </div>
                            </div>
                        }
                        direction="flip"
                        animation="flip"
                        glowColor="rose"
                    />
                </RevealCardGrid>
            </section>

            {/* Product Cards Demo */}
            <section className="mb-12">
                <h2 className="text-xl font-semibold mb-4">E-Commerce Product Cards</h2>
                <RevealCardGrid columns={4} gap={6}>
                    <ProductCard
                        image="/api/placeholder/300/200"
                        name="Kit GNV Completo"
                        price="R$ 2.499"
                        originalPrice="R$ 2.999"
                        rating={4.8}
                        reviews={234}
                        badge="Mais Vendido"
                        badgeColor="emerald"
                    />
                    <ProductCard
                        image="/api/placeholder/300/200"
                        name="Conversão GNV 5ª"
                        price="R$ 3.299"
                        originalPrice="R$ 3.899"
                        rating={4.9}
                        reviews={156}
                        badge="Novo"
                        badgeColor="blue"
                    />
                    <ProductCard
                        image="/api/placeholder/300/200"
                        name="Kit Manutenção"
                        price="R$ 499"
                        originalPrice="R$ 599"
                        rating={4.5}
                        reviews={89}
                        badge="-17%"
                        badgeColor="rose"
                    />
                    <ProductCard
                        image="/api/placeholder/300/200"
                        name="Sensor de Pressão"
                        price="R$ 189"
                        originalPrice="R$ 229"
                        rating={4.7}
                        reviews={312}
                        badge={null}
                    />
                </RevealCardGrid>
            </section>
        </div>
    );
};

// Product Card Component
interface ProductCardProps {
    image: string;
    name: string;
    price: string;
    originalPrice: string;
    rating: number;
    reviews: number;
    badge?: string | null;
    badgeColor?: 'emerald' | 'blue' | 'rose' | 'amber';
}

const ProductCard: React.FC<ProductCardProps> = ({
    image,
    name,
    price,
    originalPrice,
    rating,
    reviews,
    badge,
    badgeColor = 'emerald',
}) => {
    const badgeColors = {
        emerald: 'bg-emerald-500',
        blue: 'bg-blue-500',
        rose: 'bg-rose-500',
        amber: 'bg-amber-500',
    };

    return (
        <RevealCard
            height="360px"
            direction="right"
            animation="slide"
            glowColor="blue"
            front={
                <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden h-full flex flex-col">
                    <div className="relative">
                        <img src={image} alt={name} className="w-full h-40 object-cover" />
                        {badge && (
                            <span className={`absolute top-3 left-3 ${badgeColors[badgeColor]} text-white text-xs font-bold px-2 py-1 rounded-full`}>
                                {badge}
                            </span>
                        )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">{name}</h3>
                        <div className="flex items-center gap-1 mb-2">
                            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                            <span className="text-sm font-medium">{rating}</span>
                            <span className="text-sm text-gray-400">({reviews})</span>
                        </div>
                        <div className="mt-auto">
                            <div className="flex items-baseline gap-2">
                                <span className="text-xl font-bold text-gray-900 dark:text-white">{price}</span>
                                <span className="text-sm text-gray-400 line-through">{originalPrice}</span>
                            </div>
                        </div>
                    </div>
                </div>
            }
            reveal={
                <div className="h-full bg-white dark:bg-gray-800 rounded-xl p-4 flex flex-col">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Comprar</h4>
                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300 mb-4">
                        <p>✓ Original</p>
                        <p>✓ Garantia de fábrica</p>
                        <p>✓ Nota fiscal</p>
                    </div>
                    <div className="mt-auto space-y-2">
                        <button className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                            Adicionar ao Carrinho
                        </button>
                        <div className="flex gap-2">
                            <button className="flex-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                <Heart className="w-5 h-5 mx-auto" />
                            </button>
                            <button className="flex-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                <Share2 className="w-5 h-5 mx-auto" />
                            </button>
                        </div>
                    </div>
                </div>
            }
        />
    );
};

export default RevealCardDemo;
