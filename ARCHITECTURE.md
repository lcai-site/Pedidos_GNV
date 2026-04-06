# 🏗️ Arquitetura do Projeto - Módulos

## Estrutura de Pastas

```
src/
├── modules/                    # Módulos de domínio
│   ├── dashboard/             # Módulo Dashboard
│   ├── logistics/             # Módulo Logística
│   ├── crm/                   # Módulo CRM
│   ├── sales/                 # Módulo Vendas
│   ├── recovery/              # Módulo Recuperação
│   ├── estoque/               # Módulo Estoque
│   ├── subscriptions/         # Módulo Assinaturas
│   ├── customers/             # Módulo Clientes
│   └── auth/                  # Módulo Autenticação
├── core/                      # Core do sistema
│   ├── components/            # Componentes compartilhados
│   ├── hooks/                 # Hooks globais
│   ├── services/              # Serviços base
│   ├── utils/                 # Utilitários
│   └── types/                 # Tipos globais
├── lib/                       # Configurações externas
│   ├── supabase.ts           # Cliente Supabase
│   └── config/               # Configurações
└── App.tsx                    # Entry point
```

## Estrutura de cada Módulo

```
modules/[nome]/
├── components/               # Componentes específicos
│   ├── ui/                  # Componentes de UI
│   └── [Feature]Components/
├── hooks/                    # Hooks do módulo
├── services/                 # Serviços e APIs
├── types/                    # TypeScript types
├── utils/                    # Utilitários específicos
├── pages/                    # Páginas (se houver)
└── index.ts                  # Barrel export
```

## Regras de Organização

1. **Cada módulo é independente** - Não importa de outros módulos
2. **Shared fica em core/** - Componentes/hooks usados por +1 módulo
3. **Barrel exports** - Cada módulo exporta tudo via index.ts
4. **Nomenclatura** - PascalCase para componentes, camelCase para hooks

## Imports

```typescript
// ✅ Certo - Import do módulo
import { DashboardMetrics } from '@/modules/dashboard';
import { useLeads } from '@/modules/crm';

// ✅ Certo - Import do core
import { Button, Modal } from '@/core/components';
import { useAuth } from '@/core/hooks';

// ❌ Errado - Import direto de outro módulo
import { SomeComponent } from '@/modules/logistics/components/SomeComponent';
```
