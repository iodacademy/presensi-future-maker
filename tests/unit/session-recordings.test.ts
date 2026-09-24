// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateRecordingUrl } from '../../src/features/attendance/policy';

const service = readFileSync(resolve(process.cwd(), 'src/features/attendance/service.ts'), 'utf-8');

function block(fnName: string): string {
  const start = service.indexOf(`export async function ${fnName}`);
  if (start === -1) throw new Error(`fungsi ${fnName} tidak ditemukan`);
  const next = service.indexOf('\nexport ', start + 1);
  return service.slice(start, next === -1 ? service.length : next);
}

describe('addSessionRecording', () => {
  const body = block('addSessionRecording');

  it('memakai transaksi, bukan update array biasa', () => {
    // Dua admin yang menambah rekaman hampir bersamaan sama-sama membaca daftar
    // lama; yang menulis belakangan akan menghapus rekaman yang baru saja
    // ditambahkan yang lain.
    //
    // Two admins adding recordings at nearly the same time both read the old
    // list; whoever writes last erases the recording the other just added.
    expect(body).toContain('runTransaction');
    expect(body).toMatch(/tx\.get\(sessionRef\)/);
  });

  it('membaca sebelum menulis di dalam transaksi', () => {
    const stripped = body.replace(/\/\/[^\n]*/g, '');
    const read = stripped.indexOf('tx.get(');
    const write = stripped.indexOf('tx.update(');
    expect(read).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(read);
  });

  it('menolak tautan yang sudah ada pada sesi yang sama', () => {
    expect(body).toMatch(/existing\.some\(\(r\) => r\.url === url\)/);
  });

  it('menuntut peran admin dan tautan yang sah', () => {
    expect(body).toContain("actor.role !== 'admin'");
    expect(body).toContain('validateRecordingUrl');
  });

  it('memberi label bawaan bila dikosongkan', () => {
    // Daftar rekaman tanpa label tidak dapat dibedakan satu sama lain.
    // A list of unlabelled recordings cannot be told apart.
    expect(body).toContain("|| 'Kelas Utama'");
  });
});

describe('removeSessionRecording', () => {
  const body = block('removeSessionRecording');

  it('menyaring berdasarkan id, bukan mengosongkan seluruh daftar', () => {
    expect(body).toMatch(/filter\(\(r\) => r\.id !== input\.recordingId\)/);
  });

  it('menuntut peran admin', () => {
    expect(body).toContain("actor.role !== 'admin'");
  });
});

describe('validasi tautan rekaman', () => {
  it('menolak skema selain HTTPS', () => {
    // Tautan ini dirender sebagai href pada halaman peserta.
    // This link is rendered as an href on the participant page.
    expect(() => validateRecordingUrl('javascript:alert(1)')).toThrow();
    expect(() => validateRecordingUrl('http://drive.google.com/x')).toThrow(/HTTPS/);
  });

  it('menerima tautan Drive dan YouTube', () => {
    expect(validateRecordingUrl('https://drive.google.com/file/d/x/view')).toBeTruthy();
    expect(validateRecordingUrl('https://youtu.be/abc')).toBeTruthy();
  });
});
