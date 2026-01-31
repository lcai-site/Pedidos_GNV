# 🚀 CI/CD Setup - Pedidos GNV

## Workflows Criados

### 1. `ci.yml` - Integração Contínua
**Roda em:** Push e PRs nas branches `main` e `develop`

| Job | Descrição |
|-----|-----------|
| 🔍 Quality | Type Check (`tsc`) + Lint |
| 🏗️ Build | Build de produção |
| 🧪 Tests | Testes unitários (Vitest) |

### 2. `deploy-preview.yml` - Deploy de Preview
**Roda em:** PRs para `main` ou `develop`
- Deploy automático para URL de preview na Vercel
- Comenta na PR com o link do preview

### 3. `deploy-production.yml` - Deploy de Produção
**Roda em:** Push na branch `main`
- Deploy automático para produção na Vercel

---

## ⚙️ Configuração Necessária

### Secrets do GitHub
Vá em **Settings > Secrets and variables > Actions** e adicione:

| Secret | Descrição | Onde obter |
|--------|-----------|------------|
| `VITE_SUPABASE_URL` | URL do Supabase | Supabase Dashboard > Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima | Supabase Dashboard > Settings > API |
| `VERCEL_TOKEN` | Token da Vercel | https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | ID da organização | `.vercel/project.json` após `vercel link` |
| `VERCEL_PROJECT_ID` | ID do projeto | `.vercel/project.json` após `vercel link` |

### Como obter IDs da Vercel
```bash
# Na raiz do projeto
npx vercel link

# Isso cria .vercel/project.json com orgId e projectId
```

---

## 🔄 Fluxo de Trabalho

```
                    ┌─────────────┐
                    │   Commit    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │  Lint   │  │  Build  │  │  Tests  │
        └────┬────┘  └────┬────┘  └────┬────┘
              │            │            │
              └────────────┼────────────┘
                           │
                    ┌──────┴──────┐
                    │  PR Merge?  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │                         │
              ▼                         ▼
        ┌─────────┐               ┌─────────┐
        │ Preview │               │  Prod   │
        │ (PR)    │               │ (main)  │
        └─────────┘               └─────────┘
```

---

## ✅ Checklist de Setup

- [ ] Adicionar secrets no GitHub
- [ ] Verificar que `npm run lint` funciona
- [ ] Verificar que `npm run build` funciona
- [ ] Conectar Vercel (`vercel link`)
- [ ] Fazer primeiro push para testar
