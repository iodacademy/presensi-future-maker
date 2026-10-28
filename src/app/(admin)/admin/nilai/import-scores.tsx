'use client';

import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  parseScoreRows,
  scoreTemplateRows,
  SCORE_HEADERS,
  type ParsedScoreRow,
} from '@/features/grading/import-policy';

/**
 * Menyusun dan mengunduh berkas contoh nilai.
 *
 * Builds and downloads the score template.
 */
export function downloadScoreTemplate(): void {
  const sheet = XLSX.utils.json_to_sheet(scoreTemplateRows(), { header: [...SCORE_HEADERS] });
  // Lebar kolom disetel supaya surel dan catatannya terbaca tanpa perlu
  // melebarkan sendiri; berkas contoh yang kolomnya sempit terlihat seperti
  // berkas yang rusak.
  //
  // Column widths are set so the email and note read without widening them by
  // hand; a template with cramped columns looks like a broken file.
  sheet['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 45 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Nilai');
  XLSX.writeFile(wb, 'contoh-nilai-capstone.xlsx');
}

/**
 * Impor nilai capstone dari berkas Excel.
 *
 * Berkasnya diurai di peramban lalu barisnya yang dikirim, bukan berkasnya:
 * mengurai di server berarti menerima dan menyimpan unggahan, sedangkan yang
 * dibutuhkan hanya barisnya.
 *
 * Imports capstone scores from an Excel file.
 *
 * The file is parsed in the browser and its rows are sent rather than the file:
 * parsing on the server would mean accepting and storing an upload, when all
 * that is needed are its rows.
 */
export function ImportScores({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedScoreRow[] | null>(null);
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<{ email: string; reason: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Dikosongkan agar berkas yang sama dapat dipilih lagi setelah diperbaiki;
    // tanpa ini, memilih berkas bernama sama tidak memicu apa pun.
    //
    // Cleared so the same file can be chosen again after fixing it; without
    // this, picking an identically named file fires nothing.
    e.target.value = '';
    if (!file) return;

    setError(null);
    setStatus(null);
    setSkipped([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

        if (rows.length === 0) {
          setError('Berkas tidak memuat baris apa pun');
          return;
        }

        const { rows: terbaca, errors } = parseScoreRows(rows);
        setPreview(terbaca);
        setRowErrors(errors);
        if (terbaca.length === 0 && errors.length === 0) {
          setError('Tidak ada baris nilai yang terbaca. Pastikan judul kolomnya sesuai berkas contoh.');
        }
      } catch {
        setError('Berkas tidak dapat dibaca. Pastikan berformat .xlsx, .xls, atau .csv.');
      }
    };
    reader.readAsBinaryString(file);
  }

  async function save() {
    if (!preview || preview.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/grading/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: preview }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan nilai');

      setPreview(null);
      setRowErrors([]);
      setSkipped(data.skipped ?? []);
      setStatus(`${data.imported} nilai tersimpan`);
      onImported();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff' }}>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>
          Impor Nilai Capstone
        </div>
        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px', lineHeight: 1.5 }}>
          Kolomnya: {SCORE_HEADERS.join(', ')}. Mengunggah ulang menimpa nilai sebelumnya.
        </div>
      </div>

      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={downloadScoreTemplate} style={{ fontSize: '11px', padding: '9px 13px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <Download size={12} strokeWidth={2} /> Unduh Contoh Excel
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()} style={{ fontSize: '11px', padding: '9px 13px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <Upload size={12} strokeWidth={2} /> Pilih Berkas
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} aria-label="Berkas nilai Excel" style={{ display: 'none' }} />
      </div>

      {status && (
        <div role="status" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-success)', backgroundColor: 'var(--color-success-light)', padding: '9px 11px', borderRadius: '8px' }}>
          {status}
        </div>
      )}

      {error && (
        <div role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)', padding: '9px 11px', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {/* Surel yang tidak ditemukan disebut satu per satu. Impor yang
          melaporkan "100 berhasil" padahal lima surel salah ketik meninggalkan
          lima peserta tanpa nilai tanpa ada yang tahu.

          Emails not found are named one by one. An import reporting "100
          succeeded" when five were mistyped leaves five participants unscored
          with nobody the wiser. */}
      {skipped.length > 0 && (
        <div role="alert" style={{ padding: '11px', borderRadius: '8px', backgroundColor: 'var(--color-warning-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#7c2d12' }}>
            <AlertTriangle size={12} strokeWidth={2} />
            {skipped.length} baris dilewatkan
          </div>
          <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {skipped.map((s) => (
              <div key={s.email} style={{ fontSize: '10px', color: '#7c2d12' }}>
                {s.email} - {s.reason}
              </div>
            ))}
          </div>
        </div>
      )}

      {rowErrors.length > 0 && (
        <div role="alert" style={{ padding: '11px', borderRadius: '8px', backgroundColor: 'var(--color-warning-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#7c2d12' }}>
            <AlertTriangle size={12} strokeWidth={2} />
            {rowErrors.length} baris tidak terbaca
          </div>
          <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {rowErrors.slice(0, 6).map((m) => (
              <div key={m} style={{ fontSize: '10px', color: '#7c2d12' }}>{m}</div>
            ))}
            {rowErrors.length > 6 && (
              <div style={{ fontSize: '10px', color: '#7c2d12', fontStyle: 'italic' }}>
                dan {rowErrors.length - 6} baris lainnya
              </div>
            )}
          </div>
        </div>
      )}

      {preview && preview.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: 'var(--color-success)' }}>
            <Check size={12} strokeWidth={3} />
            {preview.length} baris siap disimpan
          </div>

          <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {preview.map((r) => (
              <div key={r.email} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 11px', borderRadius: '8px', backgroundColor: 'var(--color-bg-app)' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: '10px', color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.email}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-main)', width: '78px', textAlign: 'right', flexShrink: 0 }}>
                  capstone {r.capstone}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '7px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => { setPreview(null); setRowErrors([]); }} disabled={busy} style={{ fontSize: '11px', padding: '9px 13px' }}>
              Batal
            </Button>
            <Button variant="primary" onClick={save} disabled={busy} style={{ fontSize: '11px', padding: '9px 13px' }}>
              {busy ? 'Menyimpan...' : `Simpan ${preview.length} Baris`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
