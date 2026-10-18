# Plano de upgrade — PersEventos como produto comercial

> Criado em 16/10/2026. Documento vivo: revisar ao fim de cada fase.

## 1. Estado atual (v1)

SaaS multi-tenant funcional:

- **Tenancy**: `estabelecimentos` + `tenant_id` + RLS; papéis `super_admin`, `tenant_admin`, `staff`, `recepcao`, `cliente`; onboarding self-service em `/onboarding`; área do super admin em `/admin` (estabelecimentos e usuários).
- **Operação de eventos**: eventos, lotes (`ticket_types`), inscrições, termos LGPD, check-in com QR online, relatórios com export CSV.
- **Vendas**: checkout cria `orders`; confirmação por webhook genérico (`src/app/api/webhooks/payment/route.ts`, header `x-webhook-secret`, RPC `confirm_order_payment` que gera ingressos com hash de QR). **Não há PSP real**: Pix/cartão são apenas intenção de pagamento.
- **Portal do cliente**: login obrigatório, eventos, checkout, carteira de ingressos com QR, termos.
- **Infra**: Next.js + Supabase (auth/DB), PM2 single-instance na porta 3010, deploy via `scripts/deploy.sh`, health em `/api/health`, testes (vitest 44 unit, 7 e2e smoke).

## 2. Lacunas para comercializar

| #   | Lacuna                                            | Impacto                                        |
| --- | ------------------------------------------------- | ---------------------------------------------- |
| 1   | Pagamento real (Pix/cartão)                       | Sem isso não há receita de ingressos           |
| 2   | Cobrança do próprio SaaS (planos/assinatura)      | Sem isso não há receita de assinatura          |
| 3   | E-mails transacionais (compra, reset de senha)    | Suporte manual e recuperação de conta quebrada |
| 4   | Página pública de evento + checkout guest         | Organizador não vende para quem não tem conta  |
| 5   | Cupons, meia-entrada, reembolso, transferência    | Paridade com concorrentes (Sympla, Ingresse)   |
| 6   | CI/CD, staging, observabilidade, backups testados | Risco operacional inaceitável em produção paga |
| 7   | LGPD operacional, 2FA, rate limit, headers        | Venda para clientes maiores exige isso         |
| 8   | Go-to-market: landing, pricing, docs, suporte     | Conversão e retenção                           |

## 3. Fases

Legenda de esforço: semanas de 1 dev em tempo integral.

### Fase A — Fundação para vender (bloqueadores, ~5–6 semanas)

**A1. Pagamentos reais no checkout — 2,5 sem**

- Adapter de PSP em `src/lib/payments/` com interface única (`createCharge`, `getCharge`, `refund`, `parseWebhook`); implementação inicial **Mercado Pago** (Pix dinâmico + cartão tokenizado + boleto opcional).
- Nova tabela `payments` (1:N com `orders`): id do PSP, método, status, QR/expiração, valores, taxa; migração versionada em `supabase/migrations/`.
- Webhook: validação de assinatura do PSP (HMAC) + idempotência por event id; manter `confirm_order_payment` como única porta de confirmação; retries com backoff.
- Portal: tela de pagamento (Pix copia-e-cola/QR com expiração, cartão) e status em tempo real (polling curto).
- Pós-venda: estorno/cancelamento com política configurável por tenant; taxa de serviço do SaaS (take rate) por ingresso, configurável.
- Conciliação: relatório diário pedidos × pagamentos × taxas; divergências listadas para o admin.
- Testes: unit do adapter (mocks), e2e em sandbox do PSP, teste de webhook duplicado (idempotência).

**A2. Billing do próprio SaaS — 2 sem (pode sobrepor parte de A1)**

- Migração: `estabelecimentos.plan`, `subscription_status`, `trial_ends_at`, `billing_customer_id`; tabelas `subscriptions` e `invoices`.
- Planos iniciais sugeridos: **Trial 14 dias** → **Pro** (mensalidade + take rate) → **Business** (limites maiores); limites por plano: eventos ativos, ingressos/mês, usuários, check-ins/mês.
- Assinatura recorrente no PSP (cartão + Pix quando suportado); telas `/configuracoes/plano` (planos, assinatura, faturas) para `tenant_admin`.
- Guard de limites server-side (`assertPlanLimit`) nas rotas de criação (eventos, usuários, checkout); mensagens de upgrade no UI.
- Webhook de assinatura (renovação, falha, cancelamento) com dunning; **bloqueio soft** (somente leitura) após carência configurável.

**A3. E-mails transacionais — 1 sem**

- Provedor: Resend (ou Postmark); templates com React Email.
- Eventos: compra confirmada (com link do QR), pagamento pendente, reembolso, lembrete 24h antes do evento, convite de equipe, reset de senha.
- Fila `email_outbox` + worker com retry; SMTP customizado no Supabase Auth para habilitar "esqueci a senha" de ponta a ponta.

**Critérios de aceite da Fase A**

- Compra real de ingresso com Pix e cartão em sandbox, ponta a ponta, com e-mail de confirmação.
- Assinatura de plano criada, fatura paga, limite de plano bloqueando criação acima do teto.
- Reset de senha funcionando por e-mail.
- Lint/typecheck/53 unit/e2e verdes + deploy em staging.

### Fase B — Produto self-service e vitrine (~4–5 semanas)

