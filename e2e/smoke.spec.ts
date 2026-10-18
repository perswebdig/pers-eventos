import { expect, test } from "@playwright/test";

// Smoke tests: rodam contra o build de produção (webServer do playwright.config).
// Não dependem de login/Supabase, então servem para validar o shell e as APIs.

test("landing responde com o título do app", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/PersEventos/i);
});

test("login renderiza o formulário (Entrar / Criar conta)", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("tab", { name: "Entrar" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Criar conta" })).toBeVisible();
  await expect(page.locator("#email")).toBeVisible();
  await expect(page.locator("#password")).toBeVisible();
});

test("rota protegida redireciona para o login", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForURL(/\/login/);
  expect(new URL(page.url()).pathname).toBe("/login");
});

test("portal do cliente é protegido (Meus Ingressos)", async ({ page }) => {
  await page.goto("/portal/ingressos");
  await page.waitForURL(/\/login/);
  expect(new URL(page.url()).pathname).toBe("/login");
});

test("webhook de pagamento exige o segredo", async ({ request }) => {
  const res = await request.post("/api/webhooks/payment", {
    data: { order_id: "00000000-0000-0000-0000-000000000000", event: "payment_succeeded" },
  });
  expect(res.status()).toBe(401);
});

test("checkout exige autenticação", async ({ request }) => {
  const res = await request.post("/api/checkout", {
    data: {
      ticket_type_id: "00000000-0000-0000-0000-000000000000",
      quantity: 1,
      payment_method: "pix",
    },
  });
  expect(res.status()).toBe(401);
});

test("health responde ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { status?: string; service?: string };
  expect(body.status).toBe("ok");
  expect(body.service).toBe("pers-eventos");
});
