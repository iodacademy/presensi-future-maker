'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Clock, AlertTriangle, Check, ChevronLeft, ChevronRight, X, Flag, Send, ArrowLeft, Eye, Maximize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { QuestionDocument } from '@/features/exams/types';

interface AttemptState {
  attemptId: string;
  startedAt: string;
  deadline: string | null;
  attemptNumber: number;
  exam: {
    id: string;
    title: string;
    description: string;
    durationMinutes: number | null;
    passingScore: number;
    questionCount: number;
  };
  questions: QuestionDocument[];
  savedAnswers: Record<string, string>;
  savedDoubts: string[];
}

interface Result {
  score: number;
  rawScore: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'offline';

/**
 * Mesin pengerjaan ujian.
 *
 * Satu soal satu layar dengan kerangka tetap: kepala 48px, isi yang bergulir,
 * dan navigasi 64px di bawah. Menampilkan seluruh soal dalam satu gulungan
 * membuat peserta kehilangan tempatnya dan menyulitkan penghitung waktu tetap
 * terlihat.
 *
 * Percobaan baru dibuat setelah peserta menekan tombol mulai, bukan saat
 * halaman dimuat: membuatnya saat memuat berarti tombol kembali, tab yang
 * dipulihkan peramban, dan prefetch ikut menghabiskan kesempatan peserta tanpa
 * ia menjawab apa pun.
 *
 * The exam engine.
 *
 * One question per screen in a fixed shell: a 48px header, a scrolling body,
 * and 64px of navigation below. Showing every question in one scroll loses a
 * participant's place and makes keeping the clock in view harder.
 *
 * An attempt is created after the participant taps start, not on page load:
 * creating it on load means the back button, a tab the browser restored, and
 * prefetching all burn attempts without them answering anything.
 */
export default function ExamRunnerPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = React.use(params);