**B1. Página pública de evento (sem login) — 2 sem**
Slug por tenant/evento, capa/descrição, lotes com janela de vendas, checkout guest (e-mail + CPF, aceite de termos), ingresso entregue por e-mail com QR, SEO básico (metadata/OG), branding do tenant (logo e cor).

**B2. Cupons e meia-entrada — 1 sem**
Cupons %/valor fixo com validade, limite de usos e por evento; meia-entrada estudante (autodeclaração com comprovante anexado) e meia solidária (doação).

**B3. Equipe, convites e segurança de conta — 1 sem**
Convites por e-mail com papel, 2FA (TOTP) para `tenant_admin`/`super_admin`, auditoria de ações administrativas.

**B4. Portaria avançada — 1 sem**
Busca manual na lista por nome/CPF/e-mail, check-in sem QR, transferência de ingresso, reembolso com política por evento, lista de espera.

### Fase C — Operação, segurança e escala (~3–4 semanas)

- **C1. CI/CD + staging**: pipeline (lint, typecheck, unit, e2e), ambiente de staging com Supabase próprio, migrações automatizadas, seed de dados.
- **C2. Observabilidade e resiliência**: Sentry (front/back), uptime externo, backups PITR + teste de restore documentado, fila com retry para webhooks/e-mails.
- **C3. Hardening**: rate limit em login/checkout/webhook, CSP e headers, auditoria de RLS por tenant, rotação de segredos, revisão de logs de acesso admin.
- **C4. LGPD operacional**: retenção configurável, exportar/excluir dados do titular, DPA modelo, registro de tratamento.
- **C5. Escala**: índices e paginação nas listas grandes, PM2 → containers quando houver mais de um tenant relevante.

### Fase D — Go-to-market (paralela a partir da Fase A)

- Landing comercial + pricing público + trial 14 dias.
- Central de ajuda (templates de resposta, guias de portaria).
- Analytics de produto (PostHog): funil signup → 1º evento → 1ª venda; métricas MRR/churn.
- Jurídico: termos de uso SaaS, política de privacidade, contrato de adesão; NFS-e em fase posterior.

## 4. Itens de backlog por sprint (Fase A)

### Sprint A1 (semana 1–2) — PSP adapter + Pix

- [ ] Spike de 1 dia: escolher PSP (Mercado Pago vs Pagar.me vs Stripe) — comparar Pix embutido, taxas, sandbox e suporte a assinatura (A2).
- [ ] Migração `payments` + tipos em `src/types/database.ts`.
- [ ] `src/lib/payments/index.ts`: interface `PaymentProvider` + factory por tenant.
- [ ] `src/lib/payments/mercadopago.ts`: `createCharge` (Pix), `getCharge`, `parseWebhook`.
- [ ] Rota `POST /api/checkout`: criar charge e devolver QR/copia-e-cola.
- [ ] Tela de pagamento no portal: QR, expiração, status com polling.
- [ ] Webhook novo: assinatura do PSP + idempotência (tabela `payment_events`).
- [ ] Testes unit do adapter (mocks HTTP) e teste de webhook duplicado.

### Sprint A2 (semana 3–4) — Cartão, pós-venda e conciliação

- [ ] `createCharge` cartão tokenizado (form do PSP no browser, nunca armazenar PAN).
- [ ] Estorno total e cancelamento de pedido com política por tenant.
- [ ] Taxa de serviço configurável + lançamento por ingresso.
- [ ] Relatório diário de conciliação (pedidos × pagamentos × taxas).
- [ ] E2E em sandbox: Pix aprovado, cartão recusado, estorno.

### Sprint A3 (semana 5) — Billing SaaS (parte 1)

- [ ] Migração de planos/assinatura/faturas em `estabelecimentos` + tabelas novas.
- [ ] Guard `assertPlanLimit` nas rotas de criação; mensagens de upgrade.
- [ ] Telas `/configuracoes/plano` (planos, faturas, upgrade/downgrade).
- [ ] Assinatura recorrente no PSP + webhook de assinatura com idempotência.

### Sprint A4 (semana 6) — Billing SaaS (parte 2) + e-mails

- [ ] Dunning (retentativas) + bloqueio soft após carência.
- [ ] `email_outbox` + worker de envio com retry.
- [ ] Templates: compra confirmada, pagamento pendente, reembolso, lembrete 24h, convite, reset de senha.
- [ ] SMTP do provedor no Supabase Auth; validar reset de senha ponta a ponta.
- [ ] Checklist de aceite da Fase A no staging.

## 5. Riscos e decisões

- **PCI**: nunca armazenar dados de cartão; sempre tokenização/hosted fields do PSP.
- **Dependência de PSP único**: interface de adapter desde o início permite trocar/adicionar provedor.
- **Sandbox vs produção**: só liberar produção após e2e de estorno e conciliação em sandbox.
- **Preço**: definir trial e planos com o mercado antes de codar (bloqueia apenas o sprint A3, não A1).
- **Sobreposição com clientes atuais**: manter o webhook antigo (`x-webhook-secret`) ativo durante a transição.

## 6. Definição de pronto (cada sprint)

1. `npm run lint` (0 erros), `npm run typecheck`, 53 unit e e2e verdes.
2. Migrações versionadas aplicadas em staging e produção.
3. Deploy com health check OK (`scripts/deploy.sh`).
4. Documentação da feature no README/central de ajuda.
5. Checklist de QA manual para o stakeholder testar.
