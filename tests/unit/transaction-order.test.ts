// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Firestore membatalkan transaksi bila ada pembacaan setelah penulisan pertama:
 * "Firestore transactions require all reads to be executed before all writes."
 *
 * Kegagalannya hanya muncul saat transaksi benar-benar dijalankan terhadap
 * server sungguhan, sehingga lolos dari typecheck maupun uji unit biasa --
 * presensi scan QR sempat gagal di lapangan karena ini. Pemeriksaan statis di
 * sini membaca sumbernya dan menolak urutan yang salah sebelum sampai ke sana.
 *
 * Firestore aborts a transaction on any read after the first write:
 * "Firestore transactions require all reads to be executed before all writes."
 *
 * The failure only surfaces when the transaction actually runs against a real
 * server, so it slips past both typecheck and ordinary unit tests -- QR
 * attendance failed in the field because of it. The static check here reads the
 * source and rejects the wrong order before it gets that far.
 */

function transactionBlocks(source: string): string[] {
  const blocks: string[] = [];
  const marker = /runTransaction\(async \((\w+)\) => \{/g;
  let match: RegExpExecArray | null;

  while ((match = marker.exec(source)) !== null) {
    let depth = 1;
    let i = marker.lastIndex;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth -= 1;
      i += 1;
    }
    blocks.push(`${match[1]}\u0000${source.slice(marker.lastIndex, i)}`);
  }
  return blocks;
}

function firstWriteBeforeLastRead(block: string): boolean {
  const [handle, body] = block.split('\u0000');
  const stripped = body.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  const reads = [...stripped.matchAll(new RegExp(`${handle}\\.get\\(`, 'g'))].map((m) => m.index!);
  const writes = [...stripped.matchAll(new RegExp(`${handle}\\.(set|update|delete|create)\\(`, 'g'))].map(
    (m) => m.index!
  );

  if (reads.length === 0 || writes.length === 0) return false;
  return Math.min(...writes) < Math.max(...reads);
}

describe('urutan baca-tulis dalam transaksi Firestore', () => {
  const files = [
    'src/features/attendance/service.ts',
    'src/features/mentoring/service.ts',
    'src/features/classes/service.ts',
    'src/features/tasks/submission-service.ts',
  ];

  it.each(files)('%s tidak membaca setelah menulis', (file) => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf-8');
    const offenders = transactionBlocks(source).filter(firstWriteBeforeLastRead);
    expect(offenders.length, `${offenders.length} transaksi membaca setelah menulis di ${file}`).toBe(0);
  });

  it('mengenali pola yang salah bila muncul kembali', () => {
    // Penjaga bagi pemeriksanya sendiri: tanpa ini, regex yang rusak akan
    // meloloskan segalanya dan test di atas lulus tanpa memeriksa apa pun.
    //
    // A guard for the checker itself: without it, a broken regex would pass
    // everything and the tests above would succeed while checking nothing.
    const bad = `runTransaction(async (tx) => {
      const a = await tx.get(refA);
      tx.set(refB, {});
      const c = await tx.get(refC);
    });`;
    expect(transactionBlocks(bad).some(firstWriteBeforeLastRead)).toBe(true);

    const good = `runTransaction(async (tx) => {
      const a = await tx.get(refA);
      const c = await tx.get(refC);
      tx.set(refB, {});
    });`;
    expect(transactionBlocks(good).some(firstWriteBeforeLastRead)).toBe(false);
  });
});
