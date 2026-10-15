'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock, Unlock, Trophy, ClipboardList, CheckCircle2, Clock, AlertTriangle, Hourglass, ArrowRight, Link2Off } from 'lucide-react';
import { StudentShell } from '@/components/student-shell';
import type { StudentTaskItem } from '@/features/tasks/submission-types';
import { TASK_KIND_LABELS } from '@/features/tasks/types';
import { formatDateWib, formatLongDateTimeWib } from '@/lib/time';

// Emas, sama dengan Daftar Materi / Gold, matching Daftar Materi
const CAPSTONE = { fg: '#a16207', bg: '#fef3c7', grad: 'linear-gradient(135deg, #a16207 0%, #eab308 100%)' };

type State = 'perlu-tautan' | 'lewat' | 'mendesak' | 'belum' | 'menunggu' | 'dinilai';

const STATE_STYLE: Record<State, { label: string; fg: string; bg: string; ring: string; icon: typeof Clock }> = {
  // Kuning, bukan merah: tugasnya sudah tercatat terkumpul, hanya berkasnya
  // yang tidak tersimpan. Merah membuat peserta mengira belum mengumpulkan.
  // Yellow, not red: the task is already recorded as handed in, only its file
  // was not stored. Red made participants think they had not submitted.
  'perlu-tautan': { label: 'Terkumpul · tambahkan tautan', fg: '#a16207', bg: '#fefce8', ring: '#facc15', icon: Link2Off },
  lewat: { label: 'Lewat tenggat', fg: '#b91c1c', bg: '#fef2f2', ring: '#f87171', icon: AlertTriangle },
  mendesak: { label: 'Segera', fg: '#c2410c', bg: '#fff7ed', ring: '#fb923c', icon: Clock },
  belum: { label: 'Belum dikerjakan', fg: '#0057a3', bg: '#eff6ff', ring: '#60a5fa', icon: ClipboardList },
  menunggu: { label: 'Menunggu nilai', fg: '#6d28d9', bg: '#f5f3ff', ring: '#a78bfa', icon: Hourglass },
  dinilai: { label: 'Dinilai', fg: '#3f6212', bg: '#f0fdf4', ring: '#4ade80', icon: CheckCircle2 },
};

const DAY_MS = 86_400_000;

function stateOf(item: StudentTaskItem, nowMs: number): State {
  const { submission, task } = item;
  if (submission) {
    if (submission.score !== null && submission.score !== undefined) return 'dinilai';
    // Pengumpulan lama tanpa tautan tidak berisi apa pun yang dapat dinilai.
    // An old submission without a link holds nothing that can be graded.
    if (!submission.url) return 'perlu-tautan';
    return 'menunggu';
  }
  if (!task.dueAt) return 'belum';
  const left = new Date(task.dueAt).getTime() - nowMs;
  if (left < 0) return 'lewat';
  return left <= 2 * DAY_MS ? 'mendesak' : 'belum';
}

/** "Sisa 3 hari", "Sisa 5 jam", "Lewat 2 hari" / "3 days left", "5 hours left", "2 days overdue" */
function countdown(dueAt: string | null, nowMs: number): string | null {
  if (!dueAt) return null;
  const diff = new Date(dueAt).getTime() - nowMs;
  const abs = Math.abs(diff);
  const text = abs >= DAY_MS ? `${Math.floor(abs / DAY_MS)} hari` : `${Math.max(1, Math.floor(abs / 3_600_000))} jam`;
  return diff >= 0 ? `Sisa ${text}` : `Lewat ${text}`;
}

const TODO_ORDER: Record<State, number> = { 'perlu-tautan': 0, lewat: 1, mendesak: 2, belum: 3, menunggu: 4, dinilai: 5 };

