'use client';

import React from 'react';
import Link from 'next/link';
import { CalendarCheck, ClipboardList, ClipboardCheck, TrendingUp, ChevronRight } from 'lucide-react';
import type { StudentPerformance, StudentHomeProgress } from '@/features/dashboard/types';
import { Donut, Legend, Rings, ScoreBars, ScoreLine, StatusStrip, type Segment } from '@/components/student-charts';

// Warna status dipakai karena warnanya memang bermakna (baik/info/peringatan/
// kritis), divalidasi untuk buta warna. Kuning di bawah kontras 3:1, sehingga
// setiap grafik menampilkan nilainya sebagai teks juga.
//
// Status colours are used because the colour carries meaning (good/info/
// warning/critical), validated for colour blindness. Yellow is under 3:1
// contrast, so every chart also shows its values as text.
const GOOD = '#4d9a00';
const INFO = '#0072ce';
const WARN = '#eda100';
const BAD = '#d40d15';
const NEUTRAL = '#e5e7eb';

// Tiga seri cincin, divalidasi sebagai palet kategorikal.
// The three ring series, validated as a categorical palette.
const RING = { presensi: '#0072ce', tugas: '#c2410c', kuis: '#7c3aed' };

const ATTENDANCE_STYLE: Record<StudentPerformance['attendance'][number]['status'], { label: string; color: string; ink: string }> = {
  hadir: { label: 'Hadir', color: GOOD, ink: '#ffffff' },
  izin: { label: 'Izin', color: INFO, ink: '#ffffff' },
  sakit: { label: 'Sakit', color: WARN, ink: '#3b2a00' },
  alpa: { label: 'Tidak hadir', color: BAD, ink: '#ffffff' },
  mendatang: { label: 'Mendatang', color: NEUTRAL, ink: '#71717a' },
};

const TASK_STYLE: Record<StudentPerformance['tasks'][number]['status'], { label: string; color: string }> = {
  dinilai: { label: 'Sudah dinilai', color: GOOD },
  menunggu: { label: 'Menunggu nilai', color: INFO },
  belum: { label: 'Belum dikumpulkan', color: WARN },
  lewat: { label: 'Lewat tenggat', color: BAD },
};

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

