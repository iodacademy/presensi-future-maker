import { expect, test } from '@playwright/test';

// Uji asap terhadap layanan yang sudah ter-deploy. Berbeda dari runtime.spec.ts
// yang memblokir seluruh panggilan keluar, berkas ini sengaja menembak layanan
// sungguhan: yang diuji justru apakah konfigurasi produksi benar-benar terpasang.
//
// Jalankan dengan: DEPLOY_URL=https://... npx playwright test tests/browser/deployed.spec.ts
//
// Smoke test against the deployed service. Unlike runtime.spec.ts, which blocks
// every outbound call, this file deliberately hits the real service: what is
// under test is whether the production configuration actually landed.
const DEPLOY_URL = process.env.DEPLOY_URL;

test.skip(!DEPLOY_URL, 'DEPLOY_URL tidak diatur / DEPLOY_URL not set');

test('halaman login tampil dan tidak memuat galat runtime', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`${DEPLOY_URL}/login`);
  await expect(page.getByRole('button', { name: 'Masuk ke Aplikasi' })).toBeVisible();
  await expect(page.getByLabel('Alamat Email')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Firebase klien memakai konfigurasi sungguhan, bukan nilai cadangan', async ({ page }) => {
  // client.ts jatuh ke 'fake-api-key' bila NEXT_PUBLIC_FIREBASE_API_KEY tidak
  // tersedia saat build. Nilai itu tidak pernah boleh sampai ke produksi:
  // login akan gagal dan sebabnya sulit dilacak dari sisi pengguna.
  //
  // client.ts falls back to 'fake-api-key' when NEXT_PUBLIC_FIREBASE_API_KEY is
  // absent at build time. That value must never reach production: login would
  // fail and the cause is hard to trace from the user's side.
  const chunks: string[] = [];
  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/_next/static/chunks/') && url.endsWith('.js')) chunks.push(url);
  });

  await page.goto(`${DEPLOY_URL}/login`);
  await expect(page.getByRole('button', { name: 'Masuk ke Aplikasi' })).toBeVisible();

  let foundRealKey = false;
  for (const url of chunks) {
    const body = await (await page.request.get(url)).text();
    expect(body, `nilai cadangan ditemukan di ${url}`).not.toContain('fake-api-key');
    if (/AIza[A-Za-z0-9_-]{30,}/.test(body)) foundRealKey = true;
  }
  expect(foundRealKey, 'kunci API Firebase tidak ditemukan di bundel mana pun').toBe(true);
});

test('endpoint terlindungi menolak permintaan tanpa sesi', async ({ request }) => {
  const res = await request.get(`${DEPLOY_URL}/api/classes`);
  expect([401, 403]).toContain(res.status());
});
