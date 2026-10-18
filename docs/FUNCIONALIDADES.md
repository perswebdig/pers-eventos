# PersEventos — Funcionalidades implementadas

> Resumo do estado do produto em 18/10/2026 (v1). Complementa `docs/PLANO-COMERCIAL.md` (o que falta para comercializar).

## 1. Visão geral

Plataforma SaaS multi-tenant para gestão de eventos: cadastro de pessoas, eventos com lotes, venda de ingressos, check-in com QR Code, termos de LGPD com assinatura, portal do cliente e relatórios com exportação. Operação **100% online** (Supabase como fonte da verdade).

## 2. Arquitetura técnica

| Camada     | Tecnologia                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Front-end  | Next.js (App Router), React 19, Tailwind CSS v4, shadcn/base-ui, next-themes                                |
| Back-end   | Rotas de API Next.js + Supabase (Postgres, Auth, Storage, RLS multi-tenant)                                 |
| Dados      | Sem cache local: telas leem/escrevem direto nas APIs (`/api/*`) com RLS por tenant                          |
| Pagamentos | Checkout cria `orders`; confirmação via webhook genérico (`x-webhook-secret`) + RPC `confirm_order_payment` |
| Deploy     | PM2 single-instance (porta 3010), `scripts/deploy.sh` (build + restart + health check)                      |

## 3. Papéis e acessos

- **super_admin** — dono da plataforma: gere estabelecimentos e usuários de qualquer tenant.
- **tenant_admin** — dono do estabelecimento: tudo do tenant, usuários e relatórios.
- **staff** — operação: pessoas, eventos, recepção, termos, relatórios de operação.
- **recepcao** — papel legado de portaria (check-in).
- **cliente** — portal do cliente: feed de eventos de todos os estabelecimentos, inscrições, compra, ingressos, QR, termos.

RLS por `tenant_id` em todas as tabelas; primeiro usuário criado no sistema vira `super_admin` automaticamente (trigger `handle_new_user`). Clientes podem pertencer a vários estabelecimentos (`pessoa_estabelecimentos`) e **não precisam escolher um estabelecimento ativo**: navegam pelo catálogo público (eventos abertos de estabelecimentos ativos) e o vínculo com cada estabelecimento nasce da inscrição/compra (trigger `auto_vincular_pessoa`), mantendo todos os ingressos visíveis na carteira.

## 4. Funcionalidades por módulo

### 4.1 Autenticação e cadastro

- Login e cadastro por e-mail/senha (Supabase Auth), página `/login` com tema azul/prata.
- Onboarding self-service (`/onboarding`): cria estabelecimento + usuário administrador (slug automático).
- Sessão server-side com guards por papel (`requireRole`/`apiSession`).

### 4.2 Administração da plataforma (super admin)

- CRUD de estabelecimentos (nome, slug, endereço, ativo) em `/admin/estabelecimentos`.
- Listagem com **busca** (nome, slug, cidade/UF) e **métricas por estabelecimento** (pessoas na base, eventos e pedidos).
- Gestão de usuários e papéis por estabelecimento (`/admin/usuarios`, `/api/usuarios`).

### 4.3 Pessoas

- Cadastro completo com CPF validado, nascimento, contato, endereço, observações.
- Detecção de menor de idade e vínculo de responsável.
- Documentos anexados (Storage, bucket `documentos`).
- Busca, paginação e ficha da pessoa com histórico.
- **Vincular pessoa existente** por CPF ou e-mail: adiciona à base do estabelecimento alguém que já usa a plataforma (RPC `vincular_pessoa`), sem duplicar cadastro.
- Base de clientes por estabelecimento (`pessoa_estabelecimentos`): pessoas criadas, vinculadas, inscritas ou que compraram entram automaticamente na base; a equipe enxerga e edita essas pessoas mesmo que elas naveguem em outro estabelecimento.

### 4.4 Eventos e lotes

- CRUD de eventos (nome, descrição, local, datas, capacidade, status: rascunho/planejado/lotado/realizado/cancelado).
- Lotes de ingressos (`ticket_types`) com preço, quantidade total/vendida e janela de vendas.
- Página de detalhe com abas **Inscritos**, **Ingressos** e **Espaços**, resumo de ocupação e confirmações de ação.

