'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, QrCode, Video, CalendarDays, Clock, Users, ChevronRight } from 'lucide-react';
import { StudentShell } from '@/components/student-shell';
import { HomePerformance } from './home-performance';
import { formatLongDateWib } from '@/lib/time';
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
  const progress = data?.progress;
  const mentoring = data?.nearestMentoring;
  const studentName = data?.studentName || 'Peserta';
  const className = data?.className || '-';

  return (
    <StudentShell userName={studentName}>
      {/* Header biru mobile (node 11:2724/2799) -- padding atas dikurangi dari 56 ke 24,
          nilai Figma 56 memperhitungkan status bar native yang tidak berlaku di web browser
          Blue mobile header (node 11:2724/2799) -- top padding reduced from 56 to 24,
          Figma's 56 accounts for native status bar which doesn't apply in a web browser */}
      <div className="student-mobile-header" style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff', padding: '24px 20px 22px', paddingRight: '110px' }}>
        <div style={{ fontSize: '11px', fontFamily: 'var(--font-body)' }}>FUTURE INNOVATORS BOOTCAMP</div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: '6px 0 0' }}>Halo, {studentName}</h1>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', padding: '4px 10px', borderRadius: '20px', backgroundColor: 'var(--color-header-pill)' }}>
          <MapPin size={11} color="#ffffff" strokeWidth={2} />
          <span style={{ fontSize: '10px' }}>{className}</span>
        </div>
      </div>

      {/* Topbar desktop (node 15:46) */}
      <div className="student-topbar" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid var(--color-student-border)', padding: '18px 28px', paddingRight: '200px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>Halo, {studentName}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <MapPin size={11} color="var(--color-text-muted)" strokeWidth={2} />
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{className}</span>
          </div>
        </div>
      </div>

      {/* Satu kolom: kartu pengingat di samping sudah digantikan lonceng dan
          toast notifikasi, sehingga dashboard memakai seluruh lebar.

          One column: the reminder cards on the side are replaced by the
          notification bell and toast, so the dashboard uses the full width. */}
      <div style={{ padding: '16px', maxWidth: '1100px', width: '100%' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Memuat ringkasan beranda...</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
              {data?.internship && (
                <div role="status" style={{ background: 'linear-gradient(135deg, #0072CE, #0B5CAD)', color: '#ffffff', borderRadius: '14px', padding: '18px 20px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 260px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', color: '#FFC72C' }}>SELAMAT, KAMU SUDAH DITEMPATKAN MAGANG</div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, marginTop: '4px' }}>{data.internship.position}</div>
                    <div style={{ fontSize: '12px', marginTop: '2px' }}>{data.internship.partnerName}</div>
                    <div style={{ fontSize: '11px', marginTop: '8px', opacity: 0.85 }}>Kamu tidak perlu melamar lowongan lain. Mitra akan menghubungimu untuk langkah berikutnya.</div>
                  </div>
                </div>
              )}
              {/* Card Sesi Berlangsung (node 11:2735) / Sesi Berikutnya (node 11:2810) */}
              {activeSession ? (
                <div style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff', borderRadius: '14px', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '4px', backgroundColor: 'var(--color-success)' }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px' }}>SESI BERLANGSUNG</span>
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, marginTop: '10px', color: '#ffffff' }}>{activeSession.title}</h2>
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

              {/* Mentoring terdekat yang sudah dibooking: tanggalnya ditonjolkan dan
                  tautan Meet dapat langsung dibuka, tanpa membuka menu Mentoring.

                  The nearest booked mentoring: its date stands out and the Meet
                  link opens directly, without going to the Mentoring menu. */}
              {mentoring && (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid var(--color-border)', borderLeft: '4px solid #0e9f6e', padding: '16px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px' }}>
                  <span style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#def7ec', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={22} color="#0e9f6e" strokeWidth={2} />
                  </span>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#0e9f6e', letterSpacing: '0.04em' }}>MENTORING TERJADWAL</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-heading)', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-main)', marginTop: '2px' }}>
                      <CalendarDays size={17} color="var(--color-primary)" /> {formatLongDateWib(mentoring.date)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      <Clock size={13} color="var(--color-primary)" /> {mentoring.timeStr} · bersama Mentor {mentoring.mentorName}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {mentoring.meetUrl ? (
                      <a
                        href={mentoring.meetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '10px', backgroundColor: '#0e9f6e', color: '#ffffff', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}
                      >
                        <Video size={15} /> Buka Google Meet
                      </a>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', backgroundColor: 'var(--color-bg-student)', color: 'var(--color-text-muted)', fontSize: '12px', fontWeight: 600 }}>
                        Link Meet menyusul
                      </span>
                    )}
                    <Link href="/app/mentoring" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border)', color: 'var(--color-text-main)', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
                      Detail <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              )}

              {data?.performance && <HomePerformance performance={data.performance} progress={progress} />}
            </div>
          </>
        )}
      </div>
    </StudentShell>
  );
}
