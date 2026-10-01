'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SCALE_MAX, SCALE_MIN } from '@/features/survey/policy';
import type { SurveyFormDocument } from '@/features/survey/types';

/**
 * Pengisian survei sebuah pertemuan.
 *
 * Formulirnya satu untuk seluruh kelas; pertemuan mana yang dinilai diambil
 * dari alamat halamannya dan dicatat pada jawabannya, bukan pada formulirnya.
 *
 * Filling in a meeting's survey.
 *
 * There is one form for every class; which meeting is being rated comes from
 * the page's address and is recorded on the response, not on the form.
 */
export default function SurveyPage({
  params,
}: {
  params: Promise<{ formId: string; sessionId: string }>;
}) {
  const { formId, sessionId } = React.use(params);
  const router = useRouter();

  const [form, setForm] = useState<SurveyFormDocument | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/survey/forms/${formId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setForm(d?.form ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [formId]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/survey/responses/${formId}/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim survei');
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid var(--color-border)', padding: '28px', maxWidth: '380px', width: '100%', textAlign: 'center' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: 'var(--color-success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Check size={26} color="var(--color-success)" strokeWidth={3} />
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-main)' }}>Terima kasih</div>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px', lineHeight: 1.6 }}>
            Masukan Anda sudah tercatat untuk pertemuan ini.
          </p>
          <Button variant="primary" onClick={() => router.push('/app/jadwal')} style={{ width: '100%', marginTop: '16px' }}>
            Kembali ke Jadwal
          </Button>
        </div>
      </main>
    );
  }

  if (!form) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-app)', padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
        Memuat formulir...
      </main>
    );
  }

  const belumDijawab = form.questions.filter((q) => q.required && !(answers[q.id] ?? '').trim());

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-app)' }}>
      <header style={{ height: '48px', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 14px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#ffffff' }}>
        <Link href="/app/jadwal" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
          <ArrowLeft size={13} strokeWidth={2} /> Keluar
        </Link>
        <span style={{ width: '1px', height: '16px', backgroundColor: 'var(--color-border)', flexShrink: 0 }} aria-hidden="true" />
        <span style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {form.title}
        </span>
      </header>

      <div style={{ padding: '16px', maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {form.description && (
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
            {form.description}
          </p>
        )}

        {form.questions.map((q, i) => (
          <div key={q.id} style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: 1.55 }}>
              {i + 1}. {q.text}
              {q.required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
            </div>

            {q.kind === 'skala' && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
                {Array.from({ length: SCALE_MAX - SCALE_MIN + 1 }, (_, n) => String(n + SCALE_MIN)).map((nilai) => {
                  const dipilih = answers[q.id] === nilai;
                  return (
                    <button
                      key={nilai}
                      type="button"
                      onClick={() => setAnswers((p) => ({ ...p, [q.id]: nilai }))}
                      aria-pressed={dipilih}
                      aria-label={`Nilai ${nilai} dari ${SCALE_MAX}`}
                      style={{
                        width: '44px', height: '44px', borderRadius: '12px', cursor: 'pointer',
                        fontSize: '14px', fontWeight: 700,
                        border: `1px solid ${dipilih ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        backgroundColor: dipilih ? 'var(--color-primary)' : '#ffffff',
                        color: dipilih ? '#ffffff' : 'var(--color-text-muted)',
                      }}
                    >
                      {nilai}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Bintang, bukan angka. Lima tombol berangka menuntut peserta
                menerjemahkan sendiri bahwa 5 berarti bagus; bintang sudah
                berarti itu tanpa penjelasan.

                Stars, not numbers. Five numbered buttons ask a participant to
                work out for themselves that 5 means good; a star already means
                that without explanation. */}
            {q.kind === 'rating' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
                {Array.from({ length: SCALE_MAX - SCALE_MIN + 1 }, (_, n) => n + SCALE_MIN).map((nilai) => {
                  const terpilih = Number(answers[q.id] ?? 0) >= nilai;
                  return (
                    <button
                      key={nilai}
                      type="button"
                      onClick={() => setAnswers((p) => ({ ...p, [q.id]: String(nilai) }))}
                      aria-label={`${nilai} dari ${SCALE_MAX} bintang`}
                      aria-pressed={answers[q.id] === String(nilai)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', lineHeight: 0 }}
                    >
                      <Star
                        size={34}
                        strokeWidth={1.5}
                        color={terpilih ? 'var(--color-warning)' : 'var(--color-border)'}
                        fill={terpilih ? 'var(--color-warning)' : 'none'}
                      />
                    </button>
                  );
                })}
                {answers[q.id] && (
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', marginLeft: '4px' }}>
                    {answers[q.id]} dari {SCALE_MAX}
                  </span>
                )}
              </div>
            )}

            {q.kind === 'pilihan' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
                {q.options.map((o) => {
                  const dipilih = answers[q.id] === o;
                  return (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setAnswers((p) => ({ ...p, [q.id]: o }))}
                      aria-pressed={dipilih}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 13px', borderRadius: '10px',
                        border: `1px solid ${dipilih ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        backgroundColor: dipilih ? 'var(--color-primary-light)' : '#ffffff',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        fontSize: '12px', fontWeight: dipilih ? 600 : 400,
                        color: dipilih ? 'var(--color-primary)' : 'var(--color-text-main)',
                      }}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            )}

            {q.kind === 'teks' && (
              <textarea
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                placeholder="Tulis masukan Anda"
                aria-label={q.text}
                rows={3}
                style={{ width: '100%', marginTop: '12px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border)', fontSize: '12px', lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit' }}
              />
            )}
          </div>
        ))}

        {error && (
          <div role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)', padding: '10px 12px', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        {/* Jumlah pertanyaan wajib yang belum dijawab disebut pada tombolnya,
            bukan disembunyikan di balik tombol mati: tombol yang tidak
            merespons tanpa keterangan tidak memberi tahu apa yang kurang.

            The count of unanswered required questions is on the button rather
            than hidden behind a dead one: a button that does nothing without
            explanation does not say what is missing. */}
        <Button
          variant="primary"
          onClick={submit}
          disabled={busy || belumDijawab.length > 0}
          style={{ width: '100%' }}
        >
          {busy
            ? 'Mengirim...'
            : belumDijawab.length > 0
              ? `${belumDijawab.length} pertanyaan wajib belum dijawab`
              : 'Kirim Masukan'}
        </Button>
      </div>
    </main>
  );
}
