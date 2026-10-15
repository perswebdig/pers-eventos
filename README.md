# PersEventos

Sistema web **offline-first** (PWA) para cadastro de pessoas, eventos e check-in
em espaços que recebem visitantes em vivências na natureza (retiros, glamping,
sítios, fazendas, centros de terapia).

- **Next.js 15** (App Router) + TypeScript estrito
- **Tailwind CSS v4** + **shadcn/ui**
- **PWA** com Service Worker (`@ducanh2912/next-pwa`, fork mantido do `next-pwa`)
- **Offline** com **Dexie.js** (IndexedDB) como fonte local primária
- **Backend** Supabase (Postgres + Auth + RLS)
- **Estado** Zustand · **Formulários** React Hook Form + Zod
- **QR Code** `qrcode.react`
- **Multitenant** com RBAC (`super_admin`, `tenant_admin`, `staff`, `cliente`)
- **Deploy** Supabase Cloud + PM2 ou Docker (com `restart: always`)

## Status

| Passo | Módulo                        | Situação |
| ----- | ----------------------------- | -------- |
| 1     | Setup do projeto + PWA        | ✅ concluído |
| 2     | Schema Supabase + Dexie       | ✅ concluído |
| 3     | Sync engine                   | ✅ concluído |
| 4     | Cadastro de pessoas (offline) | ✅ concluído |
| 5     | Eventos + inscrições          | ✅ concluído |
| 6     | Check-in por QR               | ✅ concluído |
| 7     | Termos + LGPD                 | ✅ concluído |
| 8     | Relatórios                    | ✅ concluído |
| 9     | Polimento UX                  | ✅ concluído |
| 10    | Multitenant + 3 níveis de acesso | ✅ concluído |
| 11    | Deploy PM2/Docker (background)   | ✅ concluído |

> **Auth + perfis**: login por e-mail/senha. O **primeiro usuário** vira
> `super_admin` (trigger `handle_new_user`); os demais entram como `cliente`.
> Papéis e vínculo de tenant são definidos em `profiles` (ver "Multitenant").

## Estrutura de pastas