function TaskCard({ item, state, nowMs }: { item: StudentTaskItem; state: State; nowMs: number }) {
  const { task, submission, feedback } = item;
  const st = STATE_STYLE[state];
  const Icon = st.icon;
  const done = state === 'menunggu' || state === 'dinilai' || state === 'perlu-tautan';
  // Hitung mundur hanya untuk yang belum dikumpulkan / Countdown only for work not yet handed in
  const sisa = !submission ? countdown(task.dueAt, nowMs) : null;

  return (
    <Link href={`/app/tugas/${task.id}`} style={{ textDecoration: 'none' }}>
      <div className="task-card" style={{ display: 'flex', gap: '14px', alignItems: 'stretch', backgroundColor: '#ffffff', borderRadius: '16px', border: `1px solid ${done ? 'var(--color-student-border)' : st.ring}`, boxShadow: done ? 'none' : `0 6px 18px ${st.ring}33`, overflow: 'hidden' }}>
        <span aria-hidden style={{ width: '6px', flexShrink: 0, backgroundColor: st.ring }} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: '12px', alignItems: 'center', padding: '14px 14px 14px 0', flexWrap: 'wrap' }}>
          <span aria-hidden style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={20} color={st.fg} strokeWidth={2.2} />
          </span>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: st.fg, backgroundColor: st.bg, padding: '2px 8px', borderRadius: '10px' }}>{st.label}</span>
              <span style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>{TASK_KIND_LABELS[task.kind]}</span>
            </div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-main)', margin: '6px 0 2px', lineHeight: 1.35 }}>{task.title}</h3>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
              {submission
                ? `Dikumpulkan ${formatDateWib(submission.submittedAt)}${submission.late ? ' · terlambat' : ''}`
                : task.dueAt ? `Tenggat ${formatLongDateTimeWib(task.dueAt)}` : 'Tanpa tenggat'}
            </p>
            {feedback && (
              <p style={{ fontSize: '11px', color: '#3f6212', backgroundColor: '#f0fdf4', borderRadius: '8px', padding: '6px 9px', margin: '8px 0 0' }}>
                <b>Feedback:</b> {feedback}
              </p>
            )}
          </div>
          {state === 'dinilai' ? (
            <span style={{ width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)', color: '#ffffff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '17px', lineHeight: 1 }}>
              {submission?.score}
              <span style={{ fontSize: '8px', fontWeight: 600, opacity: 0.9 }}>NILAI</span>
            </span>
          ) : state === 'perlu-tautan' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0, padding: '7px 11px', borderRadius: '10px', border: `1px solid ${st.ring}`, color: st.fg, fontSize: '11px', fontWeight: 700 }}>
              Tambah tautan <ArrowRight size={13} />
            </span>
          ) : !done ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {sisa && <span style={{ fontSize: '11px', fontWeight: 700, color: st.fg }}>{sisa}</span>}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 12px', borderRadius: '10px', backgroundColor: st.fg, color: '#ffffff', fontSize: '11px', fontWeight: 700 }}>
                Kerjakan <ArrowRight size={13} />
              </span>
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export default function StudentTasksPage() {
  const [items, setItems] = useState<StudentTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'daily' | 'capstone'>('daily');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unsubmitted' | 'graded'>('all');

  useEffect(() => {
    async function loadTasks() {
      try {
        setLoading(true);
        const res = await fetch('/api/tasks/student');
        if (res.ok) setItems((await res.json()).tasks || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadTasks();
  }, []);

  const nowMs = Date.now();
  const dailyItems = items.filter((i) => i.task.kind === 'daily' || i.task.kind === 'working-paper');
  const capstoneItem = items.find((i) => i.task.kind === 'capstone');
  const completedDailyCount = dailyItems.filter((i) => i.submission !== null).length;
  const totalDailyCount = dailyItems.length;
  const isCapstoneUnlocked = capstoneItem?.isUnlocked || false;
  const progressPct = totalDailyCount > 0 ? Math.round((completedDailyCount / totalDailyCount) * 100) : 0;

  const withState = dailyItems.map((item) => ({ item, state: stateOf(item, nowMs) }));
  const graded = withState.filter((x) => x.state === 'dinilai');
  const avgScore = graded.length > 0 ? Math.round(graded.reduce((n, x) => n + (x.item.submission?.score ?? 0), 0) / graded.length) : null;
  const urgentCount = withState.filter((x) => x.state === 'mendesak' || x.state === 'lewat').length;

  // Yang belum dikerjakan di atas, urut paling mendesak lalu tenggat terdekat;
  // yang sudah dikumpulkan di bawah, terbaru lebih dulu.
  // Unfinished work on top, most pressing then nearest deadline first; handed-in
  // work below, newest first.
  const visible = withState.filter(({ item, state }) => {
    if (filterStatus === 'unsubmitted') return item.submission === null;
    if (filterStatus === 'graded') return state === 'dinilai';
    return true;
  });
  const todo = visible
    .filter((x) => x.state !== 'menunggu' && x.state !== 'dinilai' && x.state !== 'perlu-tautan')
    .sort((a, b) => TODO_ORDER[a.state] - TODO_ORDER[b.state] || (a.item.task.dueAt ?? '9999').localeCompare(b.item.task.dueAt ?? '9999'));
  const done = visible
    .filter((x) => x.state === 'menunggu' || x.state === 'dinilai' || x.state === 'perlu-tautan')
    .sort((a, b) => (b.item.submission?.submittedAt ?? '').localeCompare(a.item.submission?.submittedAt ?? ''));

  const tabButton = (tab: 'daily' | 'capstone', label: string, mobile: boolean) => {
    const active = activeTab === tab;
    const showLock = tab === 'capstone' && !isCapstoneUnlocked;
    const isCap = tab === 'capstone';
    return (
      <button
        key={tab}
        type="button"
        onClick={() => setActiveTab(tab)}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', border: 'none',
          padding: mobile ? '7px 14px' : '7px 16px', borderRadius: '20px',
          fontSize: mobile ? '10px' : '11px', fontWeight: active ? 700 : 500,
          background: active ? (isCap ? CAPSTONE.grad : mobile ? '#ffffff' : 'var(--color-primary)') : (mobile ? 'var(--color-header-pill)' : 'var(--color-border)'),
          color: active ? (isCap || !mobile ? '#ffffff' : 'var(--color-primary)') : (mobile ? '#ffffff' : 'var(--color-text-main)'),
        }}
      >
        {isCap && <Trophy size={12} strokeWidth={2} />}
        {label}
        {showLock && <Lock size={11} strokeWidth={2} />}
      </button>
    );
  };

  const section = (title: string, count: number, color: string, list: typeof todo) =>
    list.length > 0 && (
      <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)', margin: '6px 0 0' }}>
          <span aria-hidden style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
          {title} <span style={{ fontWeight: 500, color: 'var(--color-text-faint)' }}>({count})</span>
        </h2>
        {list.map(({ item, state }) => <TaskCard key={item.task.id} item={item} state={state} nowMs={nowMs} />)}
      </section>
    );

  return (
    <StudentShell>
      <style>{`.task-card { transition: transform 120ms ease, box-shadow 120ms ease; } .task-card:hover { transform: translateY(-2px); }`}</style>
      {/* Header mobile (node 11:3057) */}
      <div className="student-mobile-header" style={{ backgroundColor: 'var(--color-primary)', padding: '24px 16px 16px', paddingRight: '110px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}>Tugas</h1>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          {tabButton('daily', `Tugas Mandiri - ${totalDailyCount}`, true)}
          {tabButton('capstone', 'Capstone', true)}
        </div>
      </div>

      {/* Topbar desktop (node 15:356) */}
      <div className="student-topbar" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid var(--color-student-border)', padding: '18px 28px', paddingRight: '200px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>Tugas & Capstone</h1>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Kumpulkan tugas tepat waktu untuk membuka akses Capstone Project</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {tabButton('daily', `Tugas Mandiri (${totalDailyCount})`, false)}
          {tabButton('capstone', 'Capstone Project', false)}
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Memuat daftar tugas...</div>
        ) : activeTab === 'daily' ? (
          <>
            {/* Ringkasan progres: angka yang paling sering dicari peserta saat membuka halaman ini.
                Progress summary: the figure participants look for first on this page. */}
            <div style={{ borderRadius: '18px', padding: '18px 20px', background: 'linear-gradient(135deg, #0057a3 0%, #0072ce 55%, #22a6d6 100%)', color: '#ffffff', display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 10px 28px rgba(0, 87, 163, 0.25)' }}>
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <div style={{ fontSize: '11px', opacity: 0.85 }}>Progres Tugas Mandiri</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', fontWeight: 700, lineHeight: 1.2 }}>
                  {completedDailyCount}<span style={{ fontSize: '15px', opacity: 0.8 }}> / {totalDailyCount} terkumpul</span>
                </div>
                <div style={{ height: '8px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.25)', marginTop: '10px', overflow: 'hidden' }}>
                  <div style={{ width: `${progressPct}%`, height: '100%', borderRadius: '10px', background: 'linear-gradient(90deg, #fde047 0%, #facc15 100%)' }} />
                </div>
                <div style={{ fontSize: '11px', marginTop: '8px', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {isCapstoneUnlocked ? <Unlock size={12} /> : <Lock size={12} />}
                  {isCapstoneUnlocked ? 'Capstone Project sudah terbuka' : 'Kumpulkan semua untuk membuka Capstone Project'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[
                  [String(totalDailyCount - completedDailyCount), 'perlu dikerjakan'],
                  [String(urgentCount), 'mendesak'],
                  [avgScore === null ? '-' : String(avgScore), 'rata-rata nilai'],
                ].map(([v, l]) => (
                  <div key={l} style={{ minWidth: '88px', padding: '10px 12px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)' }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700 }}>{v}</div>
                    <div style={{ fontSize: '10px', opacity: 0.85 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div role="group" aria-label="Saring tugas" style={{ display: 'flex', gap: '8px' }}>
              {(['all', 'unsubmitted', 'graded'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filterStatus === f}
                  onClick={() => setFilterStatus(f)}
                  style={{
                    padding: '6px 14px', borderRadius: '999px', cursor: 'pointer', fontSize: '11px',
                    fontWeight: filterStatus === f ? 700 : 500,
                    border: filterStatus === f ? 'none' : '1px solid var(--color-student-border)',
                    backgroundColor: filterStatus === f ? 'var(--color-primary)' : '#ffffff',
                    color: filterStatus === f ? '#ffffff' : 'var(--color-text-main)',
                  }}
                >
                  {f === 'all' ? 'Semua' : f === 'unsubmitted' ? 'Belum' : 'Dinilai'}
                </button>
              ))}
            </div>

            {todo.length === 0 && done.length === 0 ? (
              <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px dashed var(--color-student-border)', padding: '40px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Tidak ada tugas yang sesuai filter
              </div>
            ) : (
              <>
                {section('Perlu dikerjakan', todo.length, '#f97316', todo)}
                {section('Sudah dikumpulkan', done.length, '#22c55e', done)}
              </>
            )}
          </>
        ) : !isCapstoneUnlocked ? (
          <div style={{ borderRadius: '18px', padding: '26px 20px', textAlign: 'center', background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: `1px solid ${CAPSTONE.bg}` }}>
            <span style={{ display: 'inline-flex', width: '56px', height: '56px', borderRadius: '50%', background: CAPSTONE.grad, alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(161, 98, 7, 0.3)' }}>
              <Lock size={24} color="#ffffff" strokeWidth={2} />
            </span>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: CAPSTONE.fg, margin: '12px 0 4px' }}>Capstone Project masih terkunci</h2>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>Selesaikan semua Tugas Mandiri untuk membukanya</p>
            <div style={{ maxWidth: '360px', margin: '16px auto 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: CAPSTONE.fg, fontWeight: 700, marginBottom: '6px' }}>
                <span>Progres</span><span>{completedDailyCount} / {totalDailyCount} tugas</span>
              </div>
              <div style={{ height: '8px', borderRadius: '10px', backgroundColor: '#ffffff', overflow: 'hidden' }}>
                <div style={{ width: `${progressPct}%`, height: '100%', background: CAPSTONE.grad }} />
              </div>
            </div>
            {capstoneItem && (
              <div style={{ marginTop: '18px', textAlign: 'left', backgroundColor: '#ffffff', borderRadius: '14px', padding: '14px 16px', border: `1px dashed ${CAPSTONE.fg}55` }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: CAPSTONE.fg, marginBottom: '4px' }}>SEKILAS CAPSTONE</div>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)', margin: '0 0 4px' }}>{capstoneItem.task.title}</h3>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0, whiteSpace: 'pre-wrap' }}>{capstoneItem.task.description}</p>
              </div>
            )}
          </div>
        ) : capstoneItem ? (
          <Link href={`/app/tugas/${capstoneItem.task.id}`} style={{ textDecoration: 'none' }}>
            <div className="task-card" style={{ borderRadius: '18px', padding: '22px', background: CAPSTONE.grad, color: '#ffffff', boxShadow: '0 12px 30px rgba(161, 98, 7, 0.3)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.2)' }}>
                <Trophy size={12} /> CAPSTONE PROJECT · TERBUKA
              </span>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, margin: '10px 0 6px' }}>{capstoneItem.task.title}</h2>
              <p style={{ fontSize: '12px', opacity: 0.92, margin: 0, whiteSpace: 'pre-wrap' }}>{capstoneItem.task.description}</p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '14px', padding: '9px 14px', borderRadius: '10px', backgroundColor: '#ffffff', color: CAPSTONE.fg, fontSize: '12px', fontWeight: 700 }}>
                {capstoneItem.submission ? 'Lihat pengumpulan' : 'Kerjakan Capstone'} <ArrowRight size={14} />
              </span>
            </div>
          </Link>
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>Belum ada instruksi Capstone untuk kelas ini.</div>
        )}
      </div>
    </StudentShell>
  );
}
