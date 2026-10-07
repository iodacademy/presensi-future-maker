'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquareText, Search, Star, Users, Gauge, RotateCcw } from 'lucide-react';
import type { FeedbackForm, FeedbackGroup, FeedbackTally, FeedbackText } from '@/features/dashboard/feedback';
import { Donut, Legend, type Segment } from '@/components/student-charts';
import { formatDateWib, formatTimeWib } from '@/lib/time';
import { Pagination, PAGE_SIZE } from '@/components/ui/pagination';
import s from './dashboard.module.css';

// Skala 1-5 sebagai palet diverging: merah di sisi rendah, abu netral di
// tengah, biru di sisi tinggi. Tiap sisi divalidasi sebagai ramp satu warna.
//
// The 1-5 scale as a diverging palette: red on the low side, a neutral gray in
// the middle, blue on the high side. Each arm is validated as a one-hue ramp.
const LIKERT = ['#d40d15', '#f08c6e', '#d5d7db', '#6fb1e8', '#0072ce'];
// NPS memakai warna status: kritik, netral, dan pendukung.
// NPS uses status colours: detractor, passive and promoter.
const NPS = { detractor: '#d40d15', passive: '#d5d7db', promoter: '#4d9a00' };
// Palet kategorikal tervalidasi untuk pilihan ganda; lebih dari delapan dilipat ke "Lainnya".
// Validated categorical palette for multiple choice; more than eight fold into "Lainnya".
const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

const ALL = 'semua';
const fmt = (v: number | null) => (v === null ? '-' : v.toFixed(1).replace('.', ','));

function mergeTallies(groups: FeedbackGroup[], questionId: string): FeedbackTally {
  const out: FeedbackTally = { sum: 0, count: 0, dist: {} };
  for (const g of groups) {
    const t = g.tallies[questionId];
    if (!t) continue;
    out.sum += t.sum;
    out.count += t.count;
    for (const [k, v] of Object.entries(t.dist)) out.dist[k] = (out.dist[k] ?? 0) + v;
  }
  return out;
}

/** Rata-rata seluruh pertanyaan skala dan bintang (1-5) / Average across every 1-5 scale and star question */
function satisfaction(form: FeedbackForm, groups: FeedbackGroup[]): { avg: number | null; count: number } {
  let sum = 0;
  let count = 0;
  for (const q of form.questions) {
    if (q.kind !== 'skala' && q.kind !== 'rating') continue;
    const t = mergeTallies(groups, q.id);
    sum += t.sum;
    count += t.count;
  }
  return { avg: count > 0 ? sum / count : null, count };
}

function npsOf(t: FeedbackTally): { score: number; promoter: number; passive: number; detractor: number } | null {
  if (t.count === 0) return null;
  let promoter = 0;
  let detractor = 0;
  for (const [k, v] of Object.entries(t.dist)) {
    const n = Number(k);
    if (n >= 9) promoter += v;
    else if (n <= 6) detractor += v;
  }
  const passive = t.count - promoter - detractor;
  return { score: Math.round(((promoter - detractor) / t.count) * 100), promoter, passive, detractor };
}

