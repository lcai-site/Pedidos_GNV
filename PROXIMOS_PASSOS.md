# 🚀 Guia Rápido - Próximos Passos

## ✅ O que já foi feito:

1. ✅ Criados arquivos de configuração de ambiente
   - `.env.development` (staging - você vai preencher)
   - `.env.production` (produção - já preenchido)
   
2. ✅ Atualizado `.gitignore` para proteger credenciais

3. ✅ Criado sistema de configuração centralizado
   - `lib/config/environment.ts`
   
4. ✅ Atualizados scripts do `package.json`
   - `npm run dev` → usa staging
   - `npm run build` → usa produção
   
5. ✅ Removidas credenciais hardcoded do código
   - Backup salvo em `CREDENTIALS_BACKUP.md`
   
6. ✅ Criado guia completo de setup
   - `SETUP_STAGING.md`

---

## 🎯 Próximos Passos (VOCÊ):

### Passo 1: Criar Projeto Supabase Staging (15 min)

1. Acesse https://app.supabase.com
2. Clique em "New Project"
3. Configure:
   - Name: `pedidos-gnv-staging`
   - Password: (crie uma senha forte)
   - Region: South America (São Paulo)
   - Plan: Free
4. Aguarde ~2 minutos

### Passo 2: Copiar Credenciais (5 min)

1. No projeto staging, vá em Settings → API
2. Copie:
   - Project URL
   - anon/public key
3. Cole no arquivo `.env.development`

### Passo 3: Aplicar Migrations (20 min)

Siga o guia detalhado em `SETUP_STAGING.md` - Passo 3

### Passo 4: Criar Usuários de Teste (10 min)

Siga o guia detalhado em `SETUP_STAGING.md` - Passo 4

### Passo 5: Testar Localmente (5 min)

```bash
# Parar o servidor atual (Ctrl+C no terminal)
# Rodar em modo development
npm run dev
```

**IMPORTANTE:** Agora quando você rodar `npm run dev`, o sistema vai:
1. Validar se as variáveis de ambiente estão configuradas
2. Mostrar no console qual ambiente está sendo usado
3. Se faltar alguma configuração, vai dar erro claro

---

## ⚠️ ATENÇÃO

**Antes de rodar `npm run dev` novamente:**

Você PRECISA preencher o arquivo `.env.development` com as credenciais do Supabase Staging.

Se tentar rodar sem preencher, vai dar este erro:
```
❌ Erro de configuração de ambiente:
  - VITE_SUPABASE_URL não está configurada
  - VITE_SUPABASE_ANON_KEY não está configurada
```

---

## 📝 Checklist

- [ ] Criar projeto Supabase staging
- [ ] Preencher `.env.development` com credenciais
- [ ] Aplicar migrations no staging
- [ ] Criar usuários de teste
- [ ] Testar login no ambiente local
- [ ] Validar que tudo funciona

---

## 🆘 Precisa de Ajuda?

Abra o arquivo `SETUP_STAGING.md` - ele tem um guia passo a passo completo com screenshots e troubleshooting.

---

**Tempo estimado total:** 45-60 minutos

**Quando terminar**, me avise que vamos para a próxima fase: **Modularização da aplicação**! 🎉
