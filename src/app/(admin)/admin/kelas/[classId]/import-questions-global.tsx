'use client';

import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertTriangle, Check, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  GLOBAL_HEADER,
  GLOBAL_TEMPLATE_HEADERS,
  globalTemplateRows,
  parseGlobalQuestionRows,
  type ParsedQuestion,
} from '@/features/exams/import-policy';
import type { ExamDocument } from '@/features/exams/types';

/**
 * Impor soal seluruh ujian satu kelas dari satu berkas.
 *
 * Satu kolom tambahan, "Ujian", menentukan soal itu milik ujian yang mana.
 * Tanpa itu, dua puluh kuis berarti dua puluh berkas dan dua puluh kali
 * membuka halaman yang berbeda.
 *
 * Nama ujiannya dicocokkan dengan yang sudah ada, bukan dipakai membuat ujian
 * baru: satu salah ketik akan membuat ujian kembar yang tidak pernah terbit dan
 * tidak disadari siapa pun sampai nilainya tidak muncul.
 *
 * Imports every exam's questions for one class from a single sheet.
 *
 * One extra column, "Ujian", says which exam a question belongs to. Without it,
 * twenty quizzes mean twenty files and twenty visits to different pages.
 *
 * Exam names are matched against existing exams rather than used to create new
 * ones: one typo would spawn a twin exam that is never published and noticed by
 * nobody until its scores fail to appear.
 */
