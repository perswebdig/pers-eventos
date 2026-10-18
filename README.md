# PersEventos

Plataforma SaaS **multi-tenant** para cadastro de pessoas, eventos e check-in em
espaços que recebem visitantes em vivências na natureza (retiros, glamping,
sítios, fazendas, centros de terapia), com venda de ingressos e portal do cliente.

- **Next.js 15** (App Router) + TypeScript estrito
- **Tailwind CSS v4** + **shadcn/ui**
- **Backend** Supabase (Postgres + Auth + RLS) — fonte da verdade, 100% online
- **Formulários** React Hook Form + Zod
- **QR Code** `qrcode.react`
- **Multitenant** com RBAC (`super_admin`, `tenant_admin`, `staff`, `cliente`)
- **Deploy** Supabase Cloud + PM2/nginx

## Status

| Passo | Módulo                           | Situação     |
| ----- | -------------------------------- | ------------ |
| 1     | Setup do projeto                 | ✅ concluído |
| 2     | Schema Supabase                  | ✅ concluído |
| 3     | Fundação de dados online         | ✅ concluído |
| 4     | Cadastro de pessoas              | ✅ concluído |
| 5     | Eventos + inscrições             | ✅ concluído |
| 6     | Check-in por QR                  | ✅ concluído |
| 7     | Termos + LGPD                    | ✅ concluído |
| 8     | Relatórios                       | ✅ concluído |
| 9     | Polimento UX                     | ✅ concluído |
| 10    | Multitenant + 3 níveis de acesso | ✅ concluído |
| 11    | Deploy PM2/nginx (produção)      | ✅ concluído |
| 12    | Financeiro + Ingressos           | ✅ concluído |
| 13    | Feed público + portal do cliente | ✅ concluído |

> **Auth + perfis**: login por e-mail/senha. O **primeiro usuário** vira
> `super_admin` (trigger `handle_new_user`); os demais entram como `cliente`.
> Papéis e vínculo de tenant são definidos em `profiles` (ver "Multitenant").

## Estrutura de pastas

