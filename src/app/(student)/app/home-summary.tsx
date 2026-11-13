'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import type { LearningSummary } from '@/features/dashboard/learning-summary';
import { PASS_SPA } from '@/features/dashboard/learning-summary';
import { AcceptanceUpload } from './acceptance-upload';

const BLUE = '#0072CE';
const YELLOW = '#FFC72C';
const MUTED = 'var(--color-text-muted)';
const SCHEME = { full: 'Full Internship', project: 'Project Based' } as const;

const card: React.CSSProperties = { backgroundColor: '#ffffff', border: '1px solid var(--color-student-border)', borderRadius: '16px', padding: '16px 18px', minWidth: 0 };
const h3: React.CSSProperties = { margin: 0, fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 800, color: 'var(--color-text-main)' };
const badge = (bg: string, fg: string): React.CSSProperties => ({ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: bg, color: fg, fontSize: '11px', fontWeight: 800, borderRadius: '999px', padding: '4px 10px' });
const tile: React.CSSProperties = { backgroundColor: '#ffffff', color: 'var(--color-text-main)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 };
const cta: React.CSSProperties = { alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#ffffff', color: BLUE, fontWeight: 700, fontSize: '13px', textDecoration: 'none', padding: '11px 16px', borderRadius: '10px', minHeight: '44px', boxSizing: 'border-box' };

const wib = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', ...opts });
const deadline = (iso: string) => `${wib(iso, { day: 'numeric', month: 'long' })}, ${wib(iso, { hour: '2-digit', minute: '2-digit' }).replace(':', '.')} WIB`;
const shortDate = (date: string) => new Date(`${date}T00:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });

function Tile({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub: string; accent?: boolean }) {
  return (
    <div style={tile}>
      <span style={{ fontSize: '11px', color: MUTED, fontWeight: 600 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-heading)', fontSize: accent ? '30px' : '15px', fontWeight: 800, color: accent ? BLUE : undefined, lineHeight: 1.2 }}>{value}</span>
      <span style={{ fontSize: '11px', color: MUTED }}>{sub}</span>
    </div>
  );
}

// SPA terhadap batas lulus: garis penanda di 60 / SPA against the pass mark: a marker line at 60
function SpaMeter({ score, fill, muted, marker }: { score: number; fill: string; muted: string; marker: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '12px', color: muted }}>SPA</span>
        <b style={{ fontFamily: 'var(--font-heading)', fontSize: '26px' }}>{score}</b>
      </div>
      <div role="img" aria-label={`SPA ${score}, batas lulus ${PASS_SPA}`} style={{ position: 'relative', height: '8px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '4px', marginTop: '6px' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, score))}%`, height: '100%', backgroundColor: fill, borderRadius: '4px' }} />
        <div style={{ position: 'absolute', left: `${PASS_SPA}%`, top: '-4px', width: '2px', height: '16px', backgroundColor: marker }} />
      </div>
      <div style={{ fontSize: '11px', color: muted, marginTop: '4px' }}>Batas lulus {PASS_SPA}</div>
    </div>
  );
}

