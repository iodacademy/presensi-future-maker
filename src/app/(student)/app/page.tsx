'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, QrCode, Users, FileText, ChevronRight } from 'lucide-react';
import { StudentShell } from '@/components/student-shell';
import type { StudentHomeData } from '@/features/dashboard/types';

export default function StudentHomePage() {
  const [data, setData] = useState<StudentHomeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const res = await fetch('/api/dashboard/student');
        if (res.ok) setData(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const activeSession = data?.activeSession;
  const nextSession = data?.nextSession;
  const nearestMentoring = data?.nearestMentoring;
  const nearestTask = data?.nearestTask;
  const progress = data?.progress;
  const studentName = data?.studentName || 'Peserta';
  const className = data?.className || '-';

  return (
    <StudentShell userName={studentName}>
      {/* Header biru mobile (node 11:2724/2799) -- padding atas dikurangi dari 56 ke 24,
          nilai Figma 56 memperhitungkan status bar native yang tidak berlaku di web browser
          Blue mobile header (node 11:2724/2799) -- top padding reduced from 56 to 24,
          Figma's 56 accounts for native status bar which doesn't apply in a web browser */}
      <div className="student-mobile-header" style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff', padding: '24px 20px 22px', paddingRight: '120px' }}>
        <div style={{ fontSize: '11px', fontFamily: 'var(--font-body)' }}>FUTURE INNOVATORS BOOTCAMP</div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: '6px 0 0' }}>Halo, {studentName}</h1>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', padding: '4px 10px', borderRadius: '20px', backgroundColor: 'var(--color-header-pill)' }}>
          <MapPin size={11} color="#ffffff" strokeWidth={2} />
          <span style={{ fontSize: '10px' }}>{className}</span>
        </div>
      </div>

      {/* Topbar desktop (node 15:46) */}
      <div className="student-topbar" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid var(--color-student-border)', padding: '18px 28px', paddingRight: '150px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>Halo, {studentName}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <MapPin size={11} color="var(--color-text-muted)" strokeWidth={2} />
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{className}</span>
          </div>
        </div>
        <span style={{ width: '38px', height: '38px', borderRadius: '10px', border: '1px solid var(--color-student-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)' }}>
          {studentName.charAt(0).toUpperCase()}
        </span>
      </div>

      <div className="student-content-grid student-content-grid--home" style={{ padding: '16px', gap: '16px' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Memuat ringkasan beranda...</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Card Sesi Berlangsung (node 11:2735) / Sesi Berikutnya (node 11:2810) */}
              {activeSession ? (
                <div style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff', borderRadius: '14px', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '4px', backgroundColor: 'var(--color-success)' }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px' }}>SESI BERLANGSUNG</span>
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, marginTop: '10px' }}>{activeSession.title}</h2>
                  <p style={{ fontSize: '12px', color: '#dcebfa', marginTop: '6px' }}>{activeSession.timeStr} - {activeSession.mode === 'online' ? 'Online (Zoom)' : activeSession.address || 'Offline'}</p>

                  {activeSession.isAttended ? (
                    <div style={{ marginTop: '16px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '10px', padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: 700 }}>
                      Anda sudah tercatat hadir di sesi ini
                    </div>
                  ) : (
                    <Link href="/app/presensi/scan" style={{ textDecoration: 'none' }}>
                      <div style={{ marginTop: '16px', backgroundColor: '#ffffff', borderRadius: '10px', padding: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <QrCode size={15} color="var(--color-primary)" strokeWidth={2} />
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>Scan QR Hadir</span>
                      </div>
                    </Link>
                  )}
                </div>
              ) : (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)' }}>SESI BERIKUTNYA</div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)', marginTop: '6px' }}>
                    {nextSession ? nextSession.title : 'Belum ada sesi yang dijadwalkan'}
                  </h3>
                  <p style={{ fontSize: '10px', color: 'var(--color-text-faint)', marginTop: '4px' }}>
                    {nextSession ? `${nextSession.timeStr} - Presensi otomatis terbuka saat sesi mulai.` : 'Instruktur akan menambahkan jadwal pertemuan kelas Anda.'}
                  </p>
                </div>
              )}

              {/* Progres Bootcamp Kamu (node 11:2 -- lihat frame D1 desktop 15:75) */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '18px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '14px' }}>Progres Bootcamp Kamu</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-primary)' }}>{progress?.attendanceRatio || '0/0'}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Presensi</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-warning)' }}>{progress?.dailyTasksRatio || '0/0'}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Tugas Harian</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-success)' }}>{progress?.mentoringRatio || '0/2'}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Mentoring</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Card Mentoring Terdekat (node 11:2749) */}
              <Link href="/app/mentoring" style={{ textDecoration: 'none' }}>
                <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#eaf6fb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={18} color="var(--color-info)" strokeWidth={2} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '9px', fontWeight: 600, color: 'var(--color-text-faint)' }}>MENTORING TERDEKAT</div>
                    {nearestMentoring ? (
                      <>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>{nearestMentoring.date} - {nearestMentoring.timeStr}</div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>dengan Mentor {nearestMentoring.mentorName}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Belum ada booking. Sisa kuota: {data?.remainingMentoringQuota || 0} slot</div>
                    )}
                  </div>
                  <ChevronRight size={16} color="var(--color-text-faint)" strokeWidth={2} />
                </div>
              </Link>

              {/* Card Tugas Terdekat (node 11:2761) */}
              <Link href={nearestTask ? `/app/tugas/${nearestTask.id}` : '/app/tugas'} style={{ textDecoration: 'none' }}>
                <div style={{ backgroundColor: nearestTask?.isUrgent ? '#fff8f5' : '#ffffff', borderRadius: '14px', border: nearestTask?.isUrgent ? '1px solid #fde1d3' : '1px solid var(--color-border)', padding: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--color-danger-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={18} color="var(--color-warning)" strokeWidth={2} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: nearestTask?.isUrgent ? 'var(--color-warning)' : 'var(--color-text-faint)' }}>
                      {nearestTask ? nearestTask.deadlineLabel : 'TUGAS MANDIRI'}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                      {nearestTask ? nearestTask.title : 'Semua tugas sudah dikumpulkan'}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      {nearestTask ? 'Belum dikumpulkan' : 'Kerja bagus!'}
                    </div>
                  </div>
                  <ChevronRight size={16} color={nearestTask?.isUrgent ? 'var(--color-warning)' : 'var(--color-text-faint)'} strokeWidth={2} />
                </div>
              </Link>
            </div>
          </>
        )}
      </div>
    </StudentShell>
  );
}
