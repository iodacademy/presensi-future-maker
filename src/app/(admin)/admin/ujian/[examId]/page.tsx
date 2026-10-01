'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Check, X, ImagePlus, Clock } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { ImportQuestions } from '../../kelas/[classId]/import-questions';
import { TemplateDownloadButton } from '../../kelas/[classId]/question-template';
import { ExamRoster } from './exam-roster';
import {
  EXAM_KIND_LABELS,
  MAX_ATTEMPTS,
  QUESTION_KIND_LABELS,
  type ExamDocument,
  type QuestionKind,
} from '@/features/exams/types';

type AdminQuestion = {
  id: string;
  kind: QuestionKind;
  text: string;
  imageUrl?: string | null;
  options: { id: string; text: string; imageUrl?: string | null }[];
  order: number;
  correctOptionId: string;
  explanation: string;
};

interface DraftOption {
  text: string;
  imageUrl: string | null;
  imagePath: string | null;
}

interface Draft {
  kind: QuestionKind;
  text: string;
  imageUrl: string | null;
  imagePath: string | null;
  options: DraftOption[];
  correctIndex: number;
  explanation: string;
}

const OPSI_KOSONG: DraftOption = { text: '', imageUrl: null, imagePath: null };

function draftKosong(kind: QuestionKind = 'pilihan-ganda'): Draft {
  return {
    kind,
    text: '',
    imageUrl: null,
    imagePath: null,
    options:
      kind === 'benar-salah'
        ? [{ ...OPSI_KOSONG, text: 'Benar' }, { ...OPSI_KOSONG, text: 'Salah' }]
        : [{ ...OPSI_KOSONG }, { ...OPSI_KOSONG }, { ...OPSI_KOSONG }, { ...OPSI_KOSONG }],
    correctIndex: 0,
    explanation: '',
  };
}

/**
 * Penyusun soal sebuah ujian.
 *
 * Berhalaman sendiri, bukan di dalam kartu pertemuan: dua puluh soal beserta
 * pilihan dan gambarnya tidak muat pada kartu yang melebar, dan menyunting
 * soal panjang di dalam ruang sesempit itu membuat kalimatnya tidak terbaca
 * utuh saat diperiksa.
 *
 * An exam's question editor.
 *
 * On its own page rather than inside a meeting card: twenty questions with
 * their options and images do not fit in an expanding card, and editing a long
 * question in that narrow space leaves the sentence unreadable while it is
 * being checked.
 */