const panel: React.CSSProperties = { backgroundColor: '#ffffff', color: 'var(--color-text-main)', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' };
const panelTitle: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: MUTED };
const twoCol: React.CSSProperties = { borderRadius: '18px', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', alignItems: 'end', color: '#ffffff' };

function Hero({ s }: { s: LearningSummary }) {
  if (s.state === 'ditempatkan' && s.internship) {
    return (
      <section aria-label="Hasil akhir" style={{ backgroundColor: '#0B4F8A', color: '#ffffff', borderRadius: '18px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={badge(YELLOW, '#3D2E00')}>DITEMPATKAN MAGANG</span>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>{s.internship.position}</h2>
        <div style={{ fontSize: '13px' }}>{s.internship.partnerName}</div>
        <div style={{ fontSize: '12px', color: '#DCEBFA' }}>Mitra akan menghubungimu.</div>
        <div style={{ marginTop: '6px', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span>SPA</span><b>{s.score} · Lulus</b>
        </div>
      </section>
    );
  }
  if (s.state === 'full' || s.state === 'project') {
    const scheme = SCHEME[s.state];
    const apps = s.applications;
    return (
      <section aria-label="Hasil akhir" style={{ backgroundColor: BLUE, color: '#ffffff', borderRadius: '18px', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={badge(YELLOW, '#3D2E00')}><Check size={13} strokeWidth={3} aria-hidden /> LULUS</span>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>Selamat, kamu lulus!</h2>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#E6F1FB' }}>
            Kamu berhak magang <b style={{ color: '#ffffff' }}>{scheme}</b>.{s.applyUntil ? ` Lamar sebelum ${deadline(s.applyUntil)}.` : ''}
          </p>
          <Link href="/app/karier" style={cta}>Buka Portal Karier <ArrowRight size={15} aria-hidden /></Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
          <Tile label="SPA" value={s.score} sub={`Batas lulus ${PASS_SPA}`} accent />
          <Tile label="Skema" value={scheme} sub={s.tier ? `Tier ${s.tier}` : ''} />
          <Tile label="Lamaran" value={apps.running > 0 ? `${apps.running} berjalan` : 'Belum ada'}
            sub={apps.nextInterview ? `Interview ${shortDate(apps.nextInterview.date)}` : apps.running > 0 ? 'Menunggu mitra' : 'Pilih lowongan'} />
        </div>
      </section>
    );
  }
  if (s.state === 'tidak-ditempatkan') {
    return (
      <section aria-label="Hasil akhir" style={{ ...twoCol, backgroundColor: '#0E7A45' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={badge('#ffffff', '#0E7A45')}><Check size={13} strokeWidth={3} aria-hidden /> LULUS</span>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>Selamat, kamu lulus!</h2>
          <SpaMeter score={s.score} fill="#ffffff" muted="#D1FADF" marker={YELLOW} />
        </div>
        <div style={panel}>
          <span style={panelTitle}>Syarat magang Project Based</span>
          {s.requirements.map((r) => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', ...(r.ok ? {} : { backgroundColor: '#FEF3F2', borderRadius: '8px', padding: '6px 8px', margin: '0 -8px' }) }}>
              <span><span aria-hidden style={{ color: r.ok ? '#067647' : '#B42318', fontWeight: 800 }}>{r.ok ? '✓' : '✕'}</span> {r.label}</span>
              <b style={{ color: r.ok ? undefined : '#B42318' }}>{r.value}</b>
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (s.state === 'belum-lulus') {
    // Urut menurut poin SPA yang hilang, bukan nilai mentah: capstone berbobot 45% lebih berpengaruh daripada kuis
    // Ordered by SPA points lost, not raw score: the capstone at 45% weighs more than the quiz
    const lemah = [...s.components].sort((a, b) => b.weight * (100 - b.score) - a.weight * (100 - a.score)).slice(0, 2);
    const tanpaCapstone = s.reasons.includes('Tidak mengumpulkan capstone');
    return (
      <section aria-label="Hasil akhir" style={{ ...twoCol, backgroundColor: '#273449' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={badge('#FEE4E2', '#B42318')}>BELUM LULUS</span>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>Kurang {PASS_SPA - s.score} poin untuk lulus</h2>
          <SpaMeter score={s.score} fill="#F79009" muted="#CBD5E1" marker="#ffffff" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={panel}>
            <span style={panelTitle}>Paling menurunkan nilai</span>
            {lemah.map((c) => {
              const hilang = c.key === 'capstone' && tanpaCapstone;
              return (
                <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>{c.label} <span style={{ color: MUTED }}>{c.weight}%</span></span>
                  <b style={{ color: hilang ? '#B42318' : undefined }}>{hilang ? 'Tidak dikumpulkan' : c.score}</b>
                </div>
              );
            })}
          </div>
          <span style={{ fontSize: '12px', color: '#CBD5E1' }}>Pertanyaan: hubungi PIC kelasmu.</span>
        </div>
      </section>
    );
  }
  return (
    <section aria-label="Hasil akhir" style={{ ...card, display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={badge('#E6F1FB', BLUE)}>MENUNGGU NILAI</span>
      <h2 style={{ ...h3, fontSize: '18px' }}>Nilai akhirmu sedang dihitung</h2>
      <div style={{ fontSize: '13px', color: MUTED }}>Capstone belum dinilai mentor.</div>
    </section>
  );
}

/**
 * Ringkasan belajar di beranda: hasil akhir, tahapan, rincian nilai, dan syarat magang.
 *
 * The learning summary on the home page: final result, steps, score breakdown, and internship requirements.
 */
export function HomeSummary({ s }: { s: LearningSummary }) {
  const showSteps = s.state !== 'belum-lulus';
  const reqTitle = s.state === 'full' ? 'Syarat Full Internship' : 'Syarat Project Based';
  return (
    <>
      <Hero s={s} />
      {s.state === 'ditempatkan' && <AcceptanceUpload />}
      {showSteps && (
        <section aria-label="Tahapan" style={card}>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '6px' }}>
            {s.steps.map((st) => {
              const color = st.status === 'done' ? '#067647' : st.status === 'current' ? BLUE : MUTED;
              return (
                <li key={st.label} aria-current={st.status === 'current' ? 'step' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <span style={{ height: '5px', borderRadius: '3px', backgroundColor: st.status === 'todo' ? '#E2E8F0' : color }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color }}>{st.label}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
        <section aria-label="Rincian nilai" style={{ ...card, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={h3}>Rincian nilai</h3>
          {s.components.map((c) => (
            <div key={c.key} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 64px', gap: '10px', alignItems: 'center', fontSize: '12px' }}>
              <span>{c.label} <span style={{ color: MUTED }}>{c.weight}%</span></span>
              <span style={{ height: '8px', backgroundColor: '#EEF2F6', borderRadius: '4px' }}>
                <span style={{ display: 'block', width: `${Math.min(100, c.score)}%`, height: '100%', backgroundColor: BLUE, borderRadius: '4px' }} />
              </span>
              <span style={{ textAlign: 'right' }}><b>{c.score}</b> <span style={{ color: MUTED }}>+{c.contribution}</span></span>
            </div>
          ))}
          <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <b>SPA</b><b style={{ color: BLUE }}>{s.score}</b>
          </div>
        </section>
        {s.requirements.length > 0 && (s.state === 'full' || s.state === 'project') && (
          <section aria-label={reqTitle} style={{ ...card, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={h3}>{reqTitle}</h3>
            {s.requirements.map((r) => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span><span aria-hidden style={{ color: r.ok ? '#067647' : '#B42318', fontWeight: 800 }}>{r.ok ? '✓' : '✕'}</span> {r.label}</span>
                <b style={{ color: r.ok ? undefined : '#B42318' }}>{r.value}</b>
              </div>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