```
src/
  app/
    layout.tsx              # shell raiz: tema, toaster, banner offline
    page.tsx                # landing
    manifest.ts             # manifest PWA (metadata route)
    offline/page.tsx        # fallback offline (precacheado pelo SW)
    (app)/                  # área autenticada (com AppHeader)
      layout.tsx
      dashboard|pessoas|eventos|checkin|relatorios|termos/page.tsx
    admin/                  # Super Admin (super_admin)
      layout.tsx · page.tsx · estabelecimentos/page.tsx
    portal/                 # Portal do Cliente (cliente)
      layout.tsx · page.tsx
      cadastro|eventos|qr|termos/page.tsx
    api/                    # Route Handlers (RBAC + admin client)
      me · health
      admin/estabelecimentos[/:id]
      eventos[/:id] · usuarios[/:id]
      portal/{perfil,eventos,inscricoes,termos}
    login|onboarding/page.tsx
  components/
    ui/                     # shadcn/ui
    app-header.tsx · theme-provider.tsx · theme-toggle.tsx
    user-menu.tsx · offline-indicator.tsx · page-placeholder.tsx
  features/
    auth/
      auth-form.tsx         # entrar / criar conta (Supabase Auth)
    admin/                  # UI do Super Admin
      estabelecimento-schema.ts · usuario-schema.ts
      estabelecimento-form.tsx · estabelecimentos-view.tsx
    portal/                 # UI do Cliente
      portal-perfil-form.tsx · portal-eventos.tsx
      portal-qr.tsx · portal-termos.tsx
    pessoas/
      pessoa-schema.ts      # validação Zod (+ regras de menor/LGPD)
      pessoa-form.tsx       # formulário (RHF + shadcn)
      pessoa-detail.tsx     # ficha em Sheet + histórico
      pessoas-view.tsx      # lista, busca, CRUD offline
    eventos/
      evento-schema.ts      # validação Zod de evento/inscrição + labels
      evento-form.tsx       # formulário de evento (RHF + shadcn)
      evento-detail.tsx     # ficha + inscritos + nova inscrição + QR
      eventos-view.tsx      # lista, busca, CRUD offline
    checkin/
      qr.ts                 # encode/decode payload do QR
      qr-scanner.tsx        # leitor nativo (BarcodeDetector) + fallback
      checkin-view.tsx      # tela de recepção: câmera, busca manual, ações
    termos/
      termo-schema.ts       # Zod + textos dos termos (responsabilidade/imagem)
      assinatura-canvas.tsx # canvas de assinatura (touch/mouse)
      termo-aceite-sheet.tsx # Sheet: texto + assinatura + aceite
      termos-view.tsx       # lista de termos aceitos + log LGPD
  hooks/
    use-online-status.ts
  db/
    repos/
      pessoas.ts            # repositório local (CRUD + histórico)
      eventos.ts            # repositório local (CRUD + inscrições)
      termos.ts             # repositório local (termos + assinaturas + log LGPD)
    db.ts                   # migrations do Dexie (IndexedDB)
    types.ts                # tipos locais (+ sync_status)
    queue.ts                # grava local (pending) + enfileira operações
    seed.ts                 # dados fake para testar sync/UI
  sync/
    engine.ts               # push/pull + resolução de conflito (LWW)
    supabase-transport.ts   # transporte Supabase
    worker.ts               # loop em background + syncNow()
  stores/
    sync-store.ts           # estado do sync (Zustand)
  lib/
    constants.ts · env.ts · env.server.ts · utils.ts
    cpf.ts                  # validação/formatacão de CPF
    format.ts               # telefone, datas, idade, menor
    auth/{roles,session,api}.ts  # RBAC, sessão e helpers de API
    supabase/{client,server,middleware,admin}.ts
  types/database.ts
  middleware.ts             # renovação de sessão + proteção de rotas
supabase/
  migrations/*.sql          # schema, RLS, storage e multitenant
  seed.sql                  # 10 pessoas, 2 eventos
prisma/
  schema.prisma             # schema de referência (modelagem)
scripts/
  generate-icons.mjs        # ícones PNG do PWA
  deploy.sh                 # build + PM2 (ou --docker)
  verify-*.ts               # smoke tests (dexie, sync, pessoas…)
Dockerfile · docker-compose.yml · ecosystem.config.js
infrastructure/             # (nginx etc.)
```