function Kpi({ icon: Icon, label, value, sub, accent }: { icon: React.ComponentType<{ size?: number; color?: string }>; label: string; value: string; sub: string; accent: string }) {
  return (
    <div style={{ flex: '1 1 140px', minWidth: 0, display: 'flex', gap: '10px', alignItems: 'center', padding: '10px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff' }}>
      <span style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: `color-mix(in srgb, ${accent} 12%, white)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={accent} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{label}</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-main)', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>{sub}</div>
      </div>
    </div>
  );
}

/**
 * Batang bertumpuk satu baris: tiap segmen dipisah celah 2px, label di dalam
 * segmen hanya bila muat; selebihnya dibawa legenda dan tooltip.
 *
 * A one-row stacked bar: segments separated by a 2px gap, labels inside a
 * segment only when they fit; the rest is carried by the legend and tooltip.
 */
function StackedBar({ parts }: { parts: { label: string; value: number; color: string; ink: string }[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  if (total === 0) return null;
  return (
    <div style={{ display: 'flex', gap: '2px', height: '22px', borderRadius: '6px', overflow: 'hidden' }}>
      {parts.filter((p) => p.value > 0).map((p) => {
        const pct = (p.value / total) * 100;
        return (
          <div
            key={p.label}
            title={`${p.label}: ${p.value} (${Math.round(pct)}%)`}
            style={{ width: `${pct}%`, backgroundColor: p.color, color: p.ink, fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}
          >
            {pct >= 9 ? `${Math.round(pct)}%` : ''}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Garis rata-rata kepuasan per pertemuan. Setiap titik dapat diklik untuk
 * menyaring panel ke pertemuan itu.
 *
 * The average satisfaction line per meeting. Each point is clickable to filter
 * the panel to that meeting.
 */
function TrendLine({ points, selected, onSelect }: { points: { id: string; label: string; avg: number | null; responses: number }[]; selected: string; onSelect: (id: string) => void }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 190;
  const pad = { l: 30, r: 14, t: 16, b: 28 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => pad.t + plotH - ((v - 1) / 4) * plotH;
  const band = points.length > 1 ? plotW / (points.length - 1) : plotW;
  const valid = points.map((p, i) => ({ ...p, i })).filter((p) => p.avg !== null);
  const line = valid.map((p, n) => `${n === 0 ? 'M' : 'L'}${x(p.i)},${y(p.avg!)}`).join(' ');
  const hp = hover !== null ? points[hover] : null;

  return (
    <div ref={wrapper} style={{ position: 'relative' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rata-rata kepuasan per pertemuan" style={{ display: 'block', maxWidth: '100%' }}>
        {[1, 3, 5].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#eef0f2" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#999999">{v}</text>
          </g>
        ))}
        {valid.length > 1 && (
          <>
            <path d={`${line} L${x(valid[valid.length - 1].i)},${y(1)} L${x(valid[0].i)},${y(1)} Z`} fill="#0072ce" fillOpacity={0.08} />
            <path d={line} fill="none" stroke="#0072ce" strokeWidth={2} strokeLinejoin="round" />
          </>
        )}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + plotH} stroke="#c9ccd1" />}
        {points.map((p, i) => (
          <g key={p.id}>
            {p.avg !== null && (
              <circle cx={x(i)} cy={y(p.avg)} r={p.id === selected ? 7 : 5} fill={p.id === selected ? '#f2a900' : '#0072ce'} stroke="#ffffff" strokeWidth={2} />
            )}
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={p.id === selected ? '#243c4b' : '#999999'} fontWeight={p.id === selected ? 700 : 400}>
              P{i + 1}
            </text>
            <rect
              x={Math.max(0, x(i) - band / 2)}
              y={pad.t}
              width={Math.min(W, x(i) + band / 2) - Math.max(0, x(i) - band / 2)}
              height={plotH}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${p.label}: rata-rata ${fmt(p.avg)}, ${p.responses} respons. Klik untuk menyaring.`}
              style={{ cursor: 'pointer', outline: 'none' }}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect(p.id === selected ? ALL : p.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(p.id === selected ? ALL : p.id)}
            />
          </g>
        ))}
      </svg>
      {hp && hover !== null && (
        <div
          role="tooltip"
          style={{
            position: 'absolute', left: Math.min(Math.max(x(hover), 90), W - 90), top: hp.avg !== null ? y(hp.avg) - 12 : pad.t, transform: 'translate(-50%, -100%)',
            backgroundColor: '#1f2a37', color: '#ffffff', borderRadius: '8px', padding: '6px 10px', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 5,
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700 }}>{hp.avg !== null ? `Rata-rata ${fmt(hp.avg)}` : 'Belum ada nilai'}</div>
          <div style={{ fontSize: '10px', opacity: 0.8 }}>P{hover + 1} · {hp.label} · {hp.responses} respons</div>
        </div>
      )}
    </div>
  );
}

