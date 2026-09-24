'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { QrCode, Info } from 'lucide-react';
import { StudentShell } from '@/components/student-shell';
import type { SessionDocument, AttendanceDocument } from '@/features/attendance/types';

interface SessionItem {
  session: SessionDocument;
  attendance: AttendanceDocument | null;
  isActive: boolean;
}

export default function StudentJadwalPage() {
  const [items, setItems] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'online' | 'offline'>('all');

  useEffect(() => {
    async function loadSessions() {
      try {
        setLoading(true);
        const res = await fetch('/api/attendance/student');
        if (res.ok) setItems((await res.json()).sessions || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadSessions();
  }, []);

  const onlineCount = items.filter((i) => i.session.mode === 'online').length;
  const offlineCount = items.filter((i) => i.session.mode === 'offline').length;
  const filteredItems = items.filter((i) => filterMode === 'all' || i.session.mode === filterMode);

  const filterChip = (mode: 'all' | 'online' | 'offline', label: string) => {
    const active = filterMode === mode;
    return (
      <button
        key={mode}
        type="button"
        onClick={() => setFilterMode(mode)}
        style={{
          padding: '7px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
          fontSize: '11px', fontWeight: active ? 700 : 400,
          backgroundColor: active ? '#ffffff' : 'var(--color-header-pill)',
          color: active ? 'var(--color-primary)' : '#ffffff',
        }}
      >
        {label}
      </button>
    );
  };

  const filterChipDesktop = (mode: 'all' | 'online' | 'offline', label: string) => {
    const active = filterMode === mode;
    return (
      <button
        key={mode}
        type="button"
        onClick={() => setFilterMode(mode)}
        style={{
          padding: '7px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
          fontSize: '11px', fontWeight: active ? 700 : 400,
          backgroundColor: active ? 'var(--color-primary)' : 'var(--color-border)',
          color: active ? '#ffffff' : 'var(--color-text-main)',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <StudentShell userName="Peserta">
      {/* Header biru mobile (node 11:2870) */}
      <div className="student-mobile-header" style={{ backgroundColor: 'var(--color-primary)', padding: '24px 16px 18px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}>Jadwal</h1>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          {filterChip('all', 'Semua')}
          {filterChip('online', 'Online')}
          {filterChip('offline', 'Offline')}
        </div>
      </div>

      {/* Topbar desktop (node 15:157) */}
      <div className="student-topbar" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid var(--color-student-border)', padding: '18px 28px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>Jadwal Kelas</h1>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Future Innovators Bootcamp</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {filterChipDesktop('all', `Semua (${items.length})`)}
          {filterChipDesktop('online', `Online (${onlineCount})`)}
          {filterChipDesktop('offline', `Offline (${offlineCount})`)}
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Memuat jadwal kelas...</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '48px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>
            Tidak ada jadwal pertemuan
          </div>
        ) : (
          filteredItems.map(({ session, attendance, isActive }) => {
            const isAttended = Boolean(attendance);
            const isOnline = session.mode === 'online';

            // Kartu sesi berlangsung (node 11:2880): biru muda + border 2px
            // Active session card (node 11:2880): light blue + 2px border
            if (isActive) {
              return (
                <div key={session.id} style={{ backgroundColor: 'var(--color-primary-light)', border: '2px solid var(--color-primary)', borderRadius: '12px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-primary)' }}>HARI INI - {isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                    <span style={{ fontSize: '8px', fontWeight: 700, color: '#ffffff', backgroundColor: 'var(--color-success)', padding: '3px 8px', borderRadius: '10px' }}>BERLANGSUNG</span>
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)', margin: '10px 0 4px' }}>{session.title}</h3>
                  <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: 0 }}>
                    {session.startTime}-{session.endTime} - {isOnline ? 'Zoom' : session.address || 'Offline'}
                  </p>
                  <div style={{ marginTop: '10px' }}>
                    {isAttended ? (
                      <div style={{ padding: '9px', borderRadius: '8px', backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)', textAlign: 'center', fontSize: '11px', fontWeight: 700 }}>
                        Hadir {attendance?.recordedAt.slice(11, 16)}
                      </div>
                    ) : (
                      <Link href="/app/presensi/scan" style={{ textDecoration: 'none' }}>
                        <div style={{ padding: '9px', borderRadius: '8px', border: '1px solid var(--color-primary)', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <QrCode size={13} color="var(--color-primary)" strokeWidth={2} />
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)' }}>Scan QR Hadir</span>
                        </div>
                      </Link>
                    )}
                  </div>
                </div>
              );
            }

            // Kartu sesi akan datang / selesai (node 11:2895 & 11:2901)
            // Upcoming / completed session card (node 11:2895 & 11:2901)
            return (
              <div key={session.id} style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--color-text-faint)' }}>
                    {session.date} - {isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                  {isAttended && (
                    <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-success)' }}>
                      Hadir {attendance?.recordedAt.slice(11, 16)}
                    </span>
                  )}
                </div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)', margin: '8px 0 4px' }}>{session.title}</h3>
                <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: 0 }}>
                  {session.startTime}-{session.endTime} - {isOnline ? session.zoomUrl || 'Zoom' : session.address || 'Offline'}
                </p>
                {!isAttended && (
                  <div style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--color-border)' }}>
                    <Info size={11} color="var(--color-text-muted)" strokeWidth={2} />
                    <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>QR dibuka admin saat sesi</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </StudentShell>
  );
}