function Card({ icon: Icon, accent, title, subtitle, href, children }: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  accent: string;
  title: string;
  subtitle?: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid var(--color-student-border)', padding: '16px 18px', boxShadow: '0 2px 10px rgba(36, 60, 75, 0.04)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <span style={{ width: '30px', height: '30px', borderRadius: '9px', backgroundColor: `color-mix(in srgb, ${accent} 12%, white)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={16} color={accent} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: '13px', margin: 0 }}>{title}</h3>
          {subtitle && <p style={{ fontSize: '10px', color: 'var(--color-text-faint)', margin: 0 }}>{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>
            Detail <ChevronRight size={13} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '12px', padding: '10px 12px', borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.75)' }}>{sub}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ fontSize: '11px', color: 'var(--color-text-faint)', padding: '12px 0' }}>{text}</p>;
}

/**
 * Laporan performa di beranda: ringkasan cincin, presensi, tugas, dan kuis.
 *
 * Performance report on the home page: ring summary, attendance, tasks and quizzes.
 */
export function HomePerformance({ performance, progress }: { performance: StudentPerformance; progress?: StudentHomeProgress }) {
  const { attendance, quizzes, tasks } = performance;

  // Presensi dihitung terhadap pertemuan yang sudah berlalu: pertemuan
  // mendatang belum dapat dihadiri, sehingga ikut menghitungnya menurunkan
  // persentase tanpa ada yang salah.
  //
  // Attendance is measured against meetings already past: an upcoming meeting
  // cannot be attended yet, so counting it lowers the rate with nothing wrong.
  const past = attendance.filter((a) => a.status !== 'mendatang');
  const hadir = attendance.filter((a) => a.status === 'hadir').length;
  const attendanceSegments: Segment[] = (['hadir', 'izin', 'sakit', 'alpa'] as const).map((s) => ({
    label: ATTENDANCE_STYLE[s].label,
    value: attendance.filter((a) => a.status === s).length,
    color: ATTENDANCE_STYLE[s].color,
  }));

  const submitted = tasks.filter((t) => t.status === 'dinilai' || t.status === 'menunggu').length;
  const taskSegments: Segment[] = (['dinilai', 'menunggu', 'belum', 'lewat'] as const).map((s) => ({
    label: TASK_STYLE[s].label,
    value: tasks.filter((t) => t.status === s).length,
    color: TASK_STYLE[s].color,
  }));
  const graded = tasks.filter((t) => t.score !== null);
  const lateCount = tasks.filter((t) => t.late).length;

  const scored = quizzes.filter((q) => q.bestScore !== null);
  const quizAvg = scored.length > 0 ? Math.round(scored.reduce((n, q) => n + q.bestScore!, 0) / scored.length) : 0;
  const passedCount = quizzes.filter((q) => q.passed).length;

  const rings = [
    { label: 'Presensi', percent: pct(hadir, past.length), color: RING.presensi, detail: `${hadir} dari ${past.length} pertemuan` },
    { label: 'Tugas terkumpul', percent: pct(submitted, tasks.length), color: RING.tugas, detail: `${submitted} dari ${tasks.length} tugas` },
    { label: 'Rata-rata kuis', percent: quizAvg, color: RING.kuis, detail: `${scored.length} kuis dikerjakan` },
  ];

  return (
    <>
      {/* Ringkasan performa: satu-satunya blok berlatar gelap, agar mata
          langsung tertuju ke sini lebih dulu.

          Performance summary: the only dark-backed block, so the eye lands
          here first. */}
      <section style={{ borderRadius: '16px', padding: '16px', minWidth: 0, background: 'linear-gradient(135deg, #0b4f8f 0%, var(--color-primary) 55%, #1aa3e0 100%)', color: '#ffffff', boxShadow: '0 10px 30px rgba(0, 114, 206, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <TrendingUp size={16} color="#ffffff" />
          <h2 style={{ fontSize: '14px', color: '#ffffff', margin: 0 }}>Ringkasan Performa</h2>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', minWidth: 0 }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '50%', padding: '6px' }}>
              <Rings rings={rings} size={120} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {rings.map((r) => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ffffff', boxShadow: `inset 0 0 0 3px ${r.color}` }} />
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.1 }}>{r.percent}%</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)' }}>{r.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: '1 1 220px', minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
            <Stat label="Presensi" value={`${hadir}/${past.length}`} sub="pertemuan dihadiri" color="#7cc4ff" />
            <Stat label="Tugas" value={`${submitted}/${tasks.length}`} sub={lateCount > 0 ? `${lateCount} terlambat` : 'terkumpul'} color="#ffb48a" />
            <Stat label="Kuis lulus" value={`${passedCount}/${quizzes.length}`} sub={scored.length > 0 ? `rata-rata ${quizAvg}` : 'belum ada nilai'} color="#c9b2ff" />
            <Stat label="Mentoring" value={progress?.mentoringRatio ?? '0/2'} sub="sesi terpakai" color="#9be7c4" />
          </div>
        </div>
      </section>

      <div className="home-charts">
        <Card icon={CalendarCheck} accent={INFO} title="Laporan Presensi" subtitle={`${attendance.length} pertemuan`} href="/app/jadwal">
          {attendance.length === 0 ? (
            <Empty text="Belum ada pertemuan terjadwal." />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <Donut segments={attendanceSegments} centerValue={`${pct(hadir, past.length)}%`} centerLabel="kehadiran" size={120} />
                <div style={{ flex: '1 1 140px' }}>
                  <Legend items={attendanceSegments} />
                </div>
              </div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-faint)', letterSpacing: '0.04em', margin: '14px 0 6px' }}>PER PERTEMUAN</div>
              <StatusStrip
                cells={attendance.map((a, i) => ({
                  label: String(i + 1),
                  title: a.title,
                  status: ATTENDANCE_STYLE[a.status].label,
                  color: ATTENDANCE_STYLE[a.status].color,
                  ink: ATTENDANCE_STYLE[a.status].ink,
                }))}
              />
            </>
          )}
        </Card>

        <Card icon={ClipboardList} accent="#c2410c" title="Laporan Tugas" subtitle={`${tasks.length} tugas`} href="/app/tugas">
          {tasks.length === 0 ? (
            <Empty text="Belum ada tugas yang terbit." />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <Donut segments={taskSegments} centerValue={`${submitted}/${tasks.length}`} centerLabel="terkumpul" size={120} />
                <div style={{ flex: '1 1 140px' }}>
                  <Legend items={taskSegments} />
                </div>
              </div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-faint)', letterSpacing: '0.04em', margin: '14px 0 8px' }}>NILAI TUGAS</div>
              {graded.length === 0 ? (
                <Empty text="Belum ada tugas yang dinilai." />
              ) : (
                <ScoreBars items={graded.map((t) => ({ label: t.title, score: t.score! }))} color="#c2410c" />
              )}
            </>
          )}
        </Card>
      </div>

      <Card
        icon={ClipboardCheck}
        accent="#7c3aed"
        title="Laporan Kuis"
        subtitle={quizzes.length > 0 ? `Nilai terbaik per kuis · ${passedCount} dari ${quizzes.length} lulus` : undefined}
      >
        {quizzes.length === 0 ? (
          <Empty text="Belum ada kuis yang terbit." />
        ) : (
          <>
            <ScoreLine points={quizzes.map((q) => ({ label: q.title, score: q.bestScore, passing: q.passingScore }))} color="#7c3aed" />
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '14px', height: '2px', backgroundColor: '#7c3aed' }} /> Nilai terbaik
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '14px', height: 0, borderTop: '2px dashed #d40d15' }} /> Batas lulus
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1.5px solid #b0b5bb' }} /> Belum dikerjakan
              </span>
            </div>
            {/* Tabel ringkas: setiap nilai terbaca tanpa mengarahkan kursor.
                Compact table: every value readable without hovering. */}
            <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
              {quizzes.map((q, i) => (
                <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', padding: '6px 8px', borderRadius: '8px', backgroundColor: 'var(--color-bg-student)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text-faint)', width: '22px' }}>K{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.title}</span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-main)' }}>{q.bestScore ?? '-'}</span>
                  <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '8px', backgroundColor: q.passed ? 'var(--color-success-light)' : q.bestScore !== null ? 'var(--color-danger-light)' : '#eef0f2', color: q.passed ? '#3d7a00' : q.bestScore !== null ? BAD : 'var(--color-text-muted)' }}>
                    {q.passed ? 'Lulus' : q.bestScore !== null ? 'Belum lulus' : 'Belum'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

    </>
  );
}