export function ImportQuestionsGlobal({
  classId,
  exams,
  onImported,
}: {
  classId: string;
  exams: Pick<ExamDocument, 'id' | 'title'>[];
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Map<string, ParsedQuestion[]> | null>(null);
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const judul = exams.map((e) => e.title);

  function unduhContoh() {
    const sheet = XLSX.utils.json_to_sheet(globalTemplateRows(judul), {
      header: [...GLOBAL_TEMPLATE_HEADERS],
    });
    // Kolom Ujian dilebarkan: nama ujian jauh lebih panjang daripada lebar
    // bawaan, dan kolom yang terpotong membuat admin mengira isinya terpotong
    // juga.
    //
    // The Ujian column is widened: exam names run far longer than the default
    // width, and a truncated column has an admin assume the content is truncated
    // too.
    sheet['!cols'] = [{ wch: 24 }, { wch: 44 }, ...Array(5).fill({ wch: 18 }), { wch: 10 }, { wch: 32 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Soal');
    XLSX.writeFile(wb, 'contoh-soal-seluruh-ujian.xlsx');
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setDone(null);

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

        const { perExam, errors } = parseGlobalQuestionRows(rows, judul);
        setRowErrors(errors);
        setPreview(perExam.size > 0 ? perExam : null);
        if (perExam.size === 0 && errors.length === 0) {
          setError('Tidak ada soal yang terbaca dari berkas ini');
        }
      } catch {
        setError('Berkas tidak dapat dibaca. Pastikan berformat .xlsx atau .csv');
      }
    };
    reader.readAsBinaryString(file);
  }

  async function kirim() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/exams/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          perExam: [...preview.entries()].map(([examTitle, questions]) => ({ examTitle, questions })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengimpor soal');
      setDone(`${data.imported} soal masuk ke ${data.examCount} ujian${data.replaced > 0 ? `, menggantikan ${data.replaced} soal lama` : ''}`);
      setPreview(null);
      setRowErrors([]);
      onImported();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const total = preview ? [...preview.values()].reduce((t, q) => t + q.length, 0) : 0;
  // Soal yang akan terhapus dihitung dari ujian yang disentuh berkas ini saja,
  // bukan seluruh kelas: ujian yang tidak disebut berkasnya tidak tersentuh.
  //
  // The questions to be deleted are counted from the exams this sheet touches, not
  // the whole class: an exam the sheet does not name is left alone.
  const akanTerganti = preview
    ? exams.filter((e) => preview.has(e.title)).reduce((t, e) => t + ((e as ExamDocument).questionCount ?? 0), 0)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', borderRadius: '10px', border: '1px dashed var(--color-border)', backgroundColor: '#ffffff' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
        IMPOR SOAL SELURUH UJIAN
      </div>

      <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.6 }}>
        Satu berkas untuk seluruh ujian kelas ini. Kolom <strong>{GLOBAL_HEADER}</strong> menentukan soal itu milik ujian
        yang mana, ditulis persis seperti judulnya. Soal yang sudah ada pada ujian yang disebut berkas ini akan
        digantikan.
      </p>

      {judul.length === 0 ? (
        <p style={{ fontSize: '11px', color: 'var(--color-warning)', fontWeight: 600, margin: 0 }}>
          Belum ada ujian di kelas ini. Buat ujiannya lebih dulu, lalu impor soalnya.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={unduhContoh} style={{ fontSize: '11px', padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Download size={12} strokeWidth={2} /> Unduh Contoh Excel
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} style={{ fontSize: '11px', padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Upload size={12} strokeWidth={2} /> Pilih Berkas
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} aria-label="Berkas soal seluruh ujian" style={{ display: 'none' }} />
          </div>

          {/* Judul ujian yang berlaku disebutkan di layar. Dibiarkan ditebak,
              admin mengetik "Kuis 1" sementara ujiannya bernama "Kuis Pertemuan
              1", lalu seluruh barisnya ditolak.

              The valid exam titles are named on screen. Left to guesswork, an admin
              types "Kuis 1" while the exam is called "Kuis Pertemuan 1", and every
              row is refused. */}
          <details>
            <summary style={{ fontSize: '10px', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}>
              Judul ujian yang berlaku ({judul.length})
            </summary>
            <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              {judul.map((j) => <li key={j}>{j}</li>)}
            </ul>
          </details>
        </>
      )}

      {error && (
        <div role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)', padding: '9px 11px', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {done && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--color-success)', backgroundColor: 'var(--color-success-light)', padding: '9px 11px', borderRadius: '8px' }}>
          <Check size={13} strokeWidth={2.5} /> {done}
        </div>
      )}

      {rowErrors.length > 0 && (
        <div role="alert" style={{ fontSize: '10px', color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)', padding: '9px 11px', borderRadius: '8px', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <AlertTriangle size={12} strokeWidth={2.5} /> {rowErrors.length} baris bermasalah
          </div>
          {/* Seluruh kesalahannya disebut, bukan yang pertama saja: berkas
              dengan sepuluh kesalahan yang dilaporkan satu per satu menuntut
              sepuluh kali unggah ulang.

              Every error is named rather than only the first: a sheet with ten
              mistakes reported one at a time would need ten re-uploads. */}
          {rowErrors.slice(0, 12).map((e, i) => <div key={i}>{e}</div>)}
          {rowErrors.length > 12 && <div>...dan {rowErrors.length - 12} lainnya</div>}
        </div>
      )}

      {preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-main)' }}>
            {total} soal untuk {preview.size} ujian
          </div>

          <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[...preview.entries()].map(([nama, soal]) => (
              <div key={nama} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', padding: '7px 10px', borderRadius: '8px', backgroundColor: 'var(--color-bg-app)' }}>
                <span style={{ flex: 1, minWidth: 0, color: 'var(--color-text-main)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nama}
                </span>
                <span style={{ flexShrink: 0, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {soal.length} soal
                </span>
              </div>
            ))}
          </div>

          {/* Berapa soal yang akan terhapus disebut sebelum tombolnya ditekan,
              bukan sesudah. Penggantian ini memusnahkan soal yang mungkin
              disusun berjam-jam, dan angkanya adalah satu-satunya tanda bahwa
              berkasnya menyasar ujian yang salah.

              How many questions will be destroyed is stated before the button is
              pressed, not after. This replacement wipes out questions that may have
              taken hours, and that number is the only sign the sheet is aimed at
              the wrong exams. */}
          {akanTerganti > 0 && (
            <div style={{ fontSize: '10px', color: '#7a5f00', backgroundColor: 'var(--color-warning-light)', padding: '9px 11px', borderRadius: '8px', lineHeight: 1.6 }}>
              <strong>{akanTerganti} soal yang sudah ada akan terhapus</strong> dan digantikan isi berkas ini. Soal pada ujian
              yang tidak disebut berkas ini tidak tersentuh.
            </div>
          )}

          <div style={{ display: 'flex', gap: '7px' }}>
            <Button variant="secondary" onClick={() => { setPreview(null); setRowErrors([]); }} disabled={busy} style={{ fontSize: '11px', padding: '8px 12px' }}>
              Batal
            </Button>
            <Button variant="primary" onClick={kirim} disabled={busy || total === 0} style={{ fontSize: '11px', padding: '8px 12px' }}>
              {busy ? 'Mengimpor...' : `Impor ${total} Soal`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
