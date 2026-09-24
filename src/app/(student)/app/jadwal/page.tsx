'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { QrCode, Info, Video } from 'lucide-react';
import { StudentShell } from '@/components/student-shell';
import { formatTimeWib } from '@/lib/time';
import type { SessionDocument, AttendanceDocument } from '@/features/attendance/types';

type FilterMode = 'all' | 'online' | 'offline' | 'rekaman';

interface SessionItem {
  session: SessionDocument;
  attendance: AttendanceDocument | null;
  isActive: boolean;
}

/**
 * Daftar tautan rekaman sebuah pertemuan.
 *
 * Dipakai oleh kartu sesi berlangsung maupun kartu sesi selesai: sesi panjang
 * dapat sudah memiliki rekaman sebagian sebelum pertemuannya berakhir, dan
 * peserta yang mencarinya tidak perlu menunggu kartunya berubah bentuk.
 *
 * The list of a meeting's recording links.
 *
 * Used by both the in-progress and the finished session card: a long session
 * may already have partial recordings before it ends, and a participant looking
 * for them should not have to wait for the card to change shape.
 */
function RecordingLinks({ session }: { session: SessionDocument }) {
  const recordings = session.recordings ?? [];
  if (recordings.length === 0) return null;

  return (
    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {recordings.map((r) => (
        <a
          key={r.id}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px',
            borderRadius: '8px', backgroundColor: 'var(--color-primary-light)',
            textDecoration: 'none',
          }}
        >
          <Video size={12} color="var(--color-primary)" strokeWidth={2} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-primary)' }}>
            Rekaman - {r.label}
          </span>
        </a>
      ))}
    </div>
  );
}

export default function StudentJadwalPage() {
  const [items, setItems] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  // 'rekaman' menyaring pertemuan yang rekamannya sudah diunggah. Tanpa filter
  // ini rekaman terkubur di dalam kartu masing-masing pertemuan dan peserta
  // harus menggulir seluruh jadwal untuk menemukannya.
  //
  // 'rekaman' filters to meetings whose recordings are up. Without it,
  // recordings sit buried inside each meeting's card and participants must
  // scroll the whole schedule to find them.
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

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
  const recordedCount = items.filter((i) => (i.session.recordings?.length ?? 0) > 0).length;
  const filteredItems = items.filter((i) => {
    if (filterMode === 'all') return true;
    if (filterMode === 'rekaman') return (i.session.recordings?.length ?? 0) > 0;
    return i.session.mode === filterMode;
  });

  const filterChip = (mode: FilterMode, label: string) => {
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

  const filterChipDesktop = (mode: FilterMode, label: string) => {
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
      <div className="student-mobile-header" style={{ backgroundColor: 'var(--color-primary)', padding: '24px 16px 18px', paddingRight: '120px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
          Jadwal dan Rekaman
        </h1>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', overflowX: 'auto', paddingBottom: '2px' }}>
          {filterChip('all', 'Semua')}
          {filterChip('online', 'Online')}
          {filterChip('offline', 'Offline')}
          {recordedCount > 0 && filterChip('rekaman', 'Rekaman')}
        </div>
      </div>

      {/* Topbar desktop (node 15:157) */}
      <div className="student-topbar" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid var(--color-student-border)', padding: '18px 28px', paddingRight: '150px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>Jadwal dan Rekaman</h1>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Future Innovators Bootcamp</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {filterChipDesktop('all', `Semua (${items.length})`)}
          {filterChipDesktop('online', `Online (${onlineCount})`)}
          {filterChipDesktop('offline', `Offline (${offlineCount})`)}
          {recordedCount > 0 && filterChipDesktop('rekaman', `Rekaman (${recordedCount})`)}
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Memuat jadwal kelas...</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '48px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>
            {filterMode === 'rekaman' ? 'Belum ada rekaman yang diunggah' : 'Tidak ada jadwal pertemuan'}
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
                        Hadir {formatTimeWib(attendance?.recordedAt)}
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
                  <RecordingLinks session={session} />
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
                      Hadir {formatTimeWib(attendance?.recordedAt)}
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

                <RecordingLinks session={session} />
              </div>
            );
          })
        )}
      </div>
    </StudentShell>
  );
}
