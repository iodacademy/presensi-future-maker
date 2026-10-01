'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, X, Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Review {
  examTitle: string;
  score: number;
  rawScore: number;
  passed: boolean;
  correctCount: number;
  attemptNumber: number;
  questions:
    | {
        id: string;
        text: string;
        options: { id: string; text: string }[];
        selectedOptionId: string | null;
        correctOptionId: string;
        explanation: string;
      }[]
    | null;
  withheldReason: string | null;
}

/**
 * Pembahasan sebuah percobaan.
 *
 * Pembahasan memuat jawaban benarnya, sehingga ditahan selama peserta masih
 * punya kesempatan mengulang. Penjagaannya ada di server; halaman ini hanya
 * menampilkan apa yang dikirimkan.
 *
 * An attempt's review.
 *
 * The review carries the correct answers, so it is withheld while attempts
 * remain. The guard lives on the server; this page only renders what it is
 * handed.
 */
export default function ExamReviewPage({
  params,
}: {
  params: Promise<{ examId: string; attemptId: string }>;
}) {
  const { attemptId } = React.use(params);
  const [data, setData] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/exams/attempts/${attemptId}/review`)
      .then(async (r) => {
        const d = await r.json();
        if (cancelled) return;
        if (!r.ok) setError(d.error || 'Gagal memuat pembahasan');
        else setData(d);
      })
      .catch(() => { if (!cancelled) setError('Gagal memuat pembahasan'); });
    return () => { cancelled = true; };
  }, [attemptId]);

  if (error) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-app)', padding: '24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid var(--color-border)', padding: '24px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div role="alert" style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{error}</div>
          <Link href="/app/jadwal" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" style={{ width: '100%', marginTop: '14px' }}>Kembali ke Jadwal</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-app)', padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
        Memuat pembahasan...
      </main>
    );
  }

  const dipatok = data.score !== data.rawScore;

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-app)' }}>
      <header style={{ height: '48px', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 14px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#ffffff' }}>
        <Link href="/app/jadwal" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
          <ArrowLeft size={13} strokeWidth={2} /> Keluar
        </Link>
        <span style={{ width: '1px', height: '16px', backgroundColor: 'var(--color-border)', flexShrink: 0 }} aria-hidden="true" />
        <span style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Pembahasan - {data.examTitle}
        </span>
      </header>

      <div style={{ padding: '16px', maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Pita nilai mendatar, bukan kartu tengah: halaman ini daftar panjang,
            dan ringkasannya tidak perlu memakan satu layar penuh.

            A horizontal score band rather than a centred card: this page is a
            long list, and its summary need not take a whole screen. */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            padding: '18px', borderRadius: '16px',
            border: `1px solid ${data.passed ? 'var(--color-success)' : 'var(--color-warning)'}`,
            backgroundColor: data.passed ? 'var(--color-success-light)' : 'var(--color-warning-light)',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>NILAI ANDA</div>
            <div style={{ fontSize: '30px', fontWeight: 800, lineHeight: 1.15, marginTop: '2px', color: data.passed ? 'var(--color-success)' : 'var(--color-warning)' }}>
              {data.score}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {data.correctCount} soal benar{data.attemptNumber > 1 && ` - percobaan ke-${data.attemptNumber}`}
            </div>
          </div>
          <span style={{ padding: '5px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', backgroundColor: data.passed ? 'var(--color-success)' : 'var(--color-warning)', color: '#ffffff' }}>
            {data.passed ? 'Lulus' : 'Belum Lulus'}
          </span>
        </div>
        {dipatok && (
          <div style={{ fontSize: '10px', color: '#7c2d12', backgroundColor: 'var(--color-warning-light)', padding: '10px 12px', borderRadius: '8px', lineHeight: 1.5 }}>
            Jawaban benar Anda setara nilai {data.rawScore}. Karena ini percobaan ulang, nilai yang tercatat adalah batas kelulusan.
          </div>
        )}

        {data.questions === null ? (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '28px', textAlign: 'center' }}>
            <Lock size={22} color="var(--color-text-muted)" strokeWidth={2} />
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', marginTop: '10px' }}>
              Pembahasan belum dibuka
            </div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px', lineHeight: 1.6 }}>
              {data.withheldReason}
            </p>
          </div>
        ) : (
          data.questions.map((q, i) => {
            const benar = q.selectedOptionId === q.correctOptionId;
            return (
              <div key={q.id} style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                {/* Status berada pada strip kepala, bukan menempel pada
                    jawabannya: satu tempat tetap untuk mencari benar atau salah
                    saat menggulir daftar panjang.

                    The status sits in a header strip rather than beside the
                    answer: one fixed place to look for right or wrong while
                    scrolling a long list. */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 16px', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-app)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)' }}>Soal {i + 1}</span>
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px',
                      fontSize: '9px', fontWeight: 700,
                      backgroundColor: !q.selectedOptionId ? 'var(--color-border)' : benar ? 'var(--color-success-light)' : 'var(--color-danger-light)',
                      color: !q.selectedOptionId ? 'var(--color-text-muted)' : benar ? 'var(--color-success)' : 'var(--color-danger)',
                    }}
                  >
                    {benar && q.selectedOptionId ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
                    {!q.selectedOptionId ? 'Tidak dijawab' : benar ? 'Benar' : 'Salah'}
                  </span>
                </div>

                <div style={{ padding: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {q.text}
                    </div>

                    <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginTop: '14px', marginBottom: '6px' }}>
                      PILIHAN JAWABAN
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {q.options.map((o, idx) => {
                        const kunci = o.id === q.correctOptionId;
                        const dipilih = o.id === q.selectedOptionId;
                        const warna = kunci
                          ? 'var(--color-success)'
                          : dipilih
                            ? 'var(--color-danger)'
                            : 'var(--color-text-muted)';
                        return (
                          <div
                            key={o.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px',
                              border: `1px solid ${kunci ? 'var(--color-success)' : dipilih ? 'var(--color-danger)' : 'var(--color-border)'}`,
                              backgroundColor: kunci ? 'var(--color-success-light)' : dipilih ? 'var(--color-danger-light)' : '#ffffff',
                            }}
                          >
                            <span
                              style={{
                                width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '11px', fontWeight: 700,
                                backgroundColor: kunci || dipilih ? warna : 'var(--color-bg-app)',
                                color: kunci || dipilih ? '#ffffff' : 'var(--color-text-muted)',
                              }}
                            >
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: '12px', lineHeight: 1.5, fontWeight: kunci || dipilih ? 600 : 400, color: kunci || dipilih ? warna : 'var(--color-text-main)' }}>
                              {o.text}
                            </span>
                            {kunci && <span style={{ fontSize: '9px', fontWeight: 700, whiteSpace: 'nowrap', color: warna }}>JAWABAN BENAR</span>}
                            {dipilih && !kunci && <span style={{ fontSize: '9px', fontWeight: 700, whiteSpace: 'nowrap', color: warna }}>PILIHAN ANDA</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Soal yang dilewatkan perlu disebut. Tanpa penanda apa
                        pun, barisnya terlihat seperti jawaban yang hilang.

                        A skipped question needs saying. With no marker at all,
                        the row looks like a lost answer. */}
                    {!q.selectedOptionId && (
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '5px', fontStyle: 'italic' }}>
                        Anda tidak menjawab soal ini.
                      </div>
                    )}

                    {q.explanation && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-main)', backgroundColor: 'var(--color-bg-app)', padding: '9px 11px', borderRadius: '8px', marginTop: '8px', lineHeight: 1.55 }}>
                        <span style={{ fontWeight: 700 }}>Pembahasan: </span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        <Link href="/app/jadwal" style={{ textDecoration: 'none' }}>
          <Button variant="secondary" style={{ width: '100%' }}>Kembali ke Jadwal</Button>
        </Link>
      </div>
    </main>
  );
}
