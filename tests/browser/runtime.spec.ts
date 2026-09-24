import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) {
    throw new Error('Runtime checks may only target a local server.');
  }
  // Isolasi uji UI dari Firebase dan layanan eksternal / Isolate UI checks from Firebase and external services
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) {
      return route.fulfill({ status: 503, json: { error: 'API disabled in runtime smoke test' } });
    }
    return route.continue();
  });
});

test('login hydrates after repeated reloads without Webpack runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Masuk ke Aplikasi' })).toBeVisible();
  await page.getByLabel('Alamat Email').fill('runtime-check@example.test');
  await page.reload();
  await expect(page.getByLabel('Alamat Email')).toHaveValue('');
  await page.getByLabel('Alamat Email').fill('runtime-check@example.test');
  await expect(page.getByLabel('Alamat Email')).toHaveValue('runtime-check@example.test');
  expect(errors).toEqual([]);
});

test('manifest references only image assets that are served successfully', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  for (const icon of manifest.icons ?? []) {
    expect(icon.src).toMatch(/^\/(?!\/)/);
    const image = await request.get(icon.src);
    expect(image.status(), icon.src).toBe(200);
    expect(image.headers()['content-type'], icon.src).toMatch(/^image\//);
  }
});

test('schedule module and client navigation load with isolated fixture responses', async ({ page, context, baseURL }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Cookie sintetis menguji bundling shell, bukan autentikasi / Synthetic cookie tests shell bundling, not authentication
  await context.addCookies([{ name: '__session', value: 'runtime-fixture-not-a-real-session', url: baseURL! }]);
  await context.route('**/api/classes', (route) => route.fulfill({ json: {
    classes: [{
      id: 'runtime-class', city: 'Kota Uji', programName: 'Kelas Uji',
      canonicalName: 'Kelas Uji - Kota Uji', status: 'draft',
      mentorCount: 0, studentCount: 0, dailyTaskCount: 0, capstoneTaskCount: 0,
    }],
  } }));
  await context.route('**/api/sessions?*', (route) => route.fulfill({ json: { sessions: [] } }));
  await page.goto('/admin/jadwal');
  await expect(page.getByRole('heading', { name: 'Jadwal dan Presensi', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Buat Pertemuan Pertama' })).toBeVisible();
  await page.getByRole('link', { name: 'Kelas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kelas', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Jadwal dan Presensi', exact: true }).click();
  await expect(page.getByRole('button', { name: '+ Buat Pertemuan Pertama' })).toBeVisible();
  expect(errors).toEqual([]);
});
