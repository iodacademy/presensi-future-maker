'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { StudentShell } from '@/components/student-shell';
import type { StudentTaskItem } from '@/features/tasks/submission-types';
import { formatDateWib, formatDateTimeWib } from '@/lib/time';

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

  const dailyItems = items.filter((i) => i.task.kind === 'daily' || i.task.kind === 'working-paper');
  const capstoneItem = items.find((i) => i.task.kind === 'capstone');
  const completedDailyCount = dailyItems.filter((i) => i.submission !== null).length;
  const totalDailyCount = dailyItems.length;
  const isCapstoneUnlocked = capstoneItem?.isUnlocked || false;
  const capstoneProgressPct = totalDailyCount > 0 ? (completedDailyCount / totalDailyCount) * 100 : 0;

  const filteredDailyItems = dailyItems.filter((item) => {
    if (filterStatus === 'unsubmitted') return item.submission === null;
    if (filterStatus === 'graded') return item.submission?.score !== null && item.submission?.score !== undefined;
    return true;
  });

  const tabButton = (tab: 'daily' | 'capstone', label: string, mobile: boolean) => {
    const active = activeTab === tab;
    const showLock = tab === 'capstone' && !isCapstoneUnlocked;
    return (
      <button
        key={tab}
        type="button"
        onClick={() => setActiveTab(tab)}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', border: 'none',
          padding: mobile ? '7px 14px' : '7px 16px', borderRadius: '20px',
          fontSize: mobile ? '10px' : '11px', fontWeight: active ? 700 : 400,
          backgroundColor: active ? (mobile ? '#ffffff' : 'var(--color-primary)') : (mobile ? 'var(--color-header-pill)' : 'var(--color-border)'),
          color: active ? (mobile ? 'var(--color-primary)' : '#ffffff') : (mobile ? '#ffffff' : 'var(--color-text-main)'),
        }}
      >
        {label}
        {showLock && <Lock size={11} strokeWidth={2} />}
      </button>
    );
  };

  return (
    <StudentShell>
      {/* Header mobile (node 11:3057) */}
      <div className="student-mobile-header" style={{ backgroundColor: 'var(--color-primary)', padding: '24px 16px 16px', paddingRight: '110px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}>Tugas</h1>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          {tabButton('daily', `Praktik Mandiri - ${totalDailyCount}`, true)}
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
          {tabButton('daily', `Tugas Praktik Mandiri (${totalDailyCount})`, false)}
          {tabButton('capstone', 'Capstone Project', false)}
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Memuat daftar tugas...</div>
        ) : activeTab === 'daily' ? (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {(['all', 'unsubmitted', 'graded'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilterStatus(f)}
                  style={{
                    padding: '5px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    fontSize: '10px', fontWeight: filterStatus === f ? 700 : 400,
                    backgroundColor: filterStatus === f ? '#ffffff' : 'var(--color-header-pill)',
                    color: filterStatus === f ? 'var(--color-primary)' : '#ffffff',
                  }}
                >
                  {f === 'all' ? 'Semua' : f === 'unsubmitted' ? 'Belum' : 'Dinilai'}
                </button>
              ))}
            </div>

            {filteredDailyItems.length === 0 ? (
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '48px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>
                Tidak ada tugas yang sesuai filter
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredDailyItems.map(({ task, submission, feedback }) => {
                  const isGraded = submission?.score !== null && submission?.score !== undefined;
                  const isSubmitted = submission !== null;
                  const isUrgent = !isSubmitted; // ponytail: heuristik urgensi disederhanakan, upgrade saat ada field deadline aktual di data

                  return (
                    <Link key={task.id} href={`/app/tugas/${task.id}`} style={{ textDecoration: 'none' }}>
                      <div
                        style={{
                          backgroundColor: isUrgent ? '#fff8f5' : isGraded ? 'var(--color-success-light)' : '#ffffff',
                          borderRadius: '12px',
                          border: isUrgent ? '2px solid var(--color-warning)' : isGraded ? '1px solid var(--color-success)' : '1px solid var(--color-border)',
                          padding: '13px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: isUrgent ? '#ffffff' : 'var(--color-text-main)', backgroundColor: isUrgent ? 'var(--color-warning)' : 'transparent', padding: isUrgent ? '3px 8px' : 0, borderRadius: '10px' }}>
                            {isGraded ? `DINILAI ${submission?.score}` : isSubmitted ? 'TERKUMPUL' : task.dueAt ? `DEADLINE ${formatDateTimeWib(task.dueAt)}` : 'BELUM KUMPUL'}
                          </span>
                        </div>
                        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)', margin: '8px 0 4px' }}>{task.title}</h3>
                        <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: 0 }}>
                          {isSubmitted ? `Dikumpulkan ${formatDateWib(submission.submittedAt)}` : task.description}
                        </p>
                        {feedback && (
                          <div style={{ marginTop: '8px', backgroundColor: 'var(--color-primary-light)', borderRadius: '8px', padding: '8px' }}>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-primary)' }}>Feedback mentor:</div>
                            <div style={{ fontSize: '9px', color: '#333333', marginTop: '2px' }}>{feedback}</div>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            {!isCapstoneUnlocked ? (
              <>
                {/* Locked Card (node 11:3143) */}
                <div style={{ backgroundColor: '#f4f4f5', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '20px', textAlign: 'center' }}>
                  <span style={{ display: 'inline-flex', width: '40px', height: '40px', borderRadius: '20px', backgroundColor: '#ffffff', border: '1px solid var(--color-border)', alignItems: 'center', justifyContent: 'center' }}>
                    <Lock size={18} color="var(--color-text-faint)" strokeWidth={2} />
                  </span>
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)', margin: '10px 0 4px' }}>Capstone Terkunci</h2>
                  <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: 0 }}>Selesaikan semua Tugas Praktik Mandiri dulu</p>

                  <div style={{ display: 'inline-flex', marginTop: '14px', padding: '5px 12px', borderRadius: '20px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff' }}>
                    <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>Progress {completedDailyCount} / {totalDailyCount} tugas</span>
                  </div>

                  <div style={{ width: '100%', height: '5px', borderRadius: '10px', backgroundColor: 'var(--color-border)', marginTop: '14px', overflow: 'hidden' }}>
                    <div style={{ width: `${capstoneProgressPct}%`, height: '100%', backgroundColor: 'var(--color-primary)' }} />
                  </div>
                </div>

                {/* Preview Ghost (node 11:3155) */}
                {capstoneItem && (
                  <div style={{ marginTop: '10px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '13px' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)', margin: '0 0 4px' }}>{capstoneItem.task.title}</h3>
                    <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: '0 0 10px' }}>{capstoneItem.task.description}</p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '6px', backgroundColor: 'var(--color-border)' }}>
                      <Lock size={11} color="var(--color-text-faint)" strokeWidth={2} />
                      <span style={{ fontSize: '9px', color: 'var(--color-text-faint)', fontWeight: 600 }}>Terkunci</span>
                    </div>
                  </div>
                )}
              </>
            ) : capstoneItem ? (
              <Link href={`/app/tugas/${capstoneItem.task.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '2px solid var(--color-primary)', padding: '20px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--color-primary)', color: '#ffffff' }}>
                    CAPSTONE PROJECT - TERBUKA
                  </span>
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, margin: '8px 0 4px', color: 'var(--color-text-main)' }}>{capstoneItem.task.title}</h2>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{capstoneItem.task.description}</p>
                </div>
              </Link>
            ) : (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>Belum ada instruksi Capstone untuk kelas ini.</div>
            )}
          </div>
        )}
      </div>
    </StudentShell>
  );
}
