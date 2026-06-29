# Configuração ToraYomit - Supabase & Vercel

## 1️⃣ Configuração Local (Desenvolvimento)

### Passo 1: Obter credenciais Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Entre no seu projeto ou crie um novo
3. Vá para **Settings** → **API**
4. Copie:
   - **Project URL** → `SUPABASE_URL`
   - **Service Role Key** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Use apenas no backend)

### Passo 2: Configurar .env.local

Abra o arquivo `.env.local` na raiz do projeto e preencha:

```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
API_KEY=sua_chave_api_super_segura_aqui
```

### Passo 3: Instalar dependências

```bash
npm install
```

### Passo 4: Rodar localmente

```bash
npm run dev
```

Isso usará `vercel dev` para testar no ambiente local.

---

## 2️⃣ Deploy no Vercel

### Passo 1: Conectar repositório

1. Acesse [vercel.com](https://vercel.com)
2. Clique em "Add New" → "Project"
3. Selecione seu repositório GitHub/GitLab

### Passo 2: Adicionar variáveis de ambiente

Na página do projeto Vercel:

1. Vá para **Settings** → **Environment Variables**
2. Adicione cada variável:

| Chave | Valor | Ambiente |
|-------|-------|----------|
| `SUPABASE_URL` | `https://seu-projeto.supabase.co` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Sua chave de serviço | Production, Preview, Development |
| `API_KEY` | Sua chave de API | Production, Preview, Development |

> ⚠️ **IMPORTANTE**: Não faça commit do `.env.local` no Git. Já está no `.gitignore`.

### Passo 3: Deploy

```bash
vercel deploy --prod
```

Ou use o painel do Vercel para fazer deploy automático a cada push.

---

## 3️⃣ Testar a conexão

### No terminal local:

```bash
npm run dev
```

Tente fazer login/criar conta. Se funcionar, as credenciais estão corretas.

### Vercel logs:

```bash
vercel logs
```

Se houver erros de "Missing environment variables", verifique as variáveis no painel Vercel.

---

## 🔐 Segurança

- ✅ `.env.local` está no `.gitignore` - NUNCA será commitado
- ✅ Service Role Key é apenas usada no backend (seguro)
- ✅ A chave nunca é exposta ao cliente
- ⚠️ Gere uma nova chave de API forte e aleatória

---

## Erro: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"

**Solução**: As variáveis não estão sendo lidas. Verifique:

1. `.env.local` existe e está preenchido? 
2. Rodou `npm run dev`? (Vercel lê o arquivo automaticamente)
3. No Vercel, as variáveis estão adicionadas?

---

## Próximos passos

- [ ] Configurar banco de dados Supabase
- [ ] Criar tabelas (users, groups, submissions)
- [ ] Testar endpoints da API
- [ ] Fazer deploy no Vercel
