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
import { EXAM_KIND_LABELS, type ExamDocument, type ExamKind } from '@/features/exams/types';

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
  const [newExams, setNewExams] = useState<{ title: string; kind: ExamKind }[]>([]);
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // Ujian hasil impor yang masih draf, menunggu keputusan statusnya.
  // Imported exams still in draft, awaiting a decision on their status.
  const [menungguStatus, setMenungguStatus] = useState<string[]>([]);

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

        const { perExam, newExams: baru, errors } = parseGlobalQuestionRows(rows, judul);
        setNewExams(baru);
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
      setDone(
        `${data.imported} soal masuk ke ${data.examCount} ujian` +
          (data.created > 0 ? `, ${data.created} di antaranya ujian baru berstatus draf` : '') +
          (data.replaced > 0 ? `, menggantikan ${data.replaced} soal lama` : '')
      );
      setNewExams([]);
      setPreview(null);
      setRowErrors([]);
      // Statusnya ditanyakan setelah impornya berhasil, bukan sebelumnya: soal
      // yang gagal masuk tidak boleh sempat diterbitkan, dan pilihan sebelum
      // impor dibuat tanpa tahu ujian mana yang benar-benar terisi.
      //
      // The status is asked once the import has succeeded, not before: questions
      // that failed to land must never get published, and a choice made before
      // the import is made without knowing which exams actually got filled.
      setMenungguStatus(data.draftExamIds ?? []);
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
        yang mana. Ujian yang belum ada dibuat otomatis sebagai draf; jenisnya dibaca dari awal judulnya (Kuis, Pretest,
        atau Postest), dan kuis dipasangkan ke pertemuan yang judulnya cocok. Soal yang sudah ada pada ujian yang disebut
        berkas ini akan digantikan.
      </p>

      {/* Tombolnya tersedia meski kelasnya belum punya ujian: impor inilah yang
          membuatnya. Menahannya sampai ujian dibuat satu per satu mengembalikan
          pekerjaan yang hendak dihindari.

          The buttons are available even when the class has no exams yet: this
          import is what creates them. Holding them back until exams are made one
          by one brings back the very work it exists to avoid. */}
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
          {judul.length > 0 && (
            <details>
              <summary style={{ fontSize: '10px', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}>
                Ujian yang sudah ada ({judul.length})
              </summary>
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                {judul.map((j) => <li key={j}>{j}</li>)}
              </ul>
            </details>
          )}
      </>

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
                <span style={{ flex: 1, minWidth: 0, color: 'var(--color-text-main)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={nama}>
                  {nama}
                </span>
                {/* Ujian baru ditandai di barisnya sendiri. Salah ketik seperti
                    "Kuis Pertemuan I" hanya terlihat sebagai salah ketik bila
                    tampil sebagai ujian baru di samping ujian yang seharusnya.

                    A new exam is flagged on its own row. A typo like "Kuis
                    Pertemuan I" only shows up as one when it appears as a new exam
                    beside the exam it was meant to be. */}
                {newExams.some((b) => b.title === nama) && (
                  <span style={{ flexShrink: 0, fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                    BARU · {EXAM_KIND_LABELS[newExams.find((b) => b.title === nama)!.kind]}
                  </span>
                )}
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
          {newExams.length > 0 && (
            <div style={{ fontSize: '10px', color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)', padding: '9px 11px', borderRadius: '8px', lineHeight: 1.6 }}>
              <strong>{newExams.length} ujian baru akan dibuat</strong> sebagai draf. Periksa judulnya di atas: salah ketik akan
              menjadi ujian terpisah. Terbitkan dari halaman kelas setelah soalnya diperiksa.
            </div>
          )}

          {akanTerganti > 0 && (
            <div style={{ fontSize: '10px', color: '#7a5f00', backgroundColor: 'var(--color-warning-light)', padding: '9px 11px', borderRadius: '8px', lineHeight: 1.6 }}>
              <strong>{akanTerganti} soal yang sudah ada akan terhapus</strong> dan digantikan isi berkas ini. Soal pada ujian
              yang tidak disebut berkas ini tidak tersentuh.
            </div>
          )}

          <div style={{ display: 'flex', gap: '7px' }}>
            <Button variant="secondary" onClick={() => { setPreview(null); setRowErrors([]); setNewExams([]); }} disabled={busy} style={{ fontSize: '11px', padding: '8px 12px' }}>
              Batal
            </Button>
            <Button variant="primary" onClick={kirim} disabled={busy || total === 0} style={{ fontSize: '11px', padding: '8px 12px' }}>
              {busy ? 'Mengimpor...' : `Impor ${total} Soal`}
            </Button>
          </div>
        </div>
      )}

      {menungguStatus.length > 0 && (
        <StatusDialog
          classId={classId}
          examIds={menungguStatus}
          onDone={(pesan) => {
            setMenungguStatus([]);
            if (pesan) setDone((d) => `${d ?? ''}. ${pesan}`);
            onImported();
          }}
        />
      )}
    </div>
  );
}

/**
 * Konfirmasi status ujian setelah impor selesai.
 *
 * Pilihannya hanya dua -- semua terbit atau semua tetap draf -- bukan per
 * ujian: memilih empat belas status satu per satu adalah pekerjaan halaman
 * kelas, dan dialog ini ada untuk keputusan yang diambil sekaligus.
 *
 * Akibat menerbitkan disebut terang: tidak ada pembatasan menurut tanggal
 * pertemuan, sehingga kuis pertemuan terakhir pun dapat dikerjakan hari itu
 * juga. Admin yang tidak tahu ini akan menerbitkan semuanya demi kepraktisan,
 * lalu mendapati peserta mengerjakan kuis materi yang belum diajarkan.
 *
 * Confirms the exams' status once the import finishes.
 *
 * There are only two choices -- all published or all kept as drafts -- not one
 * per exam: choosing fourteen statuses one by one is the class page's job, and
 * this dialog exists for a decision made all at once.
 *
 * The consequence of publishing is stated plainly: nothing gates exams by meeting
 * date, so even the final meeting's quiz can be taken that same day. An admin
 * unaware of this would publish everything for convenience and then find
 * participants sitting quizzes on material not yet taught.
 */
function StatusDialog({
  classId,
  examIds,
  onDone,
}: {
  classId: string;
  examIds: string[];
  onDone: (pesan: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function terbitkan() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/exams/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, examIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menerbitkan ujian');
      onDone(`${data.published} ujian terbit`);
    } catch (e) {
      // Dialognya tetap terbuka saat gagal: menutupnya membuat admin mengira
      // ujiannya sudah terbit padahal masih draf.
      //
      // The dialog stays open on failure: closing it would have the admin believe
      // the exams were published while they are still drafts.
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-impor-judul"
      style={{
        position: 'fixed', inset: 0, zIndex: 100, padding: '16px',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Tidak tertutup dengan mengeklik latarnya: menutupnya tanpa memilih
          adalah keputusan "biarkan draf" yang diambil tanpa sengaja.

          It does not close on a backdrop click: closing it without choosing would
          be a "keep as drafts" decision taken by accident. */}
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', padding: '22px', width: '100%', maxWidth: '440px' }}>
        <h2 id="status-impor-judul" style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, margin: '0 0 6px', color: 'var(--color-text-main)' }}>
          Impor selesai. Terbitkan sekarang?
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 12px', lineHeight: 1.6 }}>
          <strong>{examIds.length} ujian</strong> dari impor ini masih berstatus draf dan belum terlihat peserta.
        </p>

        <div style={{ fontSize: '11px', color: '#7a5f00', backgroundColor: 'var(--color-warning-light)', padding: '10px 12px', borderRadius: '8px', lineHeight: 1.6, marginBottom: '14px' }}>
          Bila diterbitkan, <strong>seluruhnya langsung dapat dikerjakan peserta hari ini</strong>, termasuk kuis untuk
          pertemuan yang belum berlangsung. Ujian tidak terbuka mengikuti tanggal pertemuannya.
        </div>

        {error && (
          <p role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)', margin: '0 0 12px', whiteSpace: 'pre-line' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => onDone('Seluruhnya tetap draf')} disabled={busy} style={{ fontSize: '11px', padding: '9px 14px' }}>
            Biarkan Draf
          </Button>
          <Button variant="primary" onClick={terbitkan} disabled={busy} style={{ fontSize: '11px', padding: '9px 14px' }}>
            {busy ? 'Menerbitkan...' : `Terbitkan Semua (${examIds.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