## Setup local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie o arquivo de ambiente a partir do exemplo:

   ```bash
   cp .env.example .env.local
   ```

   Preencha (Supabase → **Project Settings → API**):

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

   O código também aceita `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (chave nova).

3. Rode o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

   Abra <http://localhost:3000>.

> O service worker é desabilitado em `development`. Para testar o PWA/offline
> de verdade, use `npm run build && npm run start`.

## Conectar ao Supabase (ativar o sync real)

Sem Supabase o app roda **só offline** (o chip de sync fica *Pendente*). Para a
sincronização funcionar de verdade, siga os passos:

### 1. Criar o projeto

1. Acesse <https://supabase.com>, crie um projeto (guarde a senha do banco).
2. Em **Project Settings → API**, copie a **Project URL** e a chave **anon**
   (ou a **publishable key**, se o projeto usar as chaves novas).

### 2. Configurar as variáveis

```bash
cp .env.example .env.local
```

Preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Aplicar o schema

As migrations estão em `supabase/migrations/` e devem rodar **nesta ordem**:

1. `20260101000000_init_schema.sql` — tabelas, enums, índices, triggers.
2. `20260101000100_rls.sql` — RLS, papéis e criação de perfil por usuário.
3. `20260101000200_storage.sql` — buckets privados `documentos` e `assinaturas`.

**Opção A — SQL Editor (sem instalar nada):** abra o **SQL Editor** do painel e
cole o conteúdo de cada arquivo, rodando na ordem acima. Para dados de exemplo,
rode também `supabase/seed.sql`.

**Opção B — Supabase CLI:**

```bash
npm i -g supabase          # ou: brew install supabase/tap/supabase
supabase link --project-ref <seu-project-ref>
supabase db push           # aplica as migrations
```

### 4. Ajustar o login (Auth)

Para testar rápido, desative a confirmação de e-mail em **Authentication →
Sign In / Providers → Email → "Confirm email" = off**. (Com ela ligada, você
precisa clicar no link enviado por e-mail antes do primeiro login.)

### 5. Testar

1. `npm run build && npm run start` (ou `npm run dev`).
2. Acesse `/login` → aba **Criar conta** → cadastre o primeiro usuário
   (**ele vira `admin`** automaticamente via trigger).
3. Crie/edite pessoas e eventos. O chip no topo deve sair de **Pendente** para
   **Sincronizado** em poucos segundos.
4. Confirme os dados no painel do Supabase (**Table Editor**).
5. Abra em outro navegador/dispositivo: ao logar, os registros são baixados
   (pull).

> Captura de e-mail no plano gratuito é limitada; para produção, configure um
> provedor de SMTP próprio em Authentication → Emails.

## Scripts

| Comando             | Descrição                                  |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Servidor de desenvolvimento                |
| `npm run build`     | Build de produção (gera o service worker)  |
| `npm run start`     | Serve o build de produção                  |
| `npm run lint`      | ESLint                                     |
| `npm run typecheck` | TypeScript (`tsc --noEmit`)                |
| `npm run icons`     | Regenera os ícones do PWA em `public/icons`|
| `npm run db:verify` | Smoke test das migrations do Dexie (Node + fake-indexeddb) |
| `npm run sync:verify` | Testa o sync engine offline (push, pull, conflito, deletes) |
| `npm run pessoas:verify` | Testa CPF, schema e o repositório de pessoas (offline) |
| `npm run eventos:verify` | Testa schema e o repositório de eventos/inscrições (offline) |
| `npm run checkin:verify` | Testa QR encode/decode e o fluxo check-in/check-out (offline) |
| `npm run relatorios:verify` | Testa resumos, export CSV e gráfico de check-ins (offline) |
| `npm run termos:verify` | *(desabilitado)* conflito de schema cache no fake-indexeddb; testado via check-in |

## Banco de dados

### Supabase (Postgres + RLS)

Migrations em `supabase/migrations/`:

- `20260101000000_init_schema.sql` — enums, tabelas (`profiles`, `pessoas`,
  `menores`, `eventos`, `inscricoes`, `documentos`, `termos`,
  `log_acesso_dados`), índices e trigger de `updated_at`.
- `20260101000100_rls.sql` — criação automática de perfil no signup
  (primeiro usuário = `admin`), helpers `current_papel()` / `is_admin()` /
  `is_staff_or_admin()`, trigger que impede troca de papel por não-admin e
  todas as policies de RLS. Toda policy usa `(select auth.uid())` para evitar
  avaliação por linha.
- `20260101000200_storage.sql` — buckets privados `documentos` e `assinaturas`
  com policies de Storage.

Aplicando com a CLI do Supabase:

```bash
supabase link --project-ref <ref>
supabase db push          # aplica as migrations no projeto remoto
supabase db reset         # recria o banco local e roda supabase/seed.sql
```

`supabase/seed.sql` cria **10 pessoas** (1 menor com responsável), **2 eventos**
e inscrições de exemplo.

> Modelo de permissões: `admin` (total), `staff` (cadastro + eventos),
> `recepcao` (leitura + check-in/out). O RLS espelha isso no banco.

### Local (Dexie / IndexedDB)

`src/db/db.ts` define as migrations do banco local (`pers-eventos`), com os
índices que sustentam o modo offline:

- `[sync_status+updated_at]` — enfileira pendentes para envio.
- `updated_at` — pull incremental.
- `cpf`, `nome_completo`, `telefone`, `email` — busca local.
- `sync_queue` e `sync_cursor` — fila de operações e cursor de sincronização.
- `arquivos` — blobs (fotos/documentos) criados offline, enviados quando online.

`src/db/seed.ts` popula dados fake (`seedLocalDatabase()` / `clearLocalDatabase()`)
para testar sync e UI sem depender da rede.

Valide o schema local a qualquer momento:

```bash
npm run db:verify
```

## Sync (offline-first)

Fluxo (`src/sync/engine.ts` → `runSync`):

1. **Push** — lê `sync_queue` (uma operação por registro, edições colapsadas),
   envia na ordem de dependência de FK (`pessoas` → `eventos` → `menores` →
   `documentos` → `termos` → `inscricoes`) e marca o registro como `synced` com
   os dados devolvidos pelo servidor.
2. **Pull** — por tabela, baixa tudo com `updated_at > cursor`, aplica e avança
   `sync_cursor`. Atualizações em lote (`BATCH = 500`).

Resolução de conflito (**last-write-wins**, com proteção local):

- Registro com operação **pendente na fila nunca é sobrescrito** pelo remoto.
- Se o remoto for mais novo, o registro é marcado como `conflict` (visual) mas o
  valor local é preservado; o push seguinte faz o local vencer no servidor.
- Sem pendência local, o remoto é aplicado normalmente.

Status por registro (`sync_status`): `synced` · `pending` · `conflict` · `error`.

Worker (`src/sync/worker.ts`, iniciado pelo `SyncProvider` na área autenticada):

- Roda a cada 30s, ao reconectar (`online`) e ao voltar o foco da aba.
- `syncNow()` é exportado para gatilhos manuais (ex.: botão "sincronizar").
- Erros de rede abortam o ciclo sem perder a fila; erros permanentes (RLS,
  validação) marcam o item como `error` com `ultimo_erro`.

Limitação conhecida (v1): exclusões feitas em outro dispositivo não são
propagadas por pull (sem tombstones no servidor). A exclusão local é enviada ao
servidor normalmente.

Teste o motor sem a rede:

```bash
npm run sync:verify
```

## Módulo Pessoas (passo 4)

CRUD totalmente offline na rota única `/pessoas` (sem rotas dinâmicas — assim o
service worker precacheia o shell e o cadastro funciona sem rede).

- **Lista + busca** (`filtrarPessoas`) por nome, CPF ou telefone, direto do
  IndexedDB (`useLiveQuery`).
- **Formulário** (`pessoa-form.tsx`): React Hook Form + Zod. CPF/telefone
  validados e salvos só com dígitos; `consentimento_lgpd` obrigatório; visitante
  menor de 18 anos exige nome e CPF válido do responsável (linha em `menores`).
- **Ficha** (`pessoa-detail.tsx`): Sheet com dados, saúde/emergência,
  responsável e histórico de eventos (inscrições + evento).
- **Repositório** (`src/db/repos/pessoas.ts`): `savePessoa` preserva
  `created_at`, grava com `sync_status: "pending"` e enfileira via `queue.ts`;
  `deletePessoa` remove dependentes locais (menores, documentos, termos,
  inscrições, arquivos) junto com a pessoa.

Teste as regras de CPF, do schema e do repositório:

```bash
npm run pessoas:verify
```

## Módulo Eventos + inscrições (passo 5)

CRUD offline na rota única `/eventos` (mesma estratégia do módulo Pessoas).

- **Evento** (`evento-schema.ts` / `evento-form.tsx`): nome, descrição, início
  (obrigatório), término (≥ início), local, vagas (inteiro) e status
  (`planejado · aberto · lotado · realizado · cancelado`).
- **Inscrições** (dentro da ficha `evento-detail.tsx`): inscrever pessoas
  disponíveis (respeita a unicidade `evento_id + pessoa_id`), mudar o status
  (`inscrito → confirmado → checkin → checkout · cancelado`), valor/pagamento e
  remover. Placeholders de `checkin`/`checkout` já existem — o fluxo por QR vem
  no passo 6.
- **Capacidade**: a lista e a ficha mostram `inscritos / vagas` e sinalizam
  **Lotado** quando atinge o limite.
- **Repositório** (`src/db/repos/eventos.ts`): `saveEvento` preserva
  `created_at` e enfileira; `deleteEvento` remove inscrições e termos
  dependentes; `inscricoesPorEvento` alimenta as contagens da lista.

```bash
npm run eventos:verify
```

## Módulo Check-in por QR (passo 6)

Tela de recepção em `/checkin` totalmente offline:

- **Leitor nativo** (`qr-scanner.tsx`): usa `BarcodeDetector` (Chromium) + `getUserMedia`; sem dependências externas. Funciona offline.
- **Busca manual**: campo de texto aceita o payload do QR (`PERS1:<uuid>`), o UUID puro ou o nome do participante (busca em tempo real no IndexedDB).
- **Filtro por evento**: opcional, restringe a busca manual.
- **Ações**: ao selecionar uma inscrição, exibe cartão com dados da pessoa, evento, status atual e botões:
  - *Check-in* (quando `inscrito`/`confirmado`/`cancelado`);
  - *Check-out* (quando `checkin`);
  - *Nova entrada* (quando `checkout` — gera novo horário de check-in).
- **Gerador de QR** (na parte inferior): cola o UUID da inscrição e gera o QR para impressão/teste.
- **Reuso**: o QR também aparece no detalhe do evento (`evento-detail.tsx`) — botão de QR ao lado de cada inscrito.

```bash
npm run checkin:verify
```

## Módulo Termos + LGPD (passo 7)

Gestão de termos de responsabilidade e uso de imagem, com assinatura digital
offline e log de acesso a dados (LGPD).

- **Tipos de termo** (`termo-schema.ts`): `responsabilidade` e `imagem`, com
  textos pré-definidos.
- **Assinatura offline** (`assinatura-canvas.tsx`): canvas HTML5 (touch/mouse),
  exporta PNG base64; armazenado como blob no IndexedDB (`arquivos`).
- **Aceite** (`termo-aceite-sheet.tsx`): Sheet com texto rolável, canvas de
  assinatura, checkbox de concordância; grava `termos` + `arquivos` + `log_acesso_dados`
  (tudo `pending` para sync).
- **Integração check-in**: ao tentar fazer check-in, se a pessoa não aceitou o
  termo de responsabilidade do evento, abre o Sheet de aceite antes de prosseguir.
- **Visualização** (`termos-view.tsx`): lista de termos aceitos por pessoa,
  visualização/download da assinatura, log de acesso a dados (LGPD) com ação,
  timestamp, user_id e pessoa_id.

```bash
npm run termos:verify
```

> **Nota:** este script está temporariamente desabilitado no `package.json` devido a uma limitação do `fake-indexeddb` (cache global de schema). A funcionalidade de termos é exercitada pelo teste de integração do check-in (`npm run checkin:verify`).

## Multitenant + Níveis de acesso

O sistema é multitenant: cada **estabelecimento** é um tenant e todos os dados de
domínio (pessoas, eventos, inscrições, documentos, termos, logs) carregam
`tenant_id`, com RLS aplicando o isolamento. Há três níveis de acesso:

| Papel (`profiles.papel`) | AppRole | Rotas | Pode |
| ------------------------ | ------- | ----- | ---- |
| `super_admin`            | super_admin | `/admin/**` | CRUD de estabelecimentos, métricas globais, criar admins |
| `tenant_admin` / `admin` | tenant_admin | `/dashboard`, `/pessoas`, `/eventos`, `/checkin`, `/termos`, `/relatorios` | Tudo do tenant |
| `staff` / `recepcao`     | staff | `/dashboard`, `/pessoas`, `/eventos`, `/checkin`, `/termos` | Operação (sem relatórios) |
| `cliente`                | cliente | `/portal/**` | Cadastro, inscrição, QR Code, termos |

- O **middleware** (`src/lib/supabase/middleware.ts`) renova a sessão e aplica o
  RBAC por prefixo de rota (`src/lib/auth/roles.ts`). Sessão/perfil no servidor
  via `getSessionContext()` (`src/lib/auth/session.ts`, memoizado com React `cache`).
- `tenant_id` é carimbado automaticamente por trigger (`set_tenant_id()`); o
  `super_admin` pode gravar em qualquer tenant. Trocar `papel` é bloqueado por
  trigger (`prevent_papel_change`) exceto para o super admin.
- O cache local (Dexie/IndexedDB) é **limpo no logout** (`wipeLocalDatabase`) e o
  tenant ativo é gravado por `setActiveTenantId` (`src/db/tenant.ts`) para evitar
  vazamento de dados entre contas no mesmo dispositivo.
- APIs: `/api/me`, `/api/health`, `/api/admin/estabelecimentos[/:id]`,
  `/api/eventos[/:id]`, `/api/usuarios[/:id]`, `/api/portal/{perfil,eventos,inscricoes,termos}`.

### Aplicar as migrations

As migrations multitenant estão em `supabase/migrations/`
(`20260101000300`…`20260101000600`). Aplique com a Supabase CLI
(`supabase db push`) ou colando os arquivos, em ordem, no **SQL Editor** do
painel. Sem elas o app roda apenas offline (Dexie).

## Variáveis de ambiente

Copie `.env.example` para `.env.local` (dev) ou `.env` (produção):

| Variável | Uso |
| -------- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto (público) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (aceita ambas) |
| `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Chave secreta server-side (Admin API: criar usuários) |
| `PORT` | Porta do app (padrão `3010`) |

## Deploy na Vercel (recomendado)

O sistema é 100% serverless (Next.js API Routes + Supabase) — não requer servidores próprios, PM2 nem Docker.

### Configuração rápida (via Vercel Marketplace)

1. Importe o repositório na Vercel.
2. Adicione a integração **Supabase** pelo **Vercel Marketplace**
   (Storage/Integrations → Supabase). A integração injeta automaticamente
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e as variáveis
   de Postgres no projeto.
3. Em **Project → Settings → Environment Variables**, adicione a variável de
   servidor (não exposta ao browser):
   - `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`) — chave *service role*
     do Supabase, necessária para criar usuários via Admin API.
4. Para conexões Postgres serverless (se usar Prisma/ORM direto), use o
   **Transaction Pooler** do Supabase (porta **6543**).
5. Deploy: branch `main` → Production; demais branches → Preview.

### Configuração manual (sem integração Marketplace)

No painel da Vercel (**Project → Settings → Environment Variables**), defina
para **Production**, **Preview** e **Development**:

| Variável | Obrigatória | Onde obter |
| -------- | ----------- | ---------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` ou `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sim | Supabase → Settings → API → anon/public key |
| `SUPABASE_SECRET_KEY` (service role) | Sim* | Supabase → Settings → API → service_role secret |

\* Necessária para `/api/usuarios` (criar usuários) e Admin API.

> **Nota:** O Next.js lê automaticamente `.env.local` em desenvolvimento.
> Copie `.env.example` para `.env.local` e preencha.

### vercel.json

O arquivo `vercel.json` na raiz configura:
- Headers de segurança (CSP básico, X-Frame-Options, etc.)
- Cache estático para manifest e ícones PWA
- Tempo máximo de execução das API Routes (30s)

### Variáveis de build

O build usa `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou `PUBLISHABLE_KEY`) em tempo de compilação para injetar no bundle client-side. Certifique-se de que estão definidas nos ambientes de Preview/Production da Vercel.

## Como testar offline

1. Faça `npm run build && npm run start` e abra o app.
2. Aguarde a primeira carga (o service worker precacheia o shell).
3. Abra o **DevTools → Application → Service Workers** e confirme que está
   `activated`.
4. Vá em **DevTools → Network → selecione "Offline"**.
5. Navegue entre as páginas: o shell e as rotas cacheadas continuam
   funcionando; o banner **"Sem conexão"** aparece no topo. Uma rota sem cache
   cai no fallback `/offline`.
6. Desmarque "Offline": aparece um toast **"Conectado de novo"**.

> A flag `reloadOnOnline` do PWA recarrega a página quando a conexão volta,
> garantindo que a próxima navegação passe pelo `middleware` e renove a sessão
> do Supabase.

## Convenções

- Idioma da interface: **pt-BR**.
- Modo escuro via `next-themes` (`attribute="class"`, `defaultTheme="system"`).
- Acessibilidade: contraste AA, navegação por teclado e `aria-*` nos controles.
- Comentários apenas onde a lógica não é óbvia.