function QuestionCard({ index, text, kindLabel, children }: { index: number; text: string; kindLabel: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '14px', backgroundColor: '#ffffff', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)', borderRadius: '6px', padding: '2px 6px', flexShrink: 0 }}>Q{index}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)' }}>{text}</div>
          <div style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>{kindLabel}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Satu tabel masukan untuk satu pertanyaan isian, dengan halamannya sendiri.
 * Dipisah per pertanyaan agar jawaban "apa yang sulit" tidak bercampur dengan
 * "apa yang perlu diperbaiki" -- keduanya dibaca untuk keputusan berbeda.
 *
 * One answer table for one free-text question, with its own pages. Split per
 * question so "what was hard" answers do not mix with "what to improve" --
 * each is read for a different decision.
 */
function TextAnswerTable({ number, question, rows, sessionNumber, sessionTitle }: {
  number: number;
  question: string;
  rows: FeedbackText[];
  sessionNumber: (id: string) => number | undefined;
  sessionTitle: (id: string) => string | undefined;
}) {
  const [requested, setRequested] = useState(0);
  // Halaman dibatasi ke yang ada: saringan yang menyempit dapat membuat halaman yang sedang dibuka hilang.
  // The page is clamped to one that exists: a narrowing filter can remove the page currently open.
  const page = Math.min(requested, Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)', borderRadius: '6px', padding: '2px 6px', flexShrink: 0 }}>Q{number}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)' }}>{question}</div>
          <div style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>{rows.length} masukan · terbaru di atas</div>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className={s.empty}>Tidak ada masukan pada saringan ini</div>
      ) : (
        <div className={s.scroll} style={{ border: '1px solid var(--color-border)', borderRadius: '10px' }}>
          <table className={s.table} style={{ minWidth: '760px' }}>
            <thead>
              <tr>
                <th style={{ width: '96px' }}>Waktu</th>
                <th style={{ width: '160px' }}>Nama</th>
                <th style={{ width: '170px' }}>Kelas</th>
                <th style={{ width: '50px' }}>Sesi</th>
                <th>Masukan</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((t, k) => (
                <tr key={`${t.submittedAt}-${k}`}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>
                    {formatDateWib(t.submittedAt)}
                    <div style={{ fontSize: '10px' }}>{formatTimeWib(t.submittedAt)} WIB</div>
                  </td>
                  {/* Ringkasan lama dihitung sebelum nama ikut disimpan. Old snapshots were computed before names were stored. */}
                  <td style={{ fontWeight: 600 }}>{t.studentName ?? '-'}</td>
                  <td>{t.className ?? '-'}</td>
                  <td title={sessionTitle(t.sessionId)}>P{sessionNumber(t.sessionId) ?? '?'}</td>
                  <td style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, color: 'var(--color-text-main)' }}>{t.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalItems={rows.length} onChange={setRequested} label="masukan" />
    </div>
  );
}

/**
 * Panel hasil feedback kelas di dashboard admin. Seluruh saringan bekerja di
 * peramban atas data ringkasan, sehingga berpindah formulir, kelas, atau
 * pertemuan tidak membaca Firestore lagi.
 *
 * The class feedback results panel on the admin dashboard. Every filter works
 * in the browser over the snapshot data, so switching form, class or meeting
 * reads nothing more from Firestore.
 */
