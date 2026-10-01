'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Clock, AlertTriangle, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
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
}

interface Result {
  score: number;
  rawScore: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
}

/**
 * Mesin pengerjaan ujian.
 *
 * Percobaan baru dibuat setelah peserta menekan tombol mulai, bukan saat
 * halaman dimuat: membuatnya saat memuat berarti tombol kembali, tab yang
 * dipulihkan peramban, dan prefetch ikut menghabiskan kesempatan peserta tanpa
 * ia menjawab apa pun.
 *
 * The exam engine.
 *
 * An attempt is created after the participant taps start, not on page load:
 * creating it on load means the back button, a tab the browser restored, and
 * prefetching all burn attempts without them answering anything.
 */
export default function ExamRunnerPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = React.use(params);

  const [state, setState] = useState<AttemptState | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

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

  async function pick(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));

    // Disimpan per soal. Satu kali muat ulang atau jaringan terputus tidak
    // boleh menghapus jawaban yang sudah diisi.
    //
    // Saved per question. One reload or dropped connection must not erase
    // answers already filled in.
    if (!state) return;
    try {
      await fetch(`/api/exams/attempts/${state.attemptId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, selectedOptionId: optionId }),
      });
    } catch {
      // Jawaban tetap tersimpan di layar dan ikut terkirim saat pengumpulan.
      // The answer stays on screen and travels with the submission anyway.
    }
  }

  if (result) {
    const dipatok = result.score !== result.rawScore;
    return (
      <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-app)', padding: '24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid var(--color-border)', padding: '28px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)' }}>NILAI ANDA</div>
          <div style={{ fontSize: '48px', fontWeight: 700, color: result.passed ? 'var(--color-success)' : 'var(--color-danger)', lineHeight: 1.1, margin: '6px 0' }}>
            {result.score}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: result.passed ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {result.passed ? 'Lulus' : 'Belum Lulus'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
            {result.correctCount} dari {result.totalQuestions} soal benar
          </div>

          {/* Nilai yang dipatok perlu dijelaskan. Nilai 70 di samping 18 dari
              20 soal benar terbaca sebagai kesalahan hitung bila alasannya
              tidak disebut.

              A pinned score needs explaining. A 70 beside 18 of 20 correct
              reads as a miscalculation when the reason goes unsaid. */}
          {dipatok && (
            <div style={{ fontSize: '10px', color: '#7c2d12', backgroundColor: 'var(--color-warning-light)', padding: '9px 11px', borderRadius: '8px', marginTop: '12px', lineHeight: 1.5 }}>
              Jawaban benar Anda setara nilai {result.rawScore}. Karena ini percobaan ulang, nilai yang tercatat adalah batas kelulusan.
            </div>
          )}

          <Link href="/app/jadwal" style={{ textDecoration: 'none' }}>
            <Button variant="primary" style={{ width: '100%', marginTop: '16px' }}>Kembali ke Jadwal</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-app)', padding: '24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid var(--color-border)', padding: '28px', maxWidth: '400px', width: '100%' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
            Mulai Ujian
          </h1>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px', lineHeight: 1.6 }}>
            Waktu mulai berjalan begitu Anda menekan tombol di bawah. Jawaban tersimpan otomatis setiap kali Anda memilih, jadi halaman yang dimuat ulang tidak menghapusnya.
          </p>

          {error && (
            <div role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)', padding: '10px 12px', borderRadius: '8px', marginTop: '12px', lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          <Button variant="primary" onClick={start} disabled={starting} style={{ width: '100%', marginTop: '16px' }}>
            {starting ? 'Menyiapkan...' : 'Mulai Mengerjakan'}
          </Button>
          <Link href="/app/jadwal" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" style={{ width: '100%', marginTop: '8px' }}>Kembali</Button>
          </Link>
        </div>
      </main>
    );
  }

  const soal = state.questions[index];
  const belumDijawab = state.questions
    .map((q, i) => (answers[q.id] ? null : i + 1))
    .filter((n): n is number => n !== null);
  const menit = remaining !== null ? Math.floor(remaining / 60) : null;
  const detik = remaining !== null ? remaining % 60 : null;
  const mendesak = remaining !== null && remaining <= 60;

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-app)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {state.exam.title}
          </div>
          <div style={{ fontSize: '10px', opacity: 0.85 }}>
            Soal {index + 1} dari {state.questions.length}
            {state.attemptNumber > 1 && ` - percobaan ke-${state.attemptNumber}`}
          </div>
        </div>

        {remaining !== null && (
          <div
            role="timer"
            aria-live={mendesak ? 'assertive' : 'off'}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '20px',
              backgroundColor: mendesak ? 'var(--color-danger)' : 'var(--color-header-pill)',
              fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0,
            }}
          >
            <Clock size={13} strokeWidth={2} />
            {String(menit).padStart(2, '0')}:{String(detik).padStart(2, '0')}
          </div>
        )}
      </div>

      {/* Percobaan ulang menampilkan patokan nilainya di muka, bukan setelah
          selesai: peserta berhak tahu batas nilainya sebelum mengerjakan.

          A retake states its ceiling up front rather than afterwards: a
          participant deserves to know the limit before they work. */}
      {state.attemptNumber > 1 && (
        <div style={{ backgroundColor: 'var(--color-warning-light)', color: '#7c2d12', padding: '9px 20px', fontSize: '10px', lineHeight: 1.5 }}>
          Ini percobaan ulang. Bila lulus, nilai yang tercatat adalah {state.exam.passingScore}, yaitu batas kelulusan.
        </div>
      )}

      <div style={{ flex: 1, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '640px', width: '100%', margin: '0 auto' }}>
        {soal && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '18px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {soal.text}
            </div>

            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {soal.options.map((o, i) => {
                const dipilih = answers[soal.id] === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => pick(soal.id, o.id)}
                    aria-pressed={dipilih}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '10px',
                      border: `1px solid ${dipilih ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      backgroundColor: dipilih ? 'var(--color-primary-light)' : '#ffffff',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}
                  >
                    <span
                      style={{
                        width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${dipilih ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        backgroundColor: dipilih ? 'var(--color-primary)' : '#ffffff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 700, color: dipilih ? '#ffffff' : 'var(--color-text-muted)',
                      }}
                    >
                      {dipilih ? <Check size={12} strokeWidth={3} /> : String.fromCharCode(65 + i)}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-main)', lineHeight: 1.5 }}>{o.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)', padding: '10px 12px', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Button
            variant="secondary"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            style={{ fontSize: '11px', padding: '10px 14px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <ChevronLeft size={13} strokeWidth={2} /> Sebelumnya
          </Button>

          {index < state.questions.length - 1 ? (
            <Button
              variant="primary"
              onClick={() => setIndex((i) => i + 1)}
              style={{ flex: 1, fontSize: '11px', padding: '10px 14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              Berikutnya <ChevronRight size={13} strokeWidth={2} />
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => setConfirming(true)}
              style={{ flex: 1, fontSize: '11px', padding: '10px 14px' }}
            >
              Kumpulkan
            </Button>
          )}
        </div>

        {/* Nomor soal yang belum dijawab dapat ditekan untuk melompat ke sana.
            Memberi tahu "3 soal belum dijawab" tanpa menyebut nomornya membuat
            peserta menggulir satu per satu untuk mencarinya.

            Unanswered question numbers are tappable. Saying "3 unanswered"
            without naming them makes a participant scroll through one by one
            to find them. */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {state.questions.map((q, i) => {
            const dijawab = Boolean(answers[q.id]);
            const aktif = i === index;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Soal ${i + 1}${dijawab ? ', sudah dijawab' : ', belum dijawab'}`}
                aria-current={aktif ? 'true' : undefined}
                style={{
                  width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 700,
                  border: aktif ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  backgroundColor: dijawab ? 'var(--color-primary)' : '#ffffff',
                  color: dijawab ? '#ffffff' : 'var(--color-text-muted)',
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {confirming && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div role="dialog" aria-modal="true" aria-label="Konfirmasi pengumpulan" style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                Kumpulkan sekarang?
              </h2>
              <button type="button" aria-label="Tutup" onClick={() => setConfirming(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px' }}>
                <X size={16} color="var(--color-text-muted)" strokeWidth={2} />
              </button>
            </div>

            {belumDijawab.length > 0 ? (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '11px', color: '#7c2d12', backgroundColor: 'var(--color-warning-light)', padding: '10px 12px', borderRadius: '8px', marginTop: '10px', lineHeight: 1.5 }}>
                  <AlertTriangle size={13} strokeWidth={2} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>
                    {belumDijawab.length} soal belum dijawab. Soal yang dilewatkan dihitung salah.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {belumDijawab.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { setIndex(n - 1); setConfirming(false); }}
                      style={{ width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, border: '1px solid var(--color-warning)', backgroundColor: '#ffffff', color: '#7c2d12' }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '8px', lineHeight: 1.6 }}>
                Seluruh soal sudah dijawab. Jawaban tidak dapat diubah setelah dikumpulkan.
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={submitting} style={{ flex: 1, fontSize: '11px', padding: '10px' }}>
                Periksa Lagi
              </Button>
              <Button variant="primary" onClick={() => submit(false)} disabled={submitting} style={{ flex: 1, fontSize: '11px', padding: '10px' }}>
                {submitting ? 'Mengirim...' : 'Kumpulkan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
