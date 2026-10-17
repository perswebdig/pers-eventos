# PersEventos — Funcionalidades implementadas

> Resumo do estado do produto em 17/10/2026 (v1). Complementa `docs/PLANO-COMERCIAL.md` (o que falta para comercializar).

## 1. Visão geral

Plataforma SaaS multi-tenant para gestão de eventos: cadastro de pessoas, eventos com lotes, venda de ingressos, check-in com QR Code **offline-first** (funciona sem internet e sincroniza depois), termos de LGPD com assinatura, portal do cliente e relatórios com exportação. PWA instalável mobile-first.

## 2. Arquitetura técnica

| Camada | Tecnologia |
|---|---|
| Front-end | Next.js (App Router), React 19, Tailwind CSS v4, shadcn/base-ui, next-themes |
| Back-end | Rotas de API Next.js + Supabase (Postgres, Auth, Storage, RLS multi-tenant) |
| Offline | Dexie/IndexedDB no cliente + fila de sync + service worker (Workbox) |
| Dados locais | Repositórios em `src/db/repos/*` espelhando tabelas para leitura offline |
| Sync | `src/sync/engine.ts` (push/pull com retry e conflito), `worker.ts`, fila de check-ins |
| Pagamentos | Checkout cria `orders`; confirmação via webhook genérico (`x-webhook-secret`) + RPC `confirm_order_payment` |
| Deploy | PM2 single-instance (porta 3010), `scripts/deploy.sh` (build + restart + health check) |

## 3. Papéis e acessos

- **super_admin** — dono da plataforma: gere estabelecimentos e usuários de qualquer tenant.
- **tenant_admin** — dono do estabelecimento: tudo do tenant, usuários e relatórios.
- **staff** — operação: pessoas, eventos, recepção, termos, relatórios de operação.
- **recepcao** — papel legado de portaria (check-in).
- **cliente** — portal do cliente: eventos, inscrições, compra, ingressos, QR, termos.

RLS por `tenant_id` em todas as tabelas; primeiro usuário criado no sistema vira `super_admin` automaticamente (trigger `handle_new_user`).

## 4. Funcionalidades por módulo

### 4.1 Autenticação e cadastro
- Login e cadastro por e-mail/senha (Supabase Auth), página `/login` com tema azul/prata.
- Onboarding self-service (`/onboarding`): cria estabelecimento + usuário administrador (slug automático).
- Sessão server-side com guards por papel (`requireRole`/`apiSession`).

### 4.2 Administração da plataforma (super admin)
- CRUD de estabelecimentos (nome, slug, endereço, ativo) em `/admin/estabelecimentos`.
- Gestão de usuários e papéis por estabelecimento (`/admin/usuarios`, `/api/usuarios`).

### 4.3 Pessoas
- Cadastro completo com CPF validado, nascimento, contato, endereço, observações.
- Detecção de menor de idade e vínculo de responsável.
- Documentos anexados (Storage, bucket `documentos`).
- Busca, paginação e ficha da pessoa com histórico.

### 4.4 Eventos e lotes
- CRUD de eventos (nome, descrição, local, datas, capacidade, status: rascunho/planejado/lotado/realizado/cancelado).
- Lotes de ingressos (`ticket_types`) com preço, quantidade total/vendida e janela de vendas.
- Página de detalhe com abas **Inscritos** e **Ingressos**, resumo de ocupação e confirmações de ação.

### 4.5 Ingressos e vendas
- Inscrições em eventos (portal) com status: inscrito, confirmado, check-in, check-out, cancelado.
- Checkout com escolha de lote, quantidade e forma de pagamento (Pix/cartão como intenção).
- Pedidos (`orders`): pending/paid/canceled/refunded; confirmação idempotente via webhook que gera os ingressos com `qr_code_hash` único (RPC `confirm_order_payment`).
- Carteira de ingressos no portal com QR por ingresso e status (válido/utilizado).

### 4.6 Recepção / check-in (offline-first)
- Leitor de QR Code pela câmera + leitura manual do código.
- Validação local contra a base Dexie — funciona **sem internet**.
- Fila local de check-ins com sync automático e idempotente (`/api/tenant/check-in/sync`, máx. 500/lote).
- Feedback visual e sonoro no scan (sucesso/atenção/erro), vibração no mobile, chip de pendências por sincronizar.
- Ticket-card com ações de liberar entrada e feedback de "já utilizado/não encontrado".

