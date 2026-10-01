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
      <div style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff', padding: '20px' }}>
        <Link href="/app/jadwal" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ffffff', textDecoration: 'none', fontSize: '11px', fontWeight: 600 }}>
          <ArrowLeft size={12} strokeWidth={2} /> Jadwal
        </Link>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '8px 0 0' }}>
          {data.examTitle}
        </h1>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px' }}>
          <span style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1 }}>{data.score}</span>
          <span style={{ fontSize: '11px', opacity: 0.9 }}>
            {data.passed ? 'Lulus' : 'Belum lulus'} - {data.correctCount} soal benar
            {data.attemptNumber > 1 && ` - percobaan ke-${data.attemptNumber}`}
          </span>
        </div>
      </div>

      <div style={{ padding: '16px', maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
              <div key={q.id} style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span
                    style={{
                      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                      backgroundColor: benar ? 'var(--color-success)' : 'var(--color-danger)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {benar ? <Check size={12} color="#ffffff" strokeWidth={3} /> : <X size={12} color="#ffffff" strokeWidth={3} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {i + 1}. {q.text}
                    </div>

                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {q.options.map((o) => {
                        const kunci = o.id === q.correctOptionId;
                        const dipilih = o.id === q.selectedOptionId;
                        return (
                          <div
                            key={o.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 10px', borderRadius: '8px', fontSize: '11px',
                              backgroundColor: kunci ? 'var(--color-success-light)' : dipilih ? 'var(--color-danger-light)' : 'transparent',
                              color: kunci ? 'var(--color-success)' : dipilih ? 'var(--color-danger)' : 'var(--color-text-muted)',
                              fontWeight: kunci || dipilih ? 600 : 400,
                            }}
                          >
                            <span style={{ flex: 1, minWidth: 0 }}>{o.text}</span>
                            {kunci && <span style={{ fontSize: '9px', fontWeight: 700, whiteSpace: 'nowrap' }}>JAWABAN BENAR</span>}
                            {dipilih && !kunci && <span style={{ fontSize: '9px', fontWeight: 700, whiteSpace: 'nowrap' }}>PILIHAN ANDA</span>}
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
