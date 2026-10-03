'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Check, Clock, Trash2 } from 'lucide-react';
import { ImportQuestions } from '../../kelas/[classId]/import-questions';
import { ExamRoster } from './exam-roster';
import { AddQuestionButton, QuestionEditor, QuestionList, kurangLengkap, type AdminQuestion } from './question-editor';
import { EXAM_KIND_LABELS, MAX_ATTEMPTS, type ExamDocument } from '@/features/exams/types';
import s from './editor.module.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Penyusun soal sebuah ujian, berlayar penuh.
 *
 * Tanpa kerangka aplikasi: menyusun dua puluh soal berlangsung lama, dan menu
 * ke halaman lain hanya memakan lebar yang dibutuhkan soal beserta pilihan dan
 * gambarnya. Jalan kembali tetap ada pada tombol di kiri atas.
 *
 * Daftar soalnya di kolom kiri yang digulir sendiri, satu soal disunting di
 * kanan. Dua puluh soal yang bertumpuk ke bawah menuntut admin menggulir
 * melewati sembilan belas soal untuk mencapai yang terakhir.
 *
 * An exam's question editor, full screen.
 *
 * No application shell: composing twenty questions is long-running work, and
 * navigation to other pages only eats the width the questions, their options, and
 * their images need. The way back stays as a button at the top left.
 *
 * Its question list sits in a left column that scrolls on its own, with one
 * question edited on the right. Twenty questions stacked downward would have an
 * admin scroll past nineteen to reach the last.
 */