export function FeedbackPanel({ forms, cities }: { forms: FeedbackForm[] | undefined; cities: string[] }) {
  const usable = useMemo(() => (forms ?? []).filter((f) => f.groups.length > 0), [forms]);
  const [formId, setFormId] = useState<string>('');
  const [classId, setClassId] = useState<string>(ALL);
  const [sessionId, setSessionId] = useState<string>(ALL);
  const [query, setQuery] = useState('');

  const form = usable.find((f) => f.formId === formId) ?? [...usable].sort((a, b) => b.groups.reduce((n, g) => n + g.responses, 0) - a.groups.reduce((n, g) => n + g.responses, 0))[0];

  if (!forms) {
    return <div className={s.empty}>Laporan feedback belum dihitung. Tekan tombol muat ulang di atas untuk menghitungnya.</div>;
  }
  if (!form) {
    return <div className={s.empty}>Belum ada feedback yang masuk.</div>;
  }

  const inCity = form.groups.filter((g) => cities.includes(g.city));
  const classOptions = [...new Map(inCity.map((g) => [g.classId, g.className])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const byClass = classId === ALL ? inCity : inCity.filter((g) => g.classId === classId);
  const sessionOrder = [...new Map(byClass.map((g) => [g.sessionId, { title: g.sessionTitle, date: g.sessionDate }])).entries()].sort((a, b) => a[1].date.localeCompare(b[1].date));
  const selected = sessionId === ALL ? byClass : byClass.filter((g) => g.sessionId === sessionId);

  const responses = selected.reduce((n, g) => n + g.responses, 0);
  const attendees = selected.reduce((n, g) => n + g.attendees, 0);
  const rate = attendees > 0 ? Math.round((responses / attendees) * 100) : null;
  const sat = satisfaction(form, selected);
  const npsQuestion = form.questions.find((q) => q.kind === 'nps');
  const nps = npsQuestion ? npsOf(mergeTallies(selected, npsQuestion.id)) : null;

  // Tren mengabaikan saringan pertemuan agar titik yang dipilih tetap terlihat di antara yang lain.
  // The trend ignores the meeting filter so the chosen point stays visible among the rest.
  const trend = sessionOrder.map(([id, info]) => {
    const gs = byClass.filter((g) => g.sessionId === id);
    return { id, label: `${info.title} · ${formatDateWib(info.date)}`, avg: satisfaction(form, gs).avg, responses: gs.reduce((n, g) => n + g.responses, 0) };
  });

  const perClass = classOptions.map(([id, name]) => {
    const gs = inCity.filter((g) => g.classId === id && (sessionId === ALL || g.sessionId === sessionId));
    const r = gs.reduce((n, g) => n + g.responses, 0);
    const a = gs.reduce((n, g) => n + g.attendees, 0);
    return { id, name, responses: r, attendees: a, rate: a > 0 ? Math.round((r / a) * 100) : 0, avg: satisfaction(form, gs).avg };
  });

  const allowedClasses = new Set(byClass.map((g) => g.classId));
  const q = query.trim().toLowerCase();
  const texts = form.texts.filter(
    (t) =>
      allowedClasses.has(t.classId) &&
      (sessionId === ALL || t.sessionId === sessionId) &&
      (!q || [t.text, t.studentName ?? '', t.className ?? ''].some((v) => v.toLowerCase().includes(q)))
  );
  const sessionIndex = new Map(sessionOrder.map(([id], i) => [id, i + 1]));
  const sessionTitles = new Map(sessionOrder.map(([id, info]) => [id, info.title]));
  const textQuestions = form.questions.filter((qq) => qq.kind === 'teks');
  // Nomor Q mengikuti urutan di formulir, sama untuk kartu angka dan tabel isian.
  // The Q number follows the form's order, the same for numeric cards and text tables.
  const qNumber = (id: string) => form.questions.findIndex((qq) => qq.id === id) + 1;

  const resetable = classId !== ALL || sessionId !== ALL || query !== '';
  const select: React.CSSProperties = { fontSize: '12px', padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff', color: 'var(--color-text-main)', minWidth: 0, maxWidth: '100%' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Saringan dalam satu baris di atas seluruh isi panel.
          Filters in one row above everything the panel shows. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <select aria-label="Formulir" value={form.formId} onChange={(e) => { setFormId(e.target.value); setSessionId(ALL); }} style={select}>
          {usable.map((f) => <option key={f.formId} value={f.formId}>{f.formTitle}</option>)}
        </select>
        <select aria-label="Kelas" value={classId} onChange={(e) => { setClassId(e.target.value); setSessionId(ALL); }} style={select}>
          <option value={ALL}>Semua kelas</option>
          {classOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select aria-label="Pertemuan" value={sessionId} onChange={(e) => setSessionId(e.target.value)} style={select}>
          <option value={ALL}>Semua pertemuan</option>
          {sessionOrder.map(([id, info], i) => <option key={id} value={id}>P{i + 1} · {info.title}</option>)}
        </select>
        {resetable && (
          <button type="button" onClick={() => { setClassId(ALL); setSessionId(ALL); setQuery(''); }} style={{ ...select, display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600 }}>
            <RotateCcw size={12} /> Reset
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        <Kpi icon={Users} label="Respons masuk" value={String(responses)} sub={`dari ${attendees} peserta hadir`} accent="#0072ce" />
        <Kpi icon={Gauge} label="Tingkat respons" value={rate === null ? '-' : `${rate}%`} sub="respons ÷ peserta hadir" accent="#7c3aed" />
        <Kpi icon={Star} label="Rata-rata kepuasan" value={sat.avg === null ? '-' : `${fmt(sat.avg)} / 5`} sub={`${sat.count} jawaban skala & bintang`} accent="#c2410c" />
        {npsQuestion && (
          <Kpi icon={MessageSquareText} label="Net Promoter Score" value={nps ? `${nps.score > 0 ? '+' : ''}${nps.score}` : '-'} sub="% pendukung − % pengkritik" accent="#4d9a00" />
        )}
      </div>

      <div className="feedback-grid">
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '14px', minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>Kepuasan per pertemuan</div>
          <div style={{ fontSize: '10px', color: 'var(--color-text-faint)', marginBottom: '6px' }}>Rata-rata skala 1–5 · klik titik untuk menyaring</div>
          {trend.length === 0 ? <div className={s.empty}>Belum ada data</div> : <TrendLine points={trend} selected={sessionId} onSelect={setSessionId} />}
        </div>
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '14px', minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>Per kelas</div>
          <div style={{ fontSize: '10px', color: 'var(--color-text-faint)', marginBottom: '10px' }}>Tingkat respons dan rata-rata · klik untuk menyaring</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {perClass.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setClassId(classId === c.id ? ALL : c.id); setSessionId(ALL); }}
                aria-pressed={classId === c.id}
                title={`${c.name}: ${c.responses} dari ${c.attendees} peserta hadir mengisi`}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 70px 38px', gap: '8px', alignItems: 'center', padding: '4px 6px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left', backgroundColor: classId === c.id ? 'var(--color-primary-light)' : 'transparent' }}
              >
                <span style={{ fontSize: '11px', color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{ height: '8px', borderRadius: '0 4px 4px 0', backgroundColor: '#eef0f2', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${Math.min(100, c.rate)}%`, backgroundColor: '#7c3aed', borderRadius: '0 4px 4px 0' }} />
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-main)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.rate}%</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="feedback-grid">
        {form.questions.filter((qq) => qq.kind !== 'teks').map((qq) => {
          const i = qNumber(qq.id) - 1;
          const t = mergeTallies(selected, qq.id);
          if (t.count === 0) {
            return (
              <QuestionCard key={qq.id} index={i + 1} text={qq.text} kindLabel="Belum ada jawaban">
                <div className={s.empty}>Belum ada jawaban pada saringan ini</div>
              </QuestionCard>
            );
          }
          if (qq.kind === 'skala' || qq.kind === 'rating') {
            const parts = [1, 2, 3, 4, 5].map((v, k) => ({ label: `Nilai ${v}`, value: t.dist[String(v)] ?? 0, color: LIKERT[k], ink: k === 2 ? '#243c4b' : '#ffffff' }));
            return (
              <QuestionCard key={qq.id} index={i + 1} text={qq.text} kindLabel={`${qq.kind === 'rating' ? 'Bintang' : 'Skala'} 1–5 · ${t.count} jawaban`}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-main)' }}>{fmt(t.sum / t.count)}</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>rata-rata dari 5</span>
                </div>
                <StackedBar parts={parts} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  {parts.map((p) => (
                    <span key={p.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: p.color }} />
                      {p.label.replace('Nilai ', '')}: <b style={{ color: 'var(--color-text-main)' }}>{p.value}</b>
                    </span>
                  ))}
                </div>
              </QuestionCard>
            );
          }
          if (qq.kind === 'nps') {
            const n = npsOf(t)!;
            const parts = [
              { label: 'Pengkritik (0–6)', value: n.detractor, color: NPS.detractor, ink: '#ffffff' },
              { label: 'Netral (7–8)', value: n.passive, color: NPS.passive, ink: '#243c4b' },
              { label: 'Pendukung (9–10)', value: n.promoter, color: NPS.promoter, ink: '#ffffff' },
            ];
            return (
              <QuestionCard key={qq.id} index={i + 1} text={qq.text} kindLabel={`Skala 0–10 · ${t.count} jawaban`}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-main)' }}>{n.score > 0 ? '+' : ''}{n.score}</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>NPS · rata-rata {fmt(t.sum / t.count)}</span>
                </div>
                <StackedBar parts={parts} />
                <Legend items={parts} />
              </QuestionCard>
            );
          }
          // Pilihan ganda: donut, opsi ke-9 dan seterusnya dilipat ke "Lainnya".
          // Multiple choice: a donut, the 9th option onwards folded into "Lainnya".
          const sorted = Object.entries(t.dist).sort((a, b) => b[1] - a[1]);
          const head = sorted.slice(0, 7);
          const tail = sorted.slice(7).reduce((n, [, v]) => n + v, 0);
          const segments: Segment[] = [
            ...head.map(([label, value], k) => ({ label, value, color: CATEGORICAL[k] })),
            ...(tail > 0 ? [{ label: 'Lainnya', value: tail, color: CATEGORICAL[7] }] : []),
          ];
          return (
            <QuestionCard key={qq.id} index={i + 1} text={qq.text} kindLabel={`Pilihan ganda · ${t.count} jawaban`}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
                <Donut segments={segments} centerValue={String(t.count)} centerLabel="jawaban" size={110} />
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <Legend items={segments} />
                </div>
              </div>
            </QuestionCard>
          );
        })}
      </div>

      {textQuestions.length > 0 && (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>Masukan tertulis</div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>
                {texts.length} masukan dari {textQuestions.length} pertanyaan
                {(form.textTotal ?? form.texts.length) > form.texts.length && ` · ${form.texts.length} terbaru dari ${form.textTotal} disimpan`}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '6px 10px', flex: '0 1 260px', minWidth: 0 }}>
              <Search size={13} color="var(--color-text-faint)" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama, kelas, atau kata" aria-label="Cari masukan" style={{ border: 'none', outline: 'none', fontSize: '12px', flex: 1, minWidth: 0 }} />
            </label>
          </div>
          {textQuestions.map((qq) => (
            <TextAnswerTable
              // Dipasang ulang saat kata pencarian berubah, agar halamannya kembali ke awal.
              // Remounted when the search text changes, so its pages start over.
              key={`${form.formId}|${qq.id}|${query}`}
              number={qNumber(qq.id)}
              question={qq.text}
              rows={texts.filter((t) => t.questionId === qq.id)}
              sessionNumber={(id) => sessionIndex.get(id)}
              sessionTitle={(id) => sessionTitles.get(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