  const [state, setState] = useState<AttemptState | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [doubtful, setDoubtful] = useState<Record<string, boolean>>({});
  const [index, setIndex] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const submitRef = useRef<(auto: boolean) => void>(() => {});

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/exams/${examId}/attempt`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memulai ujian');
      setState(data);
      setAnswers(data.savedAnswers || {});
      setDoubtful(Object.fromEntries((data.savedDoubts || []).map((id: string) => [id, true])));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const submit = useCallback(
    async (auto: boolean) => {
      if (!state || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(`/api/exams/attempts/${state.attemptId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers, autoSubmitted: auto }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal mengumpulkan ujian');
        setResult(data);
        setConfirming(false);
      } catch (e) {
        // Tombol kirim tetap hidup setelah gagal: kegagalan jaringan bukan
        // alasan untuk kehilangan seluruh jawaban yang sudah diisi.
        //
        // The submit button stays live after a failure: a network failure is no
        // reason to lose every answer already filled in.
        setError((e as Error).message);
      } finally {
        setSubmitting(false);
      }
    },
    [state, answers, submitting]
  );

  submitRef.current = submit;

  // Hitung mundur ditampilkan di peramban, tetapi batas waktunya ditegakkan
  // server saat pengumpulan. Hitungan di peramban dapat dihentikan; yang
  // menentukan terlambat atau tidak adalah waktu mulai milik server.
  //
  // The countdown is displayed in the browser, but the deadline is enforced by
  // the server at submission. A browser countdown can be stopped; what decides
  // late or not is the server's own start time.
  useEffect(() => {
    if (!state?.deadline || result) return;

    const batas = new Date(state.deadline).getTime();
    const tick = () => {
      const sisa = Math.max(0, Math.floor((batas - Date.now()) / 1000));
      setRemaining(sisa);
      if (sisa === 0) submitRef.current(true);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state?.deadline, result]);

  async function persist(questionId: string, selectedOptionId: string | null, ragu: boolean) {
    if (!state) return;
    setSaveState('saving');
    try {
      const res = await fetch(`/api/exams/attempts/${state.attemptId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, selectedOptionId, isDoubtful: ragu }),
      });
      setSaveState(res.ok ? 'saved' : 'offline');
    } catch {
      // Jawaban tetap tersimpan di layar dan ikut terkirim saat pengumpulan,
      // sehingga kegagalan menyimpan bukan kehilangan jawaban.
      //
      // The answer stays on screen and travels with the submission, so a failed
      // save is not a lost answer.
      setSaveState('offline');
    }
  }

  function pick(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    persist(questionId, optionId, doubtful[questionId] === true);
  }

  function toggleDoubt(questionId: string) {
    const next = !doubtful[questionId];
    setDoubtful((prev) => ({ ...prev, [questionId]: next }));
    persist(questionId, answers[questionId] ?? null, next);
  }

  if (result) {
    const dipatok = result.score !== result.rawScore;
    return (
      <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-app)', padding: '24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid var(--color-border)', maxWidth: '420px', width: '100%', overflow: 'hidden', textAlign: 'center' }}>
          {/* Pita hasil diwarnai menurut kelulusan. Belum lulus memakai warna
              peringatan, bukan bahaya: percobaan yang gagal adalah ajakan
              mengulang, bukan kesalahan.

              The result band is tinted by outcome. A fail uses the warning
              colour rather than the danger one: a failed attempt is an
              invitation to retry, not an error. */}
          <div style={{ padding: '32px 24px', backgroundColor: result.passed ? 'var(--color-success-light)' : 'var(--color-warning-light)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>NILAI ANDA</div>
            <div style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1.1, margin: '8px 0', color: result.passed ? 'var(--color-success)' : 'var(--color-warning)' }}>
              {result.score}
            </div>
            <span style={{ display: 'inline-flex', padding: '5px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, backgroundColor: result.passed ? 'var(--color-success)' : 'var(--color-warning)', color: '#ffffff' }}>
              {result.passed ? 'Lulus' : 'Belum Lulus'}
            </span>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '10px' }}>
              {result.correctCount} dari {result.totalQuestions} soal benar - batas lulus {state?.exam.passingScore}
            </div>

            {dipatok && (
              <div style={{ fontSize: '10px', color: '#7c2d12', backgroundColor: '#ffffff', padding: '9px 11px', borderRadius: '8px', marginTop: '12px', lineHeight: 1.5, textAlign: 'left' }}>
                Jawaban benar Anda setara nilai {result.rawScore}. Karena ini percobaan ulang, nilai yang tercatat adalah batas kelulusan.
              </div>
            )}
          </div>

          <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Link href={`/app/ujian/${examId}/hasil/${state?.attemptId ?? ''}`} style={{ textDecoration: 'none' }}>
              <Button variant="primary" style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Eye size={14} strokeWidth={2} /> Lihat Pembahasan
              </Button>
            </Link>
            <Link href="/app/jadwal" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" style={{ width: '100%' }}>Kembali ke Jadwal</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '340px', width: '100%', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(0, 114, 206, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Maximize2 size={30} color="var(--color-primary)" strokeWidth={2} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '17px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Mulai Ujian
          </h1>
          <p style={{ fontSize: '12px', color: '#d4d4d8', margin: '10px 0 0', lineHeight: 1.7 }}>
            Waktu mulai berjalan begitu Anda menekan tombol di bawah, bukan sebelumnya. Jawaban tersimpan otomatis setiap kali Anda memilih, jadi halaman yang dimuat ulang tidak menghapusnya.
          </p>

          {error && (
            <div role="alert" style={{ fontSize: '11px', color: '#ff6b6b', backgroundColor: 'rgba(212, 13, 21, 0.2)', padding: '10px 12px', borderRadius: '8px', marginTop: '16px', lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          <Button variant="primary" onClick={start} disabled={starting} style={{ width: '100%', marginTop: '20px' }}>
            {starting ? 'Menyiapkan...' : 'Mulai Mengerjakan'}
          </Button>
          <Link href="/app/jadwal" style={{ textDecoration: 'none' }}>
            <button type="button" style={{ width: '100%', marginTop: '8px', padding: '11px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#9e9ea0' }}>
              Nanti saja, kembali
            </button>
          </Link>
        </div>
      </main>
    );
  }

  const soal = state.questions[index];
  const terjawab = state.questions.filter((q) => answers[q.id]).length;
  const belumDijawab = state.questions
    .map((q, i) => (answers[q.id] ? null : i))
    .filter((n): n is number => n !== null);
  const menit = remaining !== null ? Math.floor(remaining / 60) : null;
  const detik = remaining !== null ? remaining % 60 : null;
  const mendesak = remaining !== null && remaining <= 30;

  /**
   * Warna satu sel palet nomor.
   *
   * Urutannya penting: sedang dibuka mengalahkan ragu, dan ragu mengalahkan
   * sudah dijawab. Soal yang sudah dijawab tetapi ditandai ragu harus terbaca
   * sebagai ragu -- itulah yang ingin dicari peserta saat meninjau ulang.
   *
   * One palette cell's colour.
   *
   * The order matters: current beats flagged, and flagged beats answered. A
   * question that is answered but flagged must read as flagged -- that is what
   * a participant is looking for when they review.
   */
  function cellStyle(qid: string, i: number): React.CSSProperties {
    if (i === index) {
      return { borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-primary)', color: '#ffffff' };
    }
    if (doubtful[qid]) {
      return { borderColor: 'var(--color-warning)', backgroundColor: 'var(--color-warning-light)', color: '#7c2d12' };
    }
    if (answers[qid]) {
      return { borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' };
    }
    return { borderColor: 'var(--color-border)', backgroundColor: '#ffffff', color: 'var(--color-text-muted)' };
  }

  const paletteCell = (q: QuestionDocument, i: number, size: number) => (
    <button
      key={q.id}
      type="button"
      onClick={() => setIndex(i)}
      aria-label={`Soal ${i + 1}${answers[q.id] ? '' : ', belum dijawab'}${doubtful[q.id] ? ', ditandai ragu' : ''}`}
      aria-current={i === index ? 'true' : undefined}
      style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '8px', flexShrink: 0,
        borderWidth: '1px', borderStyle: 'solid', cursor: 'pointer',
        fontSize: size >= 32 ? '11px' : '10px', fontWeight: 700,
        ...cellStyle(q.id, i),
      }}
    >
      {i + 1}
    </button>
  );

  return (
    <main style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--color-bg-app)' }}>
      <header style={{ height: '48px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: '0 14px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#ffffff' }}>
        <Link href="/app/jadwal" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
          <ArrowLeft size={13} strokeWidth={2} /> Keluar
        </Link>
        <span style={{ width: '1px', height: '16px', backgroundColor: 'var(--color-border)', flexShrink: 0 }} aria-hidden="true" />
        <span style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {state.exam.title}
        </span>

        {/* Penghitung waktu hanya tampil bila ujiannya memang berbatas. Jam
            yang selalu ada pada ujian tanpa batas membuat peserta mengira
            waktunya sedang berjalan.

            The clock appears only when the exam is actually timed. A clock on
            an untimed exam makes participants think time is running. */}
        {remaining !== null && (
          <span
            role="timer"
            aria-live={mendesak ? 'assertive' : 'off'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 9px', borderRadius: '8px',
              fontSize: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0,
              backgroundColor: mendesak ? 'var(--color-danger-light)' : 'var(--color-bg-app)',
              color: mendesak ? 'var(--color-danger)' : 'var(--color-text-muted)',
            }}
          >
            <Clock size={13} strokeWidth={2} />
            {String(menit).padStart(2, '0')}:{String(detik).padStart(2, '0')}
          </span>
        )}
      </header>

      {state.attemptNumber > 1 && (
        <div style={{ backgroundColor: 'var(--color-warning-light)', color: '#7c2d12', padding: '8px 16px', fontSize: '10px', lineHeight: 1.5, flexShrink: 0 }}>
          Percobaan ke-{state.attemptNumber}. Bila lulus, nilai yang tercatat adalah {state.exam.passingScore}, yaitu batas kelulusan.
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '20px 16px' }}>
          {soal && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid var(--color-border)', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
                  SOAL {index + 1} DARI {state.questions.length}
                </span>
                {doubtful[soal.id] && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '9px', fontWeight: 700, backgroundColor: 'var(--color-warning-light)', color: '#7c2d12' }}>
                    <Flag size={10} strokeWidth={2.5} /> Ditandai
                  </span>
                )}
              </div>

              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 }}>
                {soal.text}
              </p>

              <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {soal.options.map((o, i) => {
                  const dipilih = answers[soal.id] === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => pick(soal.id, o.id)}
                      aria-pressed={dipilih}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '13px', borderRadius: '12px',
                        border: `1px solid ${dipilih ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        backgroundColor: dipilih ? 'var(--color-primary-light)' : '#ffffff',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}
                    >
                      <span
                        style={{
                          width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 700,
                          backgroundColor: dipilih ? 'var(--color-primary)' : 'var(--color-bg-app)',
                          color: dipilih ? '#ffffff' : 'var(--color-text-muted)',
                        }}
                      >
                        {dipilih ? <Check size={13} strokeWidth={3} /> : String.fromCharCode(65 + i)}
                      </span>
                      <span style={{ flex: 1, fontSize: '13px', lineHeight: 1.55, whiteSpace: 'pre-wrap', fontWeight: dipilih ? 600 : 400, color: dipilih ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                        {o.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)', padding: '10px 12px', borderRadius: '8px', marginTop: '12px' }}>
              {error}
            </div>
          )}

          {/* Palet melipat ke bawah, bukan bergulir ke samping: strip yang
              bergulir menyembunyikan justru nomor yang sedang dicari peserta.

              The palette wraps rather than scrolling sideways: a scrolling
              strip hides the very number a participant is hunting for. */}
          <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '5px' }}>
            {state.questions.map((q, i) => paletteCell(q, i, 32))}
          </div>

          <p style={{ marginTop: '12px', textAlign: 'center', fontSize: '11px', color: 'var(--color-text-faint)' }}>
            {terjawab} dari {state.questions.length} soal terjawab
          </p>
          <p style={{ marginTop: '2px', textAlign: 'center', fontSize: '10px', fontWeight: 600, color: saveState === 'offline' ? 'var(--color-warning)' : 'var(--color-text-faint)' }}>
            {saveState === 'saving'
              ? 'Menyimpan...'
              : saveState === 'saved'
                ? 'Jawaban tersimpan'
                : saveState === 'offline'
                  ? 'Belum tersimpan di server - jawaban tetap terkirim saat dikumpulkan'
                  : ' '}
          </p>
        </div>
      </div>

      <nav style={{ height: '64px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '0 14px', borderTop: '1px solid var(--color-border)', backgroundColor: '#ffffff' }}>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          style={{
            height: '40px', padding: '0 14px', borderRadius: '12px', cursor: index === 0 ? 'default' : 'pointer',
            border: '1px solid var(--color-border)', backgroundColor: '#ffffff',
            fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)',
            opacity: index === 0 ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}
        >
          <ChevronLeft size={14} strokeWidth={2} /> Sebelumnya
        </button>

        <button
          type="button"
          onClick={() => soal && toggleDoubt(soal.id)}
          aria-pressed={Boolean(soal && doubtful[soal.id])}
          style={{
            height: '40px', padding: '0 14px', borderRadius: '12px', cursor: 'pointer',
            fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px',
            border: `1px solid ${soal && doubtful[soal.id] ? 'var(--color-warning)' : 'var(--color-border)'}`,
            backgroundColor: soal && doubtful[soal.id] ? 'var(--color-warning-light)' : '#ffffff',
            color: soal && doubtful[soal.id] ? '#7c2d12' : 'var(--color-text-muted)',
          }}
        >
          <Flag size={14} strokeWidth={2} /> Ragu
        </button>

        {/* Tombol kanan tidak pernah mati. Soal terakhir dengan lembar yang
            belum penuh mengantar ke soal kosong pertama alih-alih berhenti,
            sehingga peserta tidak terhenti pada tombol yang tidak merespons.

            The right button is never dead. A last question with an incomplete
            sheet jumps to the first gap instead of stopping, so a participant
            is never stuck on a button that does nothing. */}
        {belumDijawab.length === 0 ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{ height: '40px', padding: '0 18px', borderRadius: '12px', cursor: 'pointer', border: 'none', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <Send size={14} strokeWidth={2} /> Kumpulkan
          </button>
        ) : index === state.questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setIndex(belumDijawab[0])}
            style={{ height: '40px', padding: '0 16px', borderRadius: '12px', cursor: 'pointer', border: 'none', backgroundColor: 'var(--color-warning)', color: '#ffffff', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <AlertTriangle size={14} strokeWidth={2} /> {belumDijawab.length} belum
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIndex((i) => i + 1)}
            style={{ height: '40px', padding: '0 18px', borderRadius: '12px', cursor: 'pointer', border: 'none', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            Berikutnya <ChevronRight size={14} strokeWidth={2} />
          </button>
        )}
      </nav>

      {confirming && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div role="dialog" aria-modal="true" aria-label="Konfirmasi pengumpulan" style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '380px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-app)' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>
                Kumpulkan jawaban?
              </h2>
              <button type="button" aria-label="Tutup" onClick={() => setConfirming(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '3px', borderRadius: '6px' }}>
                <X size={15} color="var(--color-text-muted)" strokeWidth={2} />
              </button>
            </div>

            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
                Anda sudah menjawab <strong>{terjawab}</strong> dari <strong>{state.questions.length}</strong> soal. Jawaban tidak dapat diubah setelah dikumpulkan.
              </p>

              {belumDijawab.length > 0 && (
                <div role="alert" style={{ borderRadius: '12px', border: '1px solid var(--color-warning)', backgroundColor: 'var(--color-warning-light)', padding: '12px' }}>
                  <p style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#7c2d12', margin: 0 }}>
                    <AlertTriangle size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
                    {belumDijawab.length} soal belum dijawab
                  </p>
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {belumDijawab.map((i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setIndex(i); setConfirming(false); }}
                        style={{ height: '28px', minWidth: '28px', padding: '0 6px', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--color-warning)', backgroundColor: '#ffffff', fontSize: '11px', fontWeight: 700, color: '#7c2d12' }}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <p style={{ marginTop: '8px', fontSize: '10px', color: '#7c2d12', lineHeight: 1.5, marginBottom: 0 }}>
                    Tekan nomornya untuk membuka soal itu. Soal yang dilewatkan dihitung salah.
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="secondary" onClick={() => setConfirming(false)} disabled={submitting} style={{ flex: 1, fontSize: '11px', padding: '10px' }}>
                  Periksa Lagi
                </Button>
                <Button variant="primary" onClick={() => submit(false)} disabled={submitting} style={{ flex: 1, fontSize: '11px', padding: '10px' }}>
                  {submitting ? 'Mengirim...' : 'Ya, Kumpulkan'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
