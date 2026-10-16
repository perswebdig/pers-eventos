import { expect, test } from '@playwright/test';

// Smoke tests: rodam contra o build de produção (webServer do playwright.config).
// Não dependem de login/Supabase, então servem para validar shell, PWA e API.

test('landing responde com o título do app', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/PersEventos/i);
});

test('login renderiza o formulário (Entrar / Criar conta)', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('tab', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Criar conta' })).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
});

test('rota protegida redireciona para o login', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForURL(/\/login/);
  expect(new URL(page.url()).pathname).toBe('/login');
});

test('offline fallback responde', async ({ page }) => {
  const res = await page.goto('/offline');
  expect(res?.ok()).toBeTruthy();
});

test('health responde ok', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { status?: string; service?: string };
  expect(body.status).toBe('ok');
  expect(body.service).toBe('pers-eventos');
});

test('manifest PWA é válido', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBeTruthy();
  const manifest = (await res.json()) as { name?: string; icons?: unknown[] };
  expect(manifest.name).toContain('PersEventos');
  expect(Array.isArray(manifest.icons)).toBeTruthy();
});

test('service worker é servido', async ({ request }) => {
  const res = await request.get('/sw.js');
  expect(res.ok()).toBeTruthy();
  expect((await res.text()).length).toBeGreaterThan(100);
});