```
src/
  app/
    layout.tsx              # shell raiz: tema e toaster
    page.tsx                # landing
    (app)/                  # área autenticada do tenant (com AppHeader)
      layout.tsx
      dashboard|pessoas|eventos|checkin|relatorios|termos/page.tsx
      pedidos/page.tsx · usuarios/page.tsx
    admin/                  # Super Admin (super_admin)
      layout.tsx · page.tsx · estabelecimentos/page.tsx
    portal/                 # Portal do Cliente (cliente)
      layout.tsx · page.tsx
      cadastro|eventos|ingressos|qr|termos/page.tsx
    api/                    # Route Handlers (RBAC + RLS)
      me · health
      admin/estabelecimentos[/:id]
      pessoas[/:id] · eventos[/:id] · eventos/:id/inscricoes
      inscricoes[/:id] · inscricoes/:id/{checkin,checkout}
      tickets · tickets/:id/checkin
      termos · logs-acesso · relatorios · relatorios/exportar
      usuarios[/:id]
      tenant/{ticket-types,espacos,pedidos,pessoas}
      portal/{perfil,eventos,inscricoes,termos,pedidos,checkout,reservas,espacos}
      checkout · webhooks/payment
    login|onboarding/page.tsx
  components/
    ui/                     # shadcn/ui
    app-header.tsx · bottom-nav.tsx · stat-card.tsx · status-badge.tsx
    charts.tsx · data-table.tsx · empty-state.tsx · theme-provider.tsx
  features/
    auth/auth-form.tsx      # entrar / criar conta (Supabase Auth)
    admin/                  # UI do Super Admin
    portal/                 # UI do Cliente (feed, checkout, carteira)
    pessoas/
      pessoa-schema.ts      # validação Zod (+ regras de menor/LGPD)
      pessoa-form.tsx · pessoa-detail.tsx · pessoas-view.tsx · busca.ts
    eventos/
      evento-schema.ts · evento-form.tsx
      evento-detail.tsx     # ficha + inscritos + nova inscrição + QR
      eventos-view.tsx
    ingressos/              # lotes + mapa de assentos
    checkin/
      qr.ts                 # encode/decode payload do QR
      qr-scanner.tsx        # leitor nativo (BarcodeDetector)
      checkin-view.tsx      # recepção: câmera, busca manual, ações
    termos/
      termo-schema.ts · assinatura-canvas.tsx
      termo-aceite-sheet.tsx · termos-view.tsx
    pedidos/                # pedidos do tenant (confirmar/cancelar)
    relatorios/             # resumos + exportação CSV + gráficos
  lib/
    constants.ts · env.ts · env.server.ts · utils.ts · csv.ts
    cpf.ts · format.ts
    auth/{roles,session,api}.ts  # RBAC, sessão e helpers de API
    supabase/{client,server,middleware,admin}.ts
  types/database.ts
  middleware.ts             # renovação de sessão + proteção de rotas
supabase/
  migrations/*.sql          # schema, RLS, storage, ticketing e feed
  seed.sql                  # 10 pessoas, 2 eventos
prisma/
  schema.prisma             # schema de referência (modelagem)
scripts/
  generate-icons.mjs        # ícones PNG (favicon)
  deploy.sh                 # build + restart do PM2
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

## Conectar ao Supabase

Sem Supabase configurado o login fica bloqueado — o app depende do backend
(Postgres + Auth) para tudo. Para funcionar, siga os passos:

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

As migrations estão em `supabase/migrations/` e devem rodar **nesta ordem**
(13 arquivos, de `20260101000000` a `20260101001200`):

1. `20260101000000_init_schema.sql` — tabelas, enums, índices, triggers.
2. `20260101000100_rls.sql` — RLS, papéis e criação de perfil por usuário.
3. `20260101000200_storage.sql` — buckets privados `documentos` e `assinaturas`.
4. Demais migrações (`…0300` a `…1200`) — multitenant, atendimento, mapa de
   assentos, ticketing/financeiro, pedidos e feed público.

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
   (**ele vira `super_admin`** automaticamente via trigger).
3. Crie/edite pessoas e eventos — tudo é gravado direto no Supabase.
4. Confirme os dados no painel do Supabase (**Table Editor**).
5. Abra em outro navegador/dispositivo: ao logar, os mesmos registros aparecem.

> Captura de e-mail no plano gratuito é limitada; para produção, configure um
> provedor de SMTP próprio em Authentication → Emails.

## Scripts

| Comando                  | Descrição                                    |
| ------------------------ | -------------------------------------------- |
| `npm run dev`            | Servidor de desenvolvimento                  |
| `npm run build`          | Build de produção                            |
| `npm run start`          | Serve o build de produção                    |
| `npm run lint`           | ESLint                                       |
| `npm run typecheck`      | TypeScript (`tsc --noEmit`)                  |
| `npm run icons`          | Regenera os ícones em `public/icons`         |
| `npm run test`           | Testes unitários (Vitest)                    |
| `npm run e2e`            | Smoke tests E2E (Playwright)                 |
| `npm run deploy`         | Build + restart do PM2 + health check        |
| `npm run format`         | Prettier (`--write`)                         |
| `npm run bundle:analyze` | Analisa o bundle (`ANALYZE=true next build`) |

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

> Modelo de permissões: `tenant_admin` (total), `staff` (cadastro + eventos +
> check-in), `cliente` (portal). O RLS espelha isso no banco.

## Módulo Pessoas (passo 4)

CRUD na rota `/pessoas`, com todos os dados vindos da API (`/api/pessoas`).

- **Lista + busca** (`filtrarPessoas`) por nome, CPF ou telefone.
- **Formulário** (`pessoa-form.tsx`): React Hook Form + Zod. CPF/telefone
  validados e salvos só com dígitos; `consentimento_lgpd` obrigatório; visitante
  menor de 18 anos exige nome e CPF válido do responsável (linha em `menores`).
- **Ficha** (`pessoa-detail.tsx`): Sheet com dados, saúde/emergência,
  responsável e histórico de eventos (inscrições + evento).
- **API**: `GET/POST /api/pessoas`, `GET/PATCH/DELETE /api/pessoas/:id`
  (o detalhe devolve `{ pessoa, menor, historico }`).

## Módulo Eventos + inscrições (passo 5)

CRUD na rota `/eventos` (lista com contagem de inscritos por evento).

- **Evento** (`evento-schema.ts` / `evento-form.tsx`): nome, descrição, início
  (obrigatório), término (≥ início), local, vagas (inteiro) e status
  (`planejado · aberto · lotado · realizado · cancelado`).
- **Inscrições** (dentro da ficha `evento-detail.tsx`): inscrever pessoas
  disponíveis (respeita a unicidade `evento_id + pessoa_id`), mudar o status
  (`inscrito → confirmado → checkin → checkout · cancelado`), valor/pagamento e
  remover.
- **Capacidade**: a lista e a ficha mostram `inscritos / vagas` e sinalizam
  **Lotado** quando atinge o limite.
- **API**: `GET /api/eventos` (com `inscricoes(count)`), `GET/PATCH/DELETE
/api/eventos/:id` (detalhe com `{ inscritos, disponiveis, vendas }`),
  `POST /api/eventos/:id/inscricoes`, `PATCH/DELETE /api/inscricoes/:id`.

## Módulo Check-in por QR (passo 6)

Tela de recepção em `/checkin`, com validação online em tempo real:

- **Leitor nativo** (`qr-scanner.tsx`): usa `BarcodeDetector` (Chromium) + `getUserMedia`; sem dependências externas.
- **Busca manual**: campo de texto aceita o payload do QR (`PERS1:<uuid>`), o UUID puro ou o nome do participante (via `/api/inscricoes?busca=`).
- **Filtro por evento**: opcional, restringe a busca manual.
- **Ações**: ao selecionar uma inscrição, exibe cartão com dados da pessoa, evento, status atual e botões:
  - _Check-in_ (quando `inscrito`/`confirmado`/`cancelado`);
  - _Check-out_ (quando `checkin`);
  - _Nova entrada_ (quando `checkout` — gera novo horário de check-in).
- **Ingressos**: o leitor também aceita `PERS2:<hash>` (`GET /api/tickets?hash=`)
  e faz check-in via `POST /api/tickets/:id/checkin` (idempotente).
- **Gerador de QR** (na parte inferior): cola o UUID da inscrição e gera o QR para impressão/teste.
- **Reuso**: o QR também aparece no detalhe do evento (`evento-detail.tsx`) — botão de QR ao lado de cada inscrito.

## Módulo Termos + LGPD (passo 7)

Gestão de termos de responsabilidade e uso de imagem, com assinatura digital e
log de acesso a dados (LGPD).

- **Tipos de termo** (`termo-schema.ts`): `responsabilidade` e `imagem`, com
  textos pré-definidos.
- **Assinatura** (`assinatura-canvas.tsx`): canvas HTML5 (touch/mouse), exporta
  PNG; enviado a `POST /api/termos` e armazenado no bucket privado `assinaturas`
  (path `termos/{id}.png`).
- **Aceite** (`termo-aceite-sheet.tsx`): Sheet com texto rolável, canvas de
  assinatura e checkbox de concordância; grava `termos` + `log_acesso_dados`.
- **Integração check-in**: ao tentar fazer check-in, se a pessoa não aceitou o
  termo de responsabilidade do evento, abre o Sheet de aceite antes de prosseguir.
- **Visualização** (`termos-view.tsx`): lista de termos aceitos por pessoa,
  visualização/download da assinatura via signed URL, log de acesso a dados
  (LGPD) com ação, timestamp, user_id e pessoa_id.

## Multitenant + Níveis de acesso

O sistema é multitenant: cada **estabelecimento** é um tenant e todos os dados de
domínio (pessoas, eventos, inscrições, documentos, termos, logs) carregam
`tenant_id`, com RLS aplicando o isolamento. Há três níveis de acesso:

| Papel (`profiles.papel`) | AppRole      | Rotas                                                                      | Pode                                                     |
| ------------------------ | ------------ | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| `super_admin`            | super_admin  | `/admin/**`                                                                | CRUD de estabelecimentos, métricas globais, criar admins |
| `tenant_admin` / `admin` | tenant_admin | `/dashboard`, `/pessoas`, `/eventos`, `/checkin`, `/termos`, `/relatorios` | Tudo do tenant                                           |
| `staff` / `recepcao`     | staff        | `/dashboard`, `/pessoas`, `/eventos`, `/checkin`, `/termos`                | Operação (sem relatórios)                                |
| `cliente`                | cliente      | `/portal/**`                                                               | Cadastro, inscrição, QR Code, termos                     |

- O **middleware** (`src/lib/supabase/middleware.ts`) renova a sessão e aplica o
  RBAC por prefixo de rota (`src/lib/auth/roles.ts`). Sessão/perfil no servidor
  via `getSessionContext()` (`src/lib/auth/session.ts`, memoizado com React `cache`).
- `tenant_id` é carimbado automaticamente por trigger (`set_tenant_id()`); o
  `super_admin` pode gravar em qualquer tenant. Trocar `papel` é bloqueado por
  trigger (`prevent_papel_change`) exceto para o super admin.
- APIs: `/api/me`, `/api/health`, `/api/admin/estabelecimentos[/:id]`,
  `/api/pessoas[/:id]`, `/api/eventos[/:id]`, `/api/inscricoes[/:id]`,
  `/api/tickets`, `/api/termos`, `/api/logs-acesso`, `/api/relatorios[/exportar]`,
  `/api/usuarios[/:id]`, `/api/tenant/{ticket-types,espacos,pedidos,pessoas}`,
  `/api/portal/{perfil,eventos,inscricoes,termos,pedidos,checkout,reservas,espacos}`,
  `/api/checkout`, `/api/webhooks/payment`.

### Aplicar as migrations

As migrations estão em `supabase/migrations/`. Aplique com a Supabase CLI
(`supabase db push`) ou colando os arquivos, em ordem, no **SQL Editor** do
painel.

## Módulo Financeiro + Ingressos (passo 12)

Venda de ingressos com lotes, checkout do cliente e check-in na recepção:

- **Tabelas** (`20260101000700_ticketing_finance.sql`): `ticket_types` (lotes),
  `orders` (pedidos, `pending` → `paid`/`canceled`/`refunded`) e `tickets`
  (ingressos individuais com `qr_code_hash` único). RLS por tenant, como o resto.
- **Admin**: no detalhe do evento há a seção **Lotes de ingressos** (criar,
  editar, pausar, excluir; bloqueado excluir com vendas) via
  `/api/tenant/ticket-types`.
- **Cliente**: `/portal/eventos/:id` (checkout — lote, quantidade, Pix/cartão) e
  `/portal/ingressos` (carteira com QR Code `PERS2:<hash>` por ingresso).
- **Pagamento**: `POST /api/webhooks/payment` (header `x-webhook-secret` com
  `PAYMENT_WEBHOOK_SECRET`) confirma o pedido de forma atômica e idempotente via
  RPC `confirm_order_payment`, gerando um ingresso por unidade comprada.
  `payment_failed` cancela o pedido.
- **Recepção**: o leitor aceita inscrições (`PERS1:<uuid>`) e ingressos
  (`PERS2:<hash>`), com check-in validado online e idempotente.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` (dev) ou `.env` (produção):

| Variável                                                                 | Uso                                                         |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                               | URL do projeto (público)                                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (aceita ambas)                                |
| `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`                      | Chave secreta server-side (Admin API: criar usuários)       |
| `PAYMENT_WEBHOOK_SECRET`                                                 | Segredo do webhook de pagamento (header `x-webhook-secret`) |
| `PORT`                                                                   | Porta do app (padrão `3010`)                                |

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
   - `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`) — chave _service role_
     do Supabase, necessária para criar usuários via Admin API.
4. Para conexões Postgres serverless (se usar Prisma/ORM direto), use o
   **Transaction Pooler** do Supabase (porta **6543**).
5. Deploy: branch `main` → Production; demais branches → Preview.

### Configuração manual (sem integração Marketplace)

No painel da Vercel (**Project → Settings → Environment Variables**), defina
para **Production**, **Preview** e **Development**:

| Variável                                                                  | Obrigatória | Onde obter                                      |
| ------------------------------------------------------------------------- | ----------- | ----------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                                | Sim         | Supabase → Settings → API → Project URL         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` ou `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sim         | Supabase → Settings → API → anon/public key     |
| `SUPABASE_SECRET_KEY` (service role)                                      | Sim*        | Supabase → Settings → API → service_role secret |

\* Necessária para `/api/usuarios` (criar usuários) e Admin API.

> **Nota:** O Next.js lê automaticamente `.env.local` em desenvolvimento.
> Copie `.env.example` para `.env.local` e preencha.

### Variáveis de build

O build usa `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou `PUBLISHABLE_KEY`) em tempo de compilação para injetar no bundle client-side. Certifique-se de que estão definidas nos ambientes de Preview/Production da Vercel.

## Convenções

- Idioma da interface: **pt-BR**.
- Modo escuro via `next-themes` (`attribute="class"`, `defaultTheme="system"`).
- Acessibilidade: contraste AA, navegação por teclado e `aria-*` nos controles.
- Comentários apenas onde a lógica não é óbvia.