### 4.4.1 Espaços com lugar marcado

- Espaços (`espacos`) = setores do evento com preço único e cadeiras numeradas geradas em grade (fileiras A–Z × cadeiras por fileira, máx. 26 × 200).
- Aba **Espaços** no detalhe do evento: criação com preview da grade, pausar/reativar, excluir (bloqueado se houver lugares reservados/vendidos) e mapa de ocupação ao vivo (livre/reservado/vendido).
- Portal: escolha obrigatória de cadeira no mapa, de 1 a 10 lugares, com legenda de status.
- Reserva de **30 minutos** (`reservar_assentos`): cadeiras ficam em `reservado` até a confirmação; reservas vencidas voltam a ficar livres automaticamente (`liberar_reservas_expiradas`, chamada nas leituras).
- Confirmação de pagamento vincula cada ingresso à sua cadeira (fileira/número) e marca como vendido (`confirm_order_payment`); falha de pagamento libera as cadeiras na hora.
- Espaços/assentos e lotes são controlados pelo servidor (inventário online).

### 4.5 Ingressos e vendas

- Inscrições em eventos (portal) com status: inscrito, confirmado, check-in, check-out, cancelado.
- Checkout com escolha de lote, quantidade e forma de pagamento (Pix/cartão como intenção) — ou **ambiente** (espaço/setor) com lugar marcado, destacado no resumo da compra e na tela de sucesso.
- Pedidos (`orders`): pending/paid/canceled/refunded; confirmação idempotente via webhook que gera os ingressos com `qr_code_hash` único (RPC `confirm_order_payment`).
- Tela **Pedidos** (`/pedidos`, equipe do estabelecimento): lista com busca por cliente/evento e filtros por status, mostrando cliente, evento, item (lote ou ambiente), valor e forma de pagamento.
- **Modo demonstração** (`DEMO_MODE=true`): sem PSP real, o cliente confirma o próprio pagamento no checkout ("Confirmar pagamento (demo)") e a equipe aprova/cancela pedidos na tela Pedidos — confirmação gera os ingressos; cancelamento devolve as cadeiras reservadas à venda. Com `DEMO_MODE` desativado, as rotas respondem 403 e o fluxo fica aguardando o webhook.
- Carteira de ingressos no portal com QR por ingresso, status (válido/utilizado) e setor/fileira/número quando for lugar marcado.

### 4.6 Recepção / check-in (online)

- Leitor de QR Code pela câmera + leitura manual do código.
- Validação online contra as APIs (`/api/tickets?hash=`, `/api/inscricoes/:id`, busca por nome) — cartões de ação refletem o status atual do banco.
- Check-in/check-out idempotentes (`POST /api/tickets/:id/checkin`, `POST /api/inscricoes/:id/{checkin,checkout}`).
- Feedback visual no scan (sucesso/atenção/erro) e vibração no mobile.
- Ticket-card com ações de liberar entrada e feedback de "já utilizado/não encontrado".

### 4.7 Termos e LGPD

- Termos de responsabilidade e uso de imagem com texto versionado.
- Aceite no portal e na recepção, com assinatura desenhada em canvas (bucket `assinaturas`).
- Log de acesso a dados (`log_acesso_dados`) para auditoria LGPD.
- Exportação de relatórios de termos e logs.

### 4.8 Portal do cliente

- `/portal` — **feed público**: eventos abertos/planejados de todos os estabelecimentos ativos, com busca (evento, local, estabelecimento), data, local, estabelecimento e preço "a partir de"; inscrição em um toque e compra em cartões. Cadastro incompleto exibe alerta com link.
- **Sem seletor de estabelecimento**: o cliente não escolhe mais um "estabelecimento ativo"; o catálogo é cross-tenant (RLS libera eventos/lotes/espaços/cadeiras públicos) e o vínculo nasce automaticamente da inscrição/compra.
- Eventos abertos com busca, inscrição em um toque e compra de ingressos.
- Checkout guiado: seleção de lote em cartões, stepper de quantidade, Pix/cartão, resumo fixo no mobile, tela de sucesso.
- Meus Ingressos: pedidos com QR Codes em cartões estilo ticket.
- Meu QR Code: QR de inscrição por evento para check-in.
- Termos & LGPD: aceite com status, e edição do próprio cadastro.