export default function ExamEditorPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = React.use(params);
  const router = useRouter();

  const [exam, setExam] = useState<ExamDocument | null>(null);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [passingScore, setPassingScore] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(draftKosong());
  const [busy, setBusy] = useState(false);

  // Ujian dan soalnya diambil bersamaan: keduanya dibutuhkan untuk menggambar
  // halaman ini, dan berurutan hanya menggandakan waktu tunggunya.
  //
  // The exam and its questions are fetched together: both are needed to draw
  // this page, and doing them in sequence only doubles the wait.
  const load = useCallback(async () => {
    try {
      const [e, q] = await Promise.all([
        fetch(`/api/exams/${examId}/meta`),
        fetch(`/api/exams/${examId}/questions`),
      ]);

      if (!e.ok) throw new Error((await e.json()).error || 'Ujian tidak ditemukan');
      const data = (await e.json()).exam as ExamDocument;
      setExam(data);
      setTitle(data.title);
      setDuration(data.durationMinutes === null ? '' : String(data.durationMinutes));
      setPassingScore(String(data.passingScore));

      if (q.ok) setQuestions((await q.json()).questions || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => { load(); }, [load]);

  async function patchExam(body: Record<string, unknown>, pesan?: string) {
    setError(null);
    const res = await fetch(`/api/exams/${examId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError((await res.json()).error || 'Gagal menyimpan');
      return false;
    }
    if (pesan) setStatus(pesan);
    const r = await fetch(`/api/exams/${examId}/meta`);
    if (r.ok) setExam((await r.json()).exam);
    return true;
  }

  async function saveMeta() {
    setSavingMeta(true);
    await patchExam(
      {
        title,
        durationMinutes: duration === '' ? null : Number(duration),
        passingScore: Number(passingScore),
      },
      'Pengaturan ujian tersimpan'
    );
    setSavingMeta(false);
  }

  async function reloadQuestions() {
    const res = await fetch(`/api/exams/${examId}/questions`);
    if (res.ok) setQuestions((await res.json()).questions || []);
    const r = await fetch(`/api/exams/${examId}/meta`);
    if (r.ok) setExam((await r.json()).exam);
  }

  async function saveQuestion() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/exams/${examId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: draft.kind,
          text: draft.text,
          imageUrl: draft.imageUrl,
          imagePath: draft.imagePath,
          options: draft.options.map((o) => ({ text: o.text, imageUrl: o.imageUrl, imagePath: o.imagePath })),
          correctIndex: draft.correctIndex,
          explanation: draft.explanation,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal menyimpan soal');
      setDraft(draftKosong(draft.kind));
      setAdding(false);
      await reloadQuestions();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeQuestion(q: AdminQuestion) {
    if (!confirm('Hapus soal ini beserta gambarnya?')) return;
    await fetch(`/api/exams/questions/${q.id}`, { method: 'DELETE' });
    reloadQuestions();
  }

  if (loading || !exam) {
    return (
      <AppShell role="admin" userName="Administrator">
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          {error ?? 'Memuat ujian...'}
        </div>
      </AppShell>
    );
  }

  const field: React.CSSProperties = {
    padding: '9px 11px', borderRadius: '8px',
    border: '1px solid var(--color-border)', fontSize: '12px', width: '100%',
  };

  return (
    <AppShell role="admin" userName="Administrator">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Link href={`/admin/kelas/${exam.classId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)', textDecoration: 'none', fontSize: '11px', fontWeight: 600, alignSelf: 'flex-start' }}>
          <ArrowLeft size={12} strokeWidth={2} /> Kembali ke Kelas
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
              {exam.title}
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' }}>
              {EXAM_KIND_LABELS[exam.kind]} - {exam.questionCount} soal - KKM {exam.passingScore}
              {exam.durationMinutes !== null && ` - ${exam.durationMinutes} menit`}
            </p>
          </div>
          <span style={{ fontSize: '8px', fontWeight: 700, padding: '4px 10px', borderRadius: '10px', whiteSpace: 'nowrap', backgroundColor: exam.published ? 'var(--color-success)' : 'var(--color-border)', color: exam.published ? '#ffffff' : 'var(--color-text-muted)' }}>
            {exam.published ? 'TERBIT' : 'DRAF'}
          </span>
        </div>
      </div>

      {status && (
        <div role="status" style={{ padding: '9px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)' }}>
          {status}
        </div>
      )}
      {error && (
        <div role="alert" style={{ padding: '9px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '760px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)' }}>PENGATURAN UJIAN</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Judul ujian" style={field} />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={12} strokeWidth={2} />
            <input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              aria-label="Durasi dalam menit"
              placeholder="30"
              style={{ ...field, width: '80px' }}
            />
            menit, kosongkan untuk tanpa batas
          </label>
          <label style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            KKM
            <input
              type="number"
              min={0}
              max={100}
              value={passingScore}
              onChange={(e) => setPassingScore(e.target.value)}
              aria-label="Nilai minimum lulus"
              style={{ ...field, width: '70px' }}
            />
          </label>
        </div>
        <Button variant="primary" onClick={saveMeta} disabled={savingMeta || !title.trim()} style={{ fontSize: '11px', padding: '9px 14px', alignSelf: 'flex-start' }}>
          {savingMeta ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxWidth: '760px' }}>
        <TemplateDownloadButton compact showColumns />
      </div>

      <div style={{ maxWidth: '760px' }}>
        <ImportQuestions examId={examId} onImported={reloadQuestions} />
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '760px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)' }}>SOAL</div>

        {questions.length === 0 ? (
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', padding: '6px 0' }}>
            Belum ada soal. Unggah berkas Excel di atas, atau tambahkan satu per satu di bawah.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {questions.map((q, i) => (
              <div key={q.id} style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--color-bg-app)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', flexShrink: 0 }}>{i + 1}.</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {q.text && (
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: 1.5 }}>
                        {q.text}
                      </div>
                    )}
                    {q.imageUrl && (
                      <img src={q.imageUrl} alt="" style={{ display: 'block', maxWidth: '240px', maxHeight: '140px', marginTop: '6px', borderRadius: '8px', border: '1px solid var(--color-border)' }} />
                    )}
                    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {q.options.map((o) => {
                        const benar = o.id === q.correctOptionId;
                        return (
                          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: benar ? 'var(--color-success)' : 'var(--color-text-muted)', fontWeight: benar ? 700 : 400 }}>
                            {benar ? <Check size={11} strokeWidth={3} style={{ flexShrink: 0 }} /> : <span style={{ width: '11px', flexShrink: 0 }} />}
                            {o.imageUrl && (
                              <img src={o.imageUrl} alt="" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '5px', border: '1px solid var(--color-border)', flexShrink: 0 }} />
                            )}
                            <span>{o.text}</span>
                          </div>
                        );
                      })}
                    </div>
                    {q.explanation && (
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '5px', fontStyle: 'italic' }}>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`Hapus soal ${i + 1}`}
                    onClick={() => removeQuestion(q)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '3px', flexShrink: 0 }}
                  >
                    <Trash2 size={13} color="var(--color-danger)" strokeWidth={2} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {adding ? (
          <QuestionForm
            examId={examId}
            draft={draft}
            setDraft={setDraft}
            busy={busy}
            onCancel={() => { setAdding(false); setDraft(draftKosong(draft.kind)); }}
            onSubmit={saveQuestion}
          />
        ) : (
          <Button
            variant="secondary"
            onClick={() => setAdding(true)}
            style={{ fontSize: '11px', padding: '9px 14px', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <Plus size={12} strokeWidth={2} /> Tambah Soal
          </Button>
        )}
      </div>

      {/* Rekap hanya untuk ujian yang sudah terbit: ujian draf belum terlihat
          peserta, sehingga "0 dari 21" hanya menyesatkan.

          The roster is for published exams only: a draft is not visible to
          participants, so "0 of 21" would only mislead. */}
      {exam.published && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '16px', maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)' }}>PENGERJAAN PESERTA</div>
          <ExamRoster examId={examId} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', maxWidth: '760px' }}>
        <Button
          variant={exam.published ? 'secondary' : 'primary'}
          onClick={() => patchExam({ published: !exam.published }, exam.published ? 'Ujian ditarik dari peserta' : 'Ujian diterbitkan')}
          style={{ fontSize: '11px', padding: '9px 14px' }}
        >
          {exam.published ? 'Tarik dari Peserta' : 'Terbitkan'}
        </Button>
        <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', lineHeight: 1.5, flex: 1, minWidth: '240px' }}>
          {MAX_ATTEMPTS} kesempatan. Percobaan kedua dan ketiga yang lulus bernilai tepat {exam.passingScore}.
        </span>
        <button
          type="button"
          onClick={async () => {
            if (!confirm(`Hapus ${exam.title} beserta seluruh soal dan hasil pengerjaannya?`)) return;
            await fetch(`/api/exams/${examId}`, { method: 'DELETE' });
            router.push(`/admin/kelas/${exam.classId}`);
          }}
          style={{ padding: '9px 14px', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--color-danger)', backgroundColor: '#ffffff', color: 'var(--color-danger)', fontSize: '11px', fontWeight: 700 }}
        >
          Hapus Ujian
        </button>
      </div>
    </AppShell>
  );
}

/**
 * Pengunggah satu gambar.
 *
 * Mengunggah segera setelah dipilih, bukan menunggu soalnya disimpan: tautan
 * gambarnya sudah ada saat soalnya dikirim, sehingga pengiriman soal tidak
 * perlu menunggu unggahan selesai dan kegagalan unggah tidak menyeret seluruh
 * soalnya.
 *
 * A single image uploader.
 *
 * It uploads as soon as a file is picked rather than waiting for the question
 * to save: the image link already exists when the question is sent, so sending
 * the question need not wait for an upload and a failed upload does not drag
 * the whole question down with it.
 */
function ImageField({
  examId,
  url,
  onChange,
  label,
  size = 'besar',
}: {
  examId: string;
  url: string | null;
  onChange: (v: { imageUrl: string | null; imagePath: string | null }) => void;
  label: string;
  size?: 'besar' | 'kecil';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pilih(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('examId', examId);
      const res = await fetch('/api/uploads/exam-image', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah gambar');
      onChange({ imageUrl: data.url, imagePath: data.path });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const sisi = size === 'besar' ? 120 : 52;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {url ? (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img src={url} alt="" style={{ width: `${sisi}px`, height: `${sisi}px`, objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'block' }} />
          <button
            type="button"
            aria-label={`Hapus ${label}`}
            onClick={() => onChange({ imageUrl: null, imagePath: null })}
            style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', border: 'none', cursor: 'pointer', backgroundColor: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            <X size={11} color="#ffffff" strokeWidth={3} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          style={{
            width: `${sisi}px`, height: `${sisi}px`, borderRadius: '8px', cursor: busy ? 'default' : 'pointer', flexShrink: 0,
            border: '1px dashed var(--color-border)', backgroundColor: '#ffffff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px',
            fontSize: '9px', color: 'var(--color-text-muted)',
          }}
        >
          <ImagePlus size={size === 'besar' ? 18 : 14} strokeWidth={2} />
          {busy ? 'Mengunggah' : label}
        </button>
      )}

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={pilih} aria-label={label} style={{ display: 'none' }} />

      {error && <span role="alert" style={{ fontSize: '9px', color: 'var(--color-danger)' }}>{error}</span>}
    </div>
  );
}

function QuestionForm({
  examId,
  draft,
  setDraft,
  busy,
  onCancel,
  onSubmit,
}: {
  examId: string;
  draft: Draft;
  setDraft: (d: Draft) => void;
  busy: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const field: React.CSSProperties = {
    padding: '9px 11px', borderRadius: '8px',
    border: '1px solid var(--color-border)', fontSize: '12px', width: '100%',
  };

  function gantiJenis(k: QuestionKind) {
    setDraft({ ...draftKosong(k), text: draft.text, imageUrl: draft.imageUrl, imagePath: draft.imagePath });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', padding: '14px', borderRadius: '10px', border: '1px solid var(--color-primary)', backgroundColor: '#ffffff' }}>
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        {(Object.keys(QUESTION_KIND_LABELS) as QuestionKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => gantiJenis(k)}
            aria-pressed={draft.kind === k}
            style={{
              padding: '5px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontSize: '10px', fontWeight: draft.kind === k ? 700 : 400,
              backgroundColor: draft.kind === k ? 'var(--color-primary)' : 'var(--color-border)',
              color: draft.kind === k ? '#ffffff' : 'var(--color-text-main)',
            }}
          >
            {QUESTION_KIND_LABELS[k]}
          </button>
        ))}
      </div>

      <textarea
        value={draft.text}
        onChange={(e) => setDraft({ ...draft, text: e.target.value })}
        placeholder="Pertanyaan. Boleh dikosongkan bila seluruh isinya ada pada gambarnya."
        aria-label="Pertanyaan"
        rows={2}
        autoFocus
        style={{ ...field, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55 }}
      />

      <ImageField
        examId={examId}
        url={draft.imageUrl}
        label="Gambar soal"
        onChange={(v) => setDraft({ ...draft, ...v })}
      />

      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)', marginTop: '3px' }}>
        PILIHAN - KLIK LINGKARAN UNTUK MENANDAI JAWABAN BENAR
      </div>

      {draft.options.map((o, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, correctIndex: i })}
            aria-label={`Tandai pilihan ${String.fromCharCode(65 + i)} sebagai jawaban benar`}
            aria-pressed={draft.correctIndex === i}
            style={{
              width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, cursor: 'pointer', padding: 0,
              border: `2px solid ${draft.correctIndex === i ? 'var(--color-success)' : 'var(--color-border)'}`,
              backgroundColor: draft.correctIndex === i ? 'var(--color-success)' : '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {draft.correctIndex === i && <Check size={12} color="#ffffff" strokeWidth={3} />}
          </button>

          <input
            value={o.text}
            onChange={(e) => setDraft({ ...draft, options: draft.options.map((v, j) => (j === i ? { ...v, text: e.target.value } : v)) })}
            placeholder={`Pilihan ${String.fromCharCode(65 + i)}`}
            aria-label={`Pilihan ${String.fromCharCode(65 + i)}`}
            disabled={draft.kind === 'benar-salah'}
            style={{ ...field, backgroundColor: draft.kind === 'benar-salah' ? 'var(--color-border)' : '#ffffff' }}
          />

          <ImageField
            examId={examId}
            url={o.imageUrl}
            label="Gambar"
            size="kecil"
            onChange={(v) => setDraft({ ...draft, options: draft.options.map((x, j) => (j === i ? { ...x, ...v } : x)) })}
          />

          {draft.kind === 'pilihan-ganda' && draft.options.length > 2 && (
            <button
              type="button"
              aria-label={`Hapus pilihan ${String.fromCharCode(65 + i)}`}
              onClick={() => {
                const sisa = draft.options.filter((_, j) => j !== i);
                // Kunci mengikuti pilihan yang tersisa; dibiarkan, indeksnya
                // dapat menunjuk pilihan yang sudah tidak ada.
                //
                // The key follows the remaining options; left alone, its index
                // could point at one that no longer exists.
                const kunci = draft.correctIndex >= i && draft.correctIndex > 0 ? draft.correctIndex - 1 : draft.correctIndex;
                setDraft({ ...draft, options: sisa, correctIndex: Math.min(kunci, sisa.length - 1) });
              }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
            >
              <Trash2 size={12} color="var(--color-danger)" strokeWidth={2} />
            </button>
          )}
        </div>
      ))}

      {draft.kind === 'pilihan-ganda' && draft.options.length < 5 && (
        <button
          type="button"
          onClick={() => setDraft({ ...draft, options: [...draft.options, { ...OPSI_KOSONG }] })}
          style={{ alignSelf: 'flex-start', border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: '10px', fontWeight: 600, color: 'var(--color-primary)' }}
        >
          + Tambah pilihan
        </button>
      )}

      <input
        value={draft.explanation}
        onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
        placeholder="Pembahasan, ditampilkan setelah kesempatan mengulang habis"
        aria-label="Pembahasan"
        style={field}
      />

      <div style={{ display: 'flex', gap: '7px', justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onCancel} disabled={busy} style={{ fontSize: '11px', padding: '8px 13px' }}>
          Batal
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={busy || (!draft.text.trim() && !draft.imageUrl)}
          style={{ fontSize: '11px', padding: '8px 13px' }}
        >
          {busy ? 'Menyimpan...' : 'Simpan Soal'}
        </Button>
      </div>
    </div>
  );
}
