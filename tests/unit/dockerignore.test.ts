import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Menerjemahkan satu pola .dockerignore menjadi regex.
 *
 * Hanya menangani `*` (tanpa `**` dan tanpa negasi), cukup untuk memeriksa
 * berkas di root proyek yang menjadi perhatian di sini.
 *
 * Translates a single .dockerignore pattern into a regex.
 *
 * Handles only `*` (no `**`, no negation), which is enough for the root-level
 * files this checks.
 */
function patternMatches(pattern: string, filename: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`).test(filename);
}

function ignoredPatterns(): string[] {
  const raw = readFileSync(resolve(process.cwd(), '.dockerignore'), 'utf-8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

describe('.dockerignore', () => {
  // Next.js menyalin berkas tak dikenal di root proyek ke folder standalone.
  // Tanpa penyaringan, kunci privat ikut terbungkus ke dalam image dan tersebar
  // ke setiap tempat image itu ditarik.
  //
  // Next.js copies unrecognised root-level files into the standalone folder.
  // Without filtering, a private key gets baked into the image and spreads
  // everywhere that image is pulled.
  it.each([
    'service-account.json',
    'service-account-old-us.json',
    '.env.local',
    '.env.production.local',
    'server.pem',
  ])('menahan %s agar tidak masuk image', (filename) => {
    const patterns = ignoredPatterns();
    expect(patterns.some((p) => patternMatches(p, filename))).toBe(true);
  });

  it('tidak menahan berkas yang dibutuhkan build', () => {
    const patterns = ignoredPatterns();
    for (const needed of ['package.json', 'next.config.ts', 'tsconfig.json']) {
      expect(patterns.some((p) => patternMatches(p, needed)), needed).toBe(false);
    }
  });
});