### 4.9 Relatórios

- Resumos via `GET /api/relatorios`: pessoas, eventos, inscrições, termos e logs de acesso do estabelecimento.
- Gráficos: movimento diário de check-ins/check-outs (30 dias) e donut de inscrições por status.
- Exportação CSV de todas as bases (`GET /api/relatorios/exportar?tipo=…`).

### 4.10 Sem modo offline

- O app é **online-only**: as telas do tenant leem/escrevem diretamente nas APIs com RLS (sem Dexie/IndexedDB, sem fila de sync, sem service worker/PWA).
- Não há mais instalação PWA, chip de sincronização nem página de fallback offline.

### 4.11 Interface e design system

- Tema **azul/prata futurista dark-first** (contraste AAA nas cores de texto), sem verde: sucesso = ciano.
- Componentes próprios: `PageContainer`, `PageHeader`, `SectionCard`, `StatCard`, `StatusBadge`, `DataTable`, `Toolbar`, `ConfirmDialog`, `EmptyState`.
- Gráficos SVG próprios (`Donut`, `BarList`, `Sparkline`) sem dependência externa.
- Bottom tab bar no mobile (5 abas + sheet "Mais") e header com indicador de página ativa.
- Toasts neutros (sonner), tema com toggle claro/escuro.

## 5. Operação e infraestrutura

- **Deploy**: `npm run deploy` — build de produção, restart PM2 e health check em `/api/health`.
- **Produção**: `https://eventos.persweb.digital` (nginx com proxy para `127.0.0.1:3010` + certificado Let's Encrypt; HTTP redireciona para HTTPS).
- **Variáveis de ambiente relevantes**: `DEMO_MODE=true` ativa o modo demonstração de pagamentos (ver 4.5).
- **Banco**: 13 migrações versionadas (`supabase/migrations/`) cobrindo schema, RLS, storage, multi-tenant, ticketing/financeiro, confirmação de pagamento, guarda do trigger de papel (service role), espaços/assentos, vínculo pessoas ⇄ estabelecimentos e catálogo público (feed).
- **Scripts**: `npm run test` (Vitest), `npm run e2e` (Playwright) e `npm run deploy`.
- **Correção crítica aplicada**: `postcss.config.js` restaurado (`@tailwindcss/postcss`) — o build de produção não processava Tailwind (CSS quebrado mascarado pelo cache do navegador).

## 6. Qualidade

- 44 testes unitários (vitest) — utils/CPF, schemas de pessoa/evento, QR de check-in, mapa de assentos e vínculo de pessoas.
- 7 testes e2e (Playwright) — smoke de rotas públicas/protegidas, health e autenticação das APIs.
- Lint 0 erros, typecheck limpo, Prettier aplicado.
- Revisão visual via screenshots (landing, login, dashboard, pessoas, eventos, recepção, portal nas versões desktop e mobile).

## 7. Limitações conhecidas (próximo ciclo)

- Pagamento é apenas intenção — falta PSP real (Pix/cartão) e conciliação; enquanto isso, o **modo demonstração** (`DEMO_MODE`) permite aprovar/cancelar pedidos manualmente.
- Sem cobrança de assinatura dos estabelecimentos (planos/limites).
- Sem e-mails transacionais (confirmação de compra, reset de senha) e sem notificações WhatsApp.
- Venda exige login — falta página pública do evento com checkout guest.
- Sem cupons, meia-entrada, reembolso automático e transferência de ingresso.
- Sem CI/CD, staging e monitoramento de erros; deploy manual por script.
- Recuperação de senha depende de SMTP do Supabase (não configurado).

> Detalhamento das lacunas e roadmap em `docs/PLANO-COMERCIAL.md`.
