'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { api, btn } from '../pameran/admin-ui';
import type { PassedRow } from '@/features/careers/export-service';

/**
 * Ekspor peserta intern yang lolos seleksi ke satu tabel .xlsx.
 *
 * Exports interns who passed selection to a single .xlsx table.
 */
export function PassedExportButton({ onError }: { onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const { rows } = (await api('/api/karier/export/lolos')) as { rows: PassedRow[] };
      const sheet = rows.map((r) => ({
        'Nama peserta': r.name, Email: r.email, WA: r.phone, LOLOS: r.status, PT: r.company,
        'Alamat perusahaan': r.address, Role: r.role, 'Jenis magang': r.scheme, Gaji: r.salary, Tugas: r.tasks,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), 'Peserta lolos');
      XLSX.writeFile(wb, `Peserta_lolos_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { onError((e as Error).message); } finally { setBusy(false); }
  }
  return <button type="button" style={btn} disabled={busy} onClick={run}>{busy ? 'Menyiapkan…' : 'Ekspor peserta lolos'}</button>;
}
