'use client';

import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Maximize2 } from 'lucide-react';
import type { QrMonitorData } from '@/features/attendance/types';
import { formatTimeWib } from '@/lib/time';

interface QrMonitorModalProps {
  sessionId: string;
  onClose: () => void;
  totalStudents?: number;
}

// Modal dibangun presisi mengikuti node Figma 10:1888 (w=620, radius=16, padding=22, itemSpacing=14)
// Modal built precisely following Figma node 10:1888
export function QrMonitorModal({ sessionId, onClose, totalStudents: totalStudentsProp }: QrMonitorModalProps) {
  const [data, setData] = useState<QrMonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomCanvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * QR memuat kode statis sesi, bukan token berotasi.
   *
   * QR yang berubah tiap 30 detik tidak dapat difoto lalu ditayangkan di layar,
   * dan peserta yang memotret layar dari jauh sering mendapati kodenya sudah
   * kedaluwarsa sebelum terbaca. Jendela presensi -- bukan perputaran kode --
   * yang menjaganya: menutup sesi menaikkan qrRevision dan mematikan seluruh
   * kode lama.
   *
   * The QR carries the session's static code, not a rotating token.
   *
   * A QR that changes every 30 seconds cannot be photographed and shown on a
   * screen, and participants shooting the screen from a distance often find
   * the code expired before it is read. The attendance window -- not rotation
   * -- is what protects it: closing the session raises qrRevision and kills
   * every old code.
   */
  function renderQrTo(canvas: HTMLCanvasElement | null, token: string, size: number) {
    if (!canvas) return;
    const appUrl = window.location.origin;
    const qrLink = `${appUrl}/presensi?token=${encodeURIComponent(token)}`;
    QRCode.toCanvas(canvas, qrLink, {
      width: size, margin: 1,
      color: { dark: '#243c4b', light: '#ffffff' },
    });
  }

  async function fetchMonitor() {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/monitor`);
      if (res.ok) {
        const monitorData: QrMonitorData = await res.json();
        setData(monitorData);

        const payload = monitorData.sessionCode ?? monitorData.currentToken;
        if (payload) {
          renderQrTo(canvasRef.current, payload, 100);
          renderQrTo(zoomCanvasRef.current, payload, 320);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMonitor();
    // Muat ulang untuk menyegarkan daftar hadir; kodenya sendiri tidak berubah.
    // Refresh to update the attendee list; the code itself does not change.
    const interval = setInterval(fetchMonitor, 25000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Canvas zoom baru muncul di DOM setelah isZoomed jadi true, jadi perlu
  // digambar ulang di sini -- efek fetchMonitor sebelumnya sudah lewat saat
  // elemen ini belum ada.
  // The zoom canvas only mounts in the DOM after isZoomed becomes true, so it
  // needs to be redrawn here -- the earlier fetchMonitor effect already ran
  // before this element existed.
  useEffect(() => {
    const payload = data?.sessionCode ?? data?.currentToken;
    if (isZoomed && payload) {
      renderQrTo(zoomCanvasRef.current, payload, 320);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isZoomed]);

  async function handleCloseManual() {
    if (!confirm('Tutup presensi untuk sesi ini sekarang? Siswa tidak akan dapat melakukan scan lagi.')) return;
    setClosing(true);
    try {
      await fetch(`/api/sessions/${sessionId}/monitor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ override: 'closed' }) });
      fetchMonitor();
    } finally { setClosing(false); }
  }

  async function handleOpenManual() {
    setClosing(true);
    try {
      await fetch(`/api/sessions/${sessionId}/monitor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ override: 'open' }) });
      fetchMonitor();
    } finally { setClosing(false); }
  }

  /**
   * Mengembalikan presensi ke jadwal sesinya.
   *
   * Sekali dibuka atau ditutup manual, presensi menetap pada keadaan itu sampai
   * diubah lagi; tanpa jalan kembali, sesi yang pernah disentuh admin tidak akan
   * pernah mengikuti jam sesinya sendiri lagi.
   *
   * Returns attendance to the session's own schedule.
   *
   * Once opened or closed by hand, attendance stays that way until changed
   * again; with no way back, a session an admin has touched would never follow
   * its own hours again.
   */
  async function handleAuto() {
    setClosing(true);
    try {
      await fetch(`/api/sessions/${sessionId}/monitor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ override: 'auto' }) });
      fetchMonitor();
    } finally { setClosing(false); }
  }

  const session = data?.session;
  const isOnline = session?.mode === 'online';
  const attendeeCount = data?.attendeeCount || 0;
  const totalStudents = totalStudentsProp ?? 0;
  const notYet = Math.max(0, totalStudents - attendeeCount);
  const percentage = totalStudents > 0 ? Math.round((attendeeCount / totalStudents) * 100) : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '16px' }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '620px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Header (node 10:1889): judul Poppins Bold 14px + badge status hijau/abu */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-main)' }}>
              {session?.title || 'QR Monitor Presensi'}
            </h2>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
              {isOnline ? 'Online - 19:00-22:00' : `Offline - ${session?.address || ''}`}
            </span>
          </div>
          <span
            style={{
              padding: '5px 10px', borderRadius: '10px', fontSize: '9px', fontWeight: 700, color: '#ffffff',
              backgroundColor: data?.isActive ? 'var(--color-success)' : 'var(--color-text-faint)',
            }}
          >
            {data?.isActive ? 'PRESENSI AKTIF' : 'PRESENSI DITUTUP'}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>
            Memuat monitor presensi...
          </div>
        ) : (
          <>
            {/* QR + Statistik (node 10:1895): flex horizontal, gap=16 */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch', flexWrap: 'wrap' }}>
              {/* QR Box (node 10:1896): 130x130 border biru 2px radius=12 */}
              <div style={{ width: '130px', height: '130px', flexShrink: 0, backgroundColor: '#ffffff', border: '2px solid var(--color-primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {data?.isActive ? (
                  <canvas ref={canvasRef} />
                ) : (
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '8px' }}>QR tidak aktif</span>
                )}
              </div>

              {/* Kanan: caption + 3 kartu statistik + tombol aksi (node 10:1903) */}
              <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data?.isActive && data.sessionCode ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>KODE PRESENSI</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '26px', fontWeight: 700, letterSpacing: '4px', color: 'var(--color-primary)' }}>
                        {data.sessionCode}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(data.sessionCode!)}
                      style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff', cursor: 'pointer', fontSize: '10px', fontWeight: 600 }}
                    >
                      Salin
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                    Presensi belum dibuka
                  </span>
                )}
                <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                  Kode dan QR tetap selama presensi dibuka, jadi dapat di-screenshot dan ditayangkan. Menutup presensi mematikannya.
                </span>

                {/* 3 kartu statistik (node 10:1905): Hadir(biru) / Belum(abu) / Kehadiran%(hijau) */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', backgroundColor: 'var(--color-primary-light)' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-primary)' }}>{attendeeCount}</div>
                    <div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>Hadir</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', backgroundColor: 'var(--color-bg-app)' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-faint)' }}>{notYet}</div>
                    <div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>Belum</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', backgroundColor: 'var(--color-success-light)' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-success)' }}>{percentage}%</div>
                    <div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>Kehadiran</div>
                  </div>
                </div>

                {/* Keadaan presensi ditampilkan apa adanya. Tanpa itu admin
                    tidak dapat membedakan presensi yang tertutup karena jadwal
                    dari yang ditutup manual, padahal keduanya memerlukan
                    tindakan berbeda.

                    The attendance state is shown as it is. Without it an admin
                    cannot tell attendance closed by schedule apart from
                    attendance closed by hand, though the two call for different
                    action. */}
                {session && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'var(--color-bg-app)' }}>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      {session.attendanceOverride === 'open'
                        ? 'Dibuka manual oleh admin'
                        : session.attendanceOverride === 'closed'
                          ? 'Ditutup manual oleh admin'
                          : `Mengikuti jadwal sesi (${session.startTime}-${session.endTime} WIB)`}
                    </span>
                    {session.attendanceOverride !== 'auto' && (
                      <button
                        type="button"
                        onClick={handleAuto}
                        disabled={closing}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff', fontSize: '9px', fontWeight: 700, cursor: 'pointer', color: 'var(--color-text-main)', whiteSpace: 'nowrap' }}
                      >
                        Ikuti jadwal
                      </button>
                    )}
                  </div>
                )}

                {/* Tombol Perbesar QR + Tutup/Buka Manual (node 10:1915) */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsZoomed(true)}
                    disabled={!data?.isActive}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '9px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '10px', fontWeight: 700, cursor: data?.isActive ? 'pointer' : 'not-allowed', opacity: data?.isActive ? 1 : 0.5 }}
                  >
                    <Maximize2 size={12} strokeWidth={2} />
                    Perbesar QR
                  </button>
                  {data?.isActive ? (
                    <button
                      type="button"
                      onClick={handleCloseManual}
                      disabled={closing}
                      style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff', color: 'var(--color-text-main)', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {closing ? 'Menutup...' : 'Tutup Manual'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenManual}
                      disabled={closing}
                      style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff', color: 'var(--color-text-main)', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {closing ? 'Membuka...' : 'Buka Manual'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--color-border)' }} />

            {/* Daftar Hadir (node 10:1923) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-main)' }}>Daftar Hadir (live)</h3>
              {data?.recentAttendees && data.recentAttendees.length > 0 ? (
                data.recentAttendees.slice(0, 2).map((att, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-main)' }}>{att.studentName}</span>
                    <span style={{ fontSize: '9px', color: 'var(--color-success)' }}>
                      {formatTimeWib(att.recordedAt)} - via {att.source === 'camera' ? 'Kamera' : 'Scan'}
                    </span>
                  </div>
                ))
              ) : (
                <span style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>Belum ada siswa yang melakukan presensi</span>
              )}
              {data?.recentAttendees && data.recentAttendees.length > 2 && (
                <span style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>+ {data.recentAttendees.length - 2} lainnya...</span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff', color: 'var(--color-text-main)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
              >
                Tutup
              </button>
            </div>
          </>
        )}
      </div>

      {/* Overlay QR diperbesar, ditampilkan penuh untuk dipindai dari jarak jauh */}
      {isZoomed && (
        <div
          onClick={() => setIsZoomed(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, cursor: 'pointer', padding: '24px' }}
        >
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <canvas ref={zoomCanvasRef} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)' }}>{session?.title}</span>
            {data?.sessionCode && (
              <div style={{ fontFamily: 'monospace', fontSize: '40px', fontWeight: 700, letterSpacing: '8px', color: 'var(--color-primary)' }}>
                {data.sessionCode}
              </div>
            )}
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Scan QR atau ketik kodenya - Tap di mana saja untuk tutup</span>
          </div>
        </div>
      )}
    </div>
  );
}