export default function ExamEditorPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = React.use(params);
  const router = useRouter();

  const [exam, setExam] = useState<ExamDocument | null>(null);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  /**
   * Penghitung penyimpanan yang sedang berjalan.
   *
   * Yang dihitung adalah berapa yang masih berjalan, bukan yang terakhir
   * selesai: berpindah kolom dengan cepat membuat beberapa penyimpanan tumpang
   * tindih, dan menandainya "Tersimpan" saat yang terakhir selesai akan
   * menyatakan aman padahal yang lain masih di jalan.
   *
   * A counter of writes in flight.
   *
   * It counts how many are still running rather than which finished last: moving
   * between fields quickly overlaps writes, and marking "Tersimpan" when the last
   * one lands would declare safety while others are still on their way.
   */
  const berjalan = useRef(0);
  const gagal = useRef(false);

  const lacak = useCallback(async (p: Promise<unknown>) => {
    berjalan.current += 1;
    setSaveState('saving');
    try {
      await p;
    } catch (e) {
      gagal.current = true;
      throw e;
    } finally {
      berjalan.current -= 1;
      if (berjalan.current === 0) {
        setSaveState(gagal.current ? 'error' : 'saved');
        gagal.current = false;
      }
    }
  }, []);

  // Ujian dan soalnya diambil bersamaan: keduanya dibutuhkan untuk menggambar
  // halaman ini, dan berurutan hanya menggandakan waktu tunggunya.
  //
  // The exam and its questions are fetched together: both are needed to draw this
  // page, and doing them in sequence only doubles the wait.
  const load = useCallback(async () => {
    try {
      const [e, q] = await Promise.all([
        fetch(`/api/exams/${examId}/meta`),
        fetch(`/api/exams/${examId}/questions`),
      ]);
      if (!e.ok) throw new Error((await e.json()).error || 'Ujian tidak ditemukan');
      setExam((await e.json()).exam as ExamDocument);
      if (q.ok) setQuestions((await q.json()).questions || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => { load(); }, [load]);

  async function reloadQuestions() {
    const [q, m] = await Promise.all([
      fetch(`/api/exams/${examId}/questions`),
      fetch(`/api/exams/${examId}/meta`),
    ]);
    if (q.ok) setQuestions((await q.json()).questions || []);
    if (m.ok) setExam((await m.json()).exam);
  }

  async function patchExam(body: Record<string, unknown>) {
    await lacak(
      (async () => {
        const res = await fetch(`/api/exams/${examId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Gagal menyimpan');
        const r = await fetch(`/api/exams/${examId}/meta`);
        if (r.ok) setExam((await r.json()).exam);
      })()
    ).catch((e) => setError((e as Error).message));
  }

  async function saveQuestion(id: string, patch: Partial<AdminQuestion>) {
    // Yang di layar diperbarui lebih dulu, lalu dikirim: menunggu jawaban server
    // membuat tiap perpindahan kolom terasa tersendat setengah detik.
    //
    // The screen updates first, then the write goes out: waiting for the server
    // would make every field change stall for half a second.
    setQuestions((p) => p.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    await lacak(
      (async () => {
        const res = await fetch(`/api/exams/questions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: patch.kind,
            text: patch.text,
            imageUrl: patch.imageUrl ?? null,
            imagePath: patch.imagePath ?? null,
            options: patch.options?.map((o) => ({ text: o.text, imageUrl: o.imageUrl, imagePath: o.imagePath })),
            correctIndex: Math.max(0, patch.options?.findIndex((o) => o.id === patch.correctOptionId) ?? 0),
            explanation: patch.explanation,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Gagal menyimpan soal');
      })()
    ).catch((e) => setError((e as Error).message));
  }

  async function addQuestion(dari?: AdminQuestion) {
    setAdding(true);
    setError(null);
    try {
      const isi = dari ?? {
        kind: 'pilihan-ganda' as const,
        text: '',
        imageUrl: null,
        imagePath: null,
        options: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
        correctIndex: 0,
        explanation: '',
      };
      const res = await fetch(`/api/exams/${examId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: isi.kind,
          // Soal baru yang kosong ditolak pemeriksaan isinya, jadi diberi
          // pertanyaan sementara. Admin langsung menimpanya di kolom pertama.
          //
          // A blank new question fails validation, so it carries a placeholder.
          // The admin overwrites it in the first field.
          text: 'text' in isi && isi.text ? isi.text : 'Pertanyaan baru',
          imageUrl: isi.imageUrl ?? null,
          imagePath: isi.imagePath ?? null,
          options: isi.options.map((o, i) => ({
            text: o.text?.trim() ? o.text : `Pilihan ${String.fromCharCode(65 + i)}`,
            imageUrl: 'imageUrl' in o ? o.imageUrl : null,
            imagePath: 'imagePath' in o ? o.imagePath : null,
          })),
          correctIndex:
            dari !== undefined
              ? Math.max(0, dari.options.findIndex((o) => o.id === dari.correctOptionId))
              : 0,
          explanation: 'explanation' in isi ? isi.explanation : '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah soal');
      await reloadQuestions();
      // Soal baru langsung terpilih: menambah lalu mencarinya sendiri di daftar
      // adalah dua langkah untuk satu maksud.
      //
      // The new question is selected at once: adding it then finding it in the
      // list would be two steps for one intent.
      setSelected(data.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function removeQuestion(q: AdminQuestion) {
    if (!confirm(`Hapus soal ini beserta gambarnya?\n\n${q.text.slice(0, 80) || '(soal bergambar)'}`)) return;
    await fetch(`/api/exams/questions/${q.id}`, { method: 'DELETE' });
    if (selected === q.id) setSelected(null);
    await reloadQuestions();
  }

  async function moveQuestion(from: number, to: number) {
    if (to < 0 || to >= questions.length) return;
    const urut = [...questions];
    [urut[from], urut[to]] = [urut[to], urut[from]];
    setQuestions(urut);
    await lacak(
      fetch(`/api/exams/${examId}/questions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: urut.map((q) => q.id) }),
      }).then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || 'Gagal mengurutkan soal');
      })
    ).catch((e) => {
      setError((e as Error).message);
      reloadQuestions();
    });
  }

  if (loading) {
    return <div className={s.empty} style={{ padding: '80px' }}>Memuat penyunting...</div>;
  }

  if (!exam) {
    return (
      <div className={s.empty} style={{ padding: '80px' }}>
        <p role="alert" style={{ color: 'var(--color-danger)' }}>{error ?? 'Ujian tidak ditemukan'}</p>
        <button type="button" className={s.btn} onClick={() => router.back()} style={{ marginTop: '12px' }}>Kembali</button>
      </div>
    );
  }

  const current = questions.find((q) => q.id === selected) ?? questions[0] ?? null;
  const belumLengkap = questions.filter(kurangLengkap);

  return (
    <div className={s.shell}>
      <header className={s.topbar}>
        <button
          type="button"
          className={s.back}
          onClick={() => router.push(`/admin/kelas/${exam.classId}`)}
          aria-label="Kembali ke kelas"
          title="Kembali ke kelas"
        >
          <ArrowLeft size={15} strokeWidth={2} />
        </button>

        <div className={s.identity}>
          <h1 className={s.examTitle}>{exam.title}</h1>
          <p className={s.examMeta}>
            {EXAM_KIND_LABELS[exam.kind]} · {questions.length} soal · KKM {exam.passingScore}
            {exam.durationMinutes !== null && ` · ${exam.durationMinutes} menit`}
          </p>
        </div>

        <div className={s.actions}>
          {/* Keadaan penyimpanan disebut. Autosave yang tidak terlihat membuat
              admin menutup tab sebelum tulisannya selesai, dan yang hilang tidak
              pernah ia sadari.

              The save state is stated. Invisible autosave has an admin close the
              tab before the write lands, and what is lost is never noticed. */}
          {saveState !== 'idle' && (
            <span
              role="status"
              className={`${s.saveState} ${saveState === 'error' ? s.saveError : ''} ${saveState === 'saved' ? s.saveDone : ''}`}
            >
              {saveState === 'saving' && <><span className={s.spinner} /> Menyimpan</>}
              {saveState === 'saved' && <><Check size={12} strokeWidth={3} /> Tersimpan</>}
              {saveState === 'error' && <><AlertCircle size={12} strokeWidth={2.5} /> Gagal menyimpan</>}
            </span>
          )}

          <span className={`${s.badge} ${exam.published ? s.badgeLive : s.badgeDraft}`}>
            {exam.published ? 'TERBIT' : 'DRAF'}
          </span>

          <button
            type="button"
            className={`${s.btn} ${exam.published ? '' : s.btnPrimary}`}
            onClick={() => patchExam({ published: !exam.published })}
            disabled={!exam.published && questions.length === 0}
            title={!exam.published && questions.length === 0 ? 'Tambahkan satu soal lebih dulu' : undefined}
          >
            {exam.published ? 'Tarik' : 'Terbitkan'}
          </button>

          {/* Hapus berada di kepala sebagai ikon, bukan sebagai kartu di dasar
              halaman. Di dasar, ia menjadi hal terakhir yang terbaca setiap kali
              admin menggulir mencari sesuatu yang lain -- dan tindakan yang
              memusnahkan hasil kerja peserta tidak layak menjadi tujuan akhir
              gulirannya.

              Delete sits in the header as an icon rather than a card at the foot
              of the page. At the foot it becomes the last thing read every time an
              admin scrolls looking for something else -- and an action that
              destroys participant work does not deserve to be where scrolling
              ends. */}
          <button
            type="button"
            className={`${s.iconBtn} ${s.headerDanger}`}
            aria-label="Hapus ujian"
            title="Hapus ujian"
            onClick={async () => {
              if (!confirm(`Hapus ${exam.title} beserta seluruh soal dan hasil pengerjaannya?

Hasil pengerjaan peserta ikut terhapus dan tidak dapat dikembalikan.`)) return;
              await fetch(`/api/exams/${examId}`, { method: 'DELETE' });
              router.push(`/admin/kelas/${exam.classId}`);
            }}
          >
            <Trash2 size={14} strokeWidth={2} />
          </button>
        </div>
      </header>

      <div className={s.body}>
        <aside className={s.sidebar}>
          <div className={s.sidebarHead}>
            <span>SOAL ({questions.length})</span>
            {belumLengkap.length > 0 && (
              <span style={{ color: 'var(--color-warning)' }}>{belumLengkap.length} belum lengkap</span>
            )}
          </div>

          <div className={s.sidebarScroll}>
            {questions.length === 0 ? (
              <p className={s.empty}>Belum ada soal.</p>
            ) : (
              <QuestionList
                questions={questions}
                selectedId={current?.id ?? null}
                onSelect={setSelected}
                onMove={moveQuestion}
              />
            )}
          </div>

          <div className={s.sidebarFoot}>
            <AddQuestionButton onAdd={() => addQuestion()} busy={adding} />
          </div>
        </aside>

        <main className={s.main}>
          <div className={s.pane}>
            {error && <div role="alert" className={s.warn}>{error}</div>}

            {/* Ujian terbit tanpa soal pernah terjadi dan tidak terlihat dari
                daftar kelas: peserta membukanya lalu menemukan halaman kosong.

                A published exam with no questions has happened and is invisible
                from the class list: a participant opens it and finds an empty
                page. */}
            {exam.published && questions.length === 0 && (
              <div className={s.notice}>
                Ujian ini sudah terbit tetapi belum punya soal. Peserta yang membukanya akan menemukan halaman kosong.
              </div>
            )}

            <ExamSettings exam={exam} onPatch={patchExam} />

            {current ? (
              <QuestionEditor
                key={current.id}
                examId={examId}
                question={current}
                index={questions.indexOf(current)}
                onSave={(patch) => saveQuestion(current.id, patch)}
                onDuplicate={() => addQuestion(current)}
                onDelete={() => removeQuestion(current)}
              />
            ) : (
              <div className={s.card}>
                <p className={s.empty}>
                  Belum ada soal. Tambahkan satu lewat tombol di kiri, atau unggah berkas Excel di bawah.
                </p>
              </div>
            )}

            {/* Tanpa kartu pembungkus: ImportQuestions sudah menggambar
                kotaknya sendiri lengkap dengan judul dan tombol contohnya, dan
                membungkusnya lagi menampilkan judul serta tombol itu dua kali.

                No wrapping card: ImportQuestions already draws its own box with
                its heading and template button, and wrapping it again shows both
                of them twice. */}
            <ImportQuestions examId={examId} onImported={reloadQuestions} />

            {/* Rekap hanya untuk ujian yang sudah terbit: ujian draf belum
                terlihat peserta, sehingga "0 dari 21" hanya menyesatkan.

                The roster is for published exams only: a draft is not visible to
                participants, so "0 of 21" would only mislead. */}
            {exam.published && (
              <div className={s.card}>
                <div className={s.cardHead}>
                  <h2 className={s.cardTitle}>Pengerjaan peserta</h2>
                </div>
                <ExamRoster examId={examId} />
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * Pengaturan ujian, disimpan saat kolomnya ditinggalkan.
 *
 * Settings for the exam, saved when a field is left.
 */
function ExamSettings({ exam, onPatch }: { exam: ExamDocument; onPatch: (b: Record<string, unknown>) => void }) {
  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <h2 className={s.cardTitle}>Pengaturan ujian</h2>
      </div>

      <div>
        <label className={s.label} htmlFor="ex-title">JUDUL</label>
        <input
          id="ex-title"
          defaultValue={exam.title}
          onBlur={(e) => {
            const v = e.target.value.trim();
            // Judul kosong ditolak, bukan disimpan: ujian tanpa judul tidak dapat
            // dibedakan dari ujian lain pada daftar kelasnya.
            //
            // A blank title is refused rather than saved: an untitled exam cannot
            // be told apart from another in its class list.
            if (!v) { e.target.value = exam.title; return; }
            if (v !== exam.title) onPatch({ title: v });
          }}
          className={s.input}
        />
      </div>

      <div className={s.row}>
        <div style={{ flex: '0 0 150px' }}>
          <label className={s.label} htmlFor="ex-duration">
            <Clock size={10} strokeWidth={2} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '3px' }} />
            DURASI (MENIT)
          </label>
          <input
            id="ex-duration"
            type="number"
            min={0}
            defaultValue={exam.durationMinutes ?? ''}
            placeholder="tanpa batas"
            onBlur={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              if (v !== exam.durationMinutes) onPatch({ durationMinutes: v });
            }}
            className={s.input}
          />
        </div>

        <div style={{ flex: '0 0 110px' }}>
          <label className={s.label} htmlFor="ex-kkm">KKM</label>
          <input
            id="ex-kkm"
            type="number"
            min={0}
            max={100}
            defaultValue={exam.passingScore}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v !== exam.passingScore) onPatch({ passingScore: v });
            }}
            className={s.input}
          />
        </div>
      </div>

      <p className={s.hint}>
        {MAX_ATTEMPTS} kesempatan. Percobaan kedua dan ketiga yang lulus bernilai tepat {exam.passingScore}.
      </p>
    </div>
  );
}