### 4.7 Termos e LGPD
- Termos de responsabilidade e uso de imagem com texto versionado.
- Aceite no portal e na recepção, com assinatura desenhada em canvas (bucket `assinaturas`).
- Log de acesso a dados (`log_acesso_dados`) para auditoria LGPD.
- Exportação de relatórios de termos e logs.

### 4.8 Portal do cliente
- `/portal` — visão geral com atalhos e alerta de cadastro incompleto.
- Eventos abertos com busca, inscrição em um toque e compra de ingressos.
- Checkout guiado: seleção de lote em cartões, stepper de quantidade, Pix/cartão, resumo fixo no mobile, tela de sucesso.
- Meus Ingressos: pedidos com QR Codes em cartões estilo ticket.
- Meu QR Code: QR de inscrição por evento para check-in.
- Termos & LGPD: aceite com status, e edição do próprio cadastro.

### 4.9 Relatórios
- Resumos (IndexedDB local): pessoas, eventos, inscrições, termos e logs de acesso.
- Gráficos: movimento diário de check-ins/check-outs (30 dias) e donut de inscrições por status.
- Exportação CSV de todas as bases.

### 4.10 Offline-first e PWA
- Service worker com cache de assets e página de fallback `/offline`.
- Indicador de status de conexão/sincronização no header (badge/chip com pendências).
- Sync em duas vias (push/pull) por entidade com tratamento de conflito e retry.
- Manifest PWA com ícones gerados; instalável em Android/iOS.

### 4.11 Interface e design system
- Tema **azul/prata futurista dark-first** (contraste AAA nas cores de texto), sem verde: sucesso = ciano.
- Componentes próprios: `PageContainer`, `PageHeader`, `SectionCard`, `StatCard`, `StatusBadge`, `DataTable`, `Toolbar`, `ConfirmDialog`, `EmptyState`.
- Gráficos SVG próprios (`Donut`, `BarList`, `Sparkline`) sem dependência externa.
- Bottom tab bar no mobile (5 abas + sheet "Mais") e header com indicador de página ativa.
- Toasts neutros (sonner), tema com toggle claro/escuro.

## 5. Operação e infraestrutura

- **Deploy**: `npm run deploy` — build de produção, restart PM2 e health check em `/api/health`.
- **Banco**: 9 migrações versionadas (`supabase/migrations/`) cobrindo schema, RLS, storage, multi-tenant, ticketing/financeiro e confirmação de pagamento.
- **Scripts de verificação**: `verify-dexie`, `verify-sync`, `verify-pessoas`, `verify-eventos`, `verify-checkin`, `verify-ingressos`, `verify-relatorios`, `verify-termos`.
- **Correção crítica aplicada**: `postcss.config.js` restaurado (`@tailwindcss/postcss`) — o build de produção não processava Tailwind (CSS quebrado mascarado pelo cache do service worker).

## 6. Qualidade

- 53 testes unitários (vitest) — utils, repositórios Dexie, ingressos.
- 10 testes e2e (Playwright) — smoke de rotas públicas/protegidas, health, manifest, service worker e fallback offline.
- Lint 0 erros, typecheck limpo, Prettier aplicado.
- Revisão visual via screenshots (landing, login, dashboard, pessoas, eventos, recepção, portal nas versões desktop e mobile).

## 7. Limitações conhecidas (próximo ciclo)

- Pagamento é apenas intenção — falta PSP real (Pix/cartão) e conciliação.
- Sem cobrança de assinatura dos estabelecimentos (planos/limites).
- Sem e-mails transacionais (confirmação de compra, reset de senha) e sem notificações WhatsApp.
- Venda exige login — falta página pública do evento com checkout guest.
- Sem cupons, meia-entrada, reembolso automático e transferência de ingresso.
- Sem CI/CD, staging e monitoramento de erros; deploy manual por script.
- Recuperação de senha depende de SMTP do Supabase (não configurado).

> Detalhamento das lacunas e roadmap em `docs/PLANO-COMERCIAL.md`.
