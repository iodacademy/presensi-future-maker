// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// Config dipilih lewat NODE_ENV, bukan parameter phase, karena Hostinger hanya
// dapat menggabungkan config berbentuk objek. Jadi tiap kasus di sini memuat
// ulang modulnya dengan NODE_ENV yang berbeda.
//
// The config keys off NODE_ENV rather than a phase parameter, because Hostinger
// can only merge an object-shaped config. Each case here therefore re-imports
// the module under a different NODE_ENV.
async function distDirFor(nodeEnv: string): Promise<string> {
  vi.stubEnv('NODE_ENV', nodeEnv);
  vi.resetModules();
  const mod = (await import('../../next.config')) as { default: NextConfig };
  return resolve(mod.default.distDir ?? '.next');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Build isolation', () => {
  it('does not let a production build overwrite a running dev server output', async () => {
    const dev = await distDirFor('development');
    const production = await distDirFor('production');
    expect(production).not.toBe(dev);
  });

  it('starts production from the directory produced by the production build', async () => {
    // `next build` dan `next start` sama-sama berjalan dengan NODE_ENV=production.
    // Both `next build` and `next start` run with NODE_ENV=production.
    const buildDir = await distDirFor('production');
    const startDir = await distDirFor('production');
    expect(startDir).toBe(buildDir);
  });

  it('exports an object so the Hostinger standalone wrapper can merge it', async () => {
    vi.resetModules();
    const mod = (await import('../../next.config')) as { default: unknown };
    expect(typeof mod.default).toBe('object');
  });

  it('runs attendance display policy in the browser without Node polyfills', async () => {
    const bundle = await build({
      entryPoints: ['src/features/attendance/policy.ts'],
      bundle: true,
      platform: 'browser',
      format: 'iife',
      globalName: 'AttendancePolicy',
      write: false,
      logLevel: 'silent',
    });
    const policy = runInNewContext(`${bundle.outputFiles[0].text};AttendancePolicy;`) as {
      isAttendanceWindowActive: (date: string, now: string) => boolean;
    };
    expect(policy.isAttendanceWindowActive('2026-09-10', '2026-09-10T19:00:00+07:00')).toBe(true);
    expect(policy.isAttendanceWindowActive('2026-09-10', '2026-09-10T22:00:00+07:00')).toBe(false);
  });
});
