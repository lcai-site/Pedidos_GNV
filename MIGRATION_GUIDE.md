# 🚀 Guia de Migração para Arquitetura Modular

## Resumo da Mudança

O projeto foi reestruturado de uma arquitetura plana para uma arquitetura modular por domínio.

## 📁 Nova Estrutura

```
src/
├── modules/                    # Módulos de domínio
│   ├── dashboard/
│   │   ├── pages/
│   │   │   └── Dashboard.tsx
│   │   └── index.ts           # Barrel export
│   ├── logistics/
│   ├── crm/
│   │   ├── components/
│   │   │   └── KanbanBoard.tsx
│   │   ├── hooks/
│   │   │   ├── useCRM.ts
│   │   │   └── useCRMKanban.ts
│   │   ├── pages/
│   │   │   └── index.tsx
│   │   └── index.ts
│   ├── sales/
│   ├── recovery/
│   ├── estoque/
│   ├── subscriptions/
│   ├── customers/
│   └── auth/
│       └── hooks/
│           └── useAuth.ts
├── core/                       # Core compartilhado
│   ├── components/
│   │   ├── ui/                # Componentes de UI
│   │   ├── Layout.tsx
│   │   └── index.ts
│   ├── hooks/
│   │   └── index.ts
│   ├── services/
│   ├── utils/
│   └── types/
├── App.tsx                     # Atualizado com novos imports
└── ...
```

## 🔄 Imports Antigos vs Novos

### Antes (plano):
```typescript
import { Dashboard } from './pages/Dashboard';
import { useLeads } from './lib/hooks/useCRM';
import { Layout } from './components/Layout';
```

### Depois (modular):
```typescript
import { Dashboard } from '@modules/dashboard';
import { useLeads } from '@modules/crm';
import { Layout } from '@core/components';
```

## 📦 Módulos Disponíveis

| Módulo | Exportações |
|--------|-------------|
| `@modules/dashboard` | Dashboard |
| `@modules/logistics` | Logistics |
| `@modules/sales` | Sales |
| `@modules/subscriptions` | Subscriptions |
| `@modules/customers` | Customers |
| `@modules/recovery` | Recovery |
| `@modules/estoque` | EstoquePage |
| `@modules/crm` | KanbanBoard, useLeads, usePipelines, etc |
| `@modules/auth` | useAuth |
| `@core/components` | Layout, ErrorBoundary, UI components |
| `@core/hooks` | useDashboardMetrics |

## ⚙️ Configuração de Paths

Os paths já estão configurados em:
- `tsconfig.json` - para TypeScript
- `vite.config.ts` - para Vite

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@core/*": ["./src/core/*"],
      "@modules/*": ["./src/modules/*"]
    }
  }
}
```

## 🛠️ Passos para Finalizar Migração

### 1. Mover arquivos restantes
Alguns arquivos ainda precisam ser movidos manualmente:

```bash
# Mover componentes de UI
mv components/ui/* src/core/components/ui/

# Mover hooks específicos
mv lib/hooks/useAuth.ts src/modules/auth/hooks/
mv lib/hooks/useEstoque.ts src/modules/estoque/hooks/

# Mover páginas
mv pages/Dashboard.tsx src/modules/dashboard/pages/
mv pages/Logistics.tsx src/modules/logistics/pages/
# ... etc
```

### 2. Atualizar imports nos arquivos movidos

Exemplo de atualização em `src/modules/dashboard/pages/Dashboard.tsx`:

```typescript
// Antes
import { useDashboardMetrics } from '../../lib/hooks/useDashboardMetrics';
import { SectionHeader } from '../../components/ui/SectionHeader';

// Depois
import { useDashboardMetrics } from '@core/hooks';
import { SectionHeader } from '@core/components';
```

### 3. Testar a aplicação

```bash
npm run dev
```

## 🎯 Benefícios da Nova Arquitetura

1. **Separação de Responsabilidades** - Cada módulo é independente
2. **Escalabilidade** - Fácil adicionar novas funcionalidades
3. **Manutenibilidade** - Código organizado por domínio
4. **Reusabilidade** - Core compartilhado entre módulos
5. **Testabilidade** - Módulos isolados são mais fáceis de testar

## 📝 Regras para Desenvolvimento

1. **Nunca importe diretamente de outro módulo**:
   ```typescript
   // ❌ Errado
   import { Something } from '@modules/logistics/components/Something';
   
   // ✅ Certo
   import { Something } from '@modules/logistics';
   ```

2. **Use apenas o barrel export (index.ts)** de cada módulo

3. **Componentes compartilhados vão em `@core/components`**

4. **Hooks específicos de módulo ficam no próprio módulo**

5. **Hooks compartilhados vão em `@core/hooks`**

## 🐛 Troubleshooting

### Erro: "Cannot find module '@modules/xxx'"
Verifique se o arquivo `src/modules/xxx/index.ts` existe e exporta corretamente.

### Erro: "Path mapping not working"
Reinicie o TypeScript language server no VS Code:
- `Ctrl+Shift+P` → "TypeScript: Restart TS Server"

### Erro de build
Verifique se o `vite.config.ts` tem os aliases configurados corretamente.

## 📚 Exemplo Completo

```typescript
// src/modules/sales/components/SalesTable.tsx
import { useState } from 'react';
import { Button, Modal } from '@core/components';  // UI compartilhada
import { useAuth } from '@modules/auth';            // Outro módulo
import { useSales } from '../hooks/useSales';       // Mesmo módulo

export const SalesTable = () => {
  // ...
};
```

```typescript
// src/modules/sales/index.ts
export { SalesTable } from './components/SalesTable';
export { Sales } from './pages/Sales';
export { useSales } from './hooks/useSales';
```
