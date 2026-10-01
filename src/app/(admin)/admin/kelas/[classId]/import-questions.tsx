'use client';

import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseQuestionRows, templateRows, TEMPLATE_HEADERS, type ParsedQuestion } from '@/features/exams/import-policy';

interface ImportQuestionsProps {
  examId: string;
  onImported: () => void;
}

/**
 * Impor soal dari berkas Excel.
 *
 * Berkasnya diurai di peramban lalu barisnya yang dikirim, bukan berkasnya:
 * mengurai di server berarti menerima dan menyimpan unggahan, sedangkan yang
 * dibutuhkan hanya barisnya.
 *
 * Hasil bacaannya ditampilkan lebih dulu sebagai pratinjau. Dua puluh soal
 * yang langsung masuk tanpa diperiksa berarti dua puluh soal yang harus
 * dihapus satu per satu bila kolomnya ternyata tergeser.
 *
 * Imports questions from an Excel file.
 *
 * The file is parsed in the browser and its rows are sent rather than the file:
 * parsing on the server would mean accepting and storing an upload, when all
 * that is needed are its rows.
 *
 * What was read is shown as a preview first. Twenty questions landing unchecked
 * means twenty questions to delete one by one when a column turns out to be
 * shifted.
 */
export function ImportQuestions({ examId, onImported }: ImportQuestionsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedQuestion[] | null>(null);
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function downloadTemplate() {
    const sheet = XLSX.utils.json_to_sheet(templateRows(), { header: [...TEMPLATE_HEADERS] });
    // Lebar kolom disetel supaya pertanyaannya terbaca tanpa perlu melebarkan
    // sendiri; berkas contoh yang kolomnya sempit terlihat seperti berkas yang
    // rusak.
    //
    // Column widths are set so the question reads without widening it by hand;
    // a template with cramped columns looks like a broken file.
    sheet['!cols'] = [{ wch: 50 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 40 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Soal');
    XLSX.writeFile(wb, 'contoh-soal-ujian.xlsx');
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

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

        const { questions, errors } = parseQuestionRows(rows);
        setPreview(questions);
        setRowErrors(errors);
        if (questions.length === 0 && errors.length === 0) {
          setError('Tidak ada baris soal yang terbaca. Pastikan judul kolomnya sesuai berkas contoh.');
        }
      } catch {
        setError('Berkas tidak dapat dibaca. Pastikan berformat .xlsx, .xls, atau .csv.');
      }
    };
    reader.readAsBinaryString(file);

    // Dikosongkan agar berkas yang sama dapat dipilih lagi setelah diperbaiki;
    // tanpa ini, memilih berkas bernama sama tidak memicu apa pun.
    //
    // Cleared so the same file can be chosen again after fixing it; without
    // this, picking an identically named file fires nothing.
    e.target.value = '';
  }

  async function save() {
    if (!preview || preview.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/exams/${examId}/questions/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: preview }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan soal');
      setPreview(null);
      setRowErrors([]);
      onImported();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderRadius: '10px', border: '1px dashed var(--color-border)', backgroundColor: '#ffffff' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
        IMPOR DARI EXCEL
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <Button
          variant="secondary"
          onClick={downloadTemplate}
          style={{ fontSize: '11px', padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
        >
          <Download size={12} strokeWidth={2} /> Unduh Contoh
        </Button>

        <Button
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          style={{ fontSize: '11px', padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
        >
          <Upload size={12} strokeWidth={2} /> Pilih Berkas
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          aria-label="Berkas soal Excel"
          style={{ display: 'none' }}
        />
      </div>

      <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
        Kolom: Pertanyaan, Pilihan A sampai E, Jawaban, Pembahasan. Kolom Jawaban diisi hurufnya
        (misal B) atau teks pilihannya. Dua pilihan berbunyi Benar dan Salah otomatis menjadi soal benar-salah.
      </div>

      {error && (
        <div role="alert" style={{ fontSize: '10px', color: 'var(--color-danger)' }}>{error}</div>
      )}

      {/* Baris yang gagal disebut beserta nomornya dan baris lainnya tetap
          dapat disimpan; menolak seluruh berkas karena satu salah ketik
          memaksa admin mengulang dari awal.

          Failed rows are named with their numbers and the rest can still be
          saved; rejecting a whole file over one typo forces the admin to start
          over. */}
      {rowErrors.length > 0 && (
        <div role="alert" style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'var(--color-warning-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, color: '#7c2d12' }}>
            <AlertTriangle size={12} strokeWidth={2} />
            {rowErrors.length} baris dilewatkan
          </div>
          <div style={{ marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {rowErrors.slice(0, 5).map((m) => (
              <div key={m} style={{ fontSize: '9px', color: '#7c2d12' }}>{m}</div>
            ))}
            {rowErrors.length > 5 && (
              <div style={{ fontSize: '9px', color: '#7c2d12', fontStyle: 'italic' }}>
                dan {rowErrors.length - 5} baris lainnya
              </div>
            )}
          </div>
        </div>
      )}

      {preview && preview.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, color: 'var(--color-success)' }}>
            <Check size={12} strokeWidth={3} />
            {preview.length} soal siap diimpor
          </div>

          <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {preview.map((q, i) => (
              <div key={i} style={{ padding: '8px 10px', borderRadius: '8px', backgroundColor: 'var(--color-bg-app)' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-main)' }}>
                  {i + 1}. {q.text}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--color-success)', marginTop: '2px' }}>
                  Jawaban: {q.options[q.correctIndex]?.text}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => { setPreview(null); setRowErrors([]); }} disabled={busy} style={{ fontSize: '11px', padding: '8px 12px' }}>
              Batal
            </Button>
            <Button variant="primary" onClick={save} disabled={busy} style={{ fontSize: '11px', padding: '8px 12px' }}>
              {busy ? 'Menyimpan...' : `Simpan ${preview.length} Soal`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
