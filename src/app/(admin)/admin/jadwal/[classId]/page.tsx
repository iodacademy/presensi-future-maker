'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Plus, Download, ArrowLeft, Trash2, Pencil } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { CreateSessionModal } from '../create-session-modal';
import { QrMonitorModal } from '../qr-monitor-modal';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import type { ClassDocument } from '@/features/classes/types';
import type { SessionDocument } from '@/features/attendance/types';
import { isSessionAttendanceActive } from '@/features/attendance/policy';

// Label tanggal relatif: Hari ini / Besok / nama hari (node 10:1714, 10:1723, 10:1732)
// Relative date label: Today / Tomorrow / day name
function formatDateLabel(dateStr: string): string {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  if (dateStr === todayStr) return 'Hari ini';
  if (dateStr === tomorrow) return 'Besok';

  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const d = new Date(dateStr + 'T00:00:00');
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

type SessionStatus = 'active' | 'upcoming' | 'completed';

function getSessionStatus(session: SessionDocument, nowIso: string): SessionStatus {
  if (isSessionAttendanceActive(session, nowIso)) return 'active';
  if (session.endsAt <= nowIso) return 'completed';
  return 'upcoming';
}

export default function AdminJadwalDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);

  const [classData, setClassData] = useState<ClassDocument | null>(null);
  const [sessions, setSessions] = useState<SessionDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [monitorSessionId, setMonitorSessionId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const [editSession, setEditSession] = useState<SessionDocument | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      // Kedua fetch independen -- jalankan paralel, bukan berurutan.
      // Both fetches are independent -- run in parallel, not sequentially.
      const [classRes, sessionsRes] = await Promise.all([
        fetch(`/api/classes/${classId}`),
        fetch(`/api/sessions?classId=${encodeURIComponent(classId)}`),
      ]);

      if (classRes.ok) {
        const data = await classRes.json();
        setClassData(data.class);
      }
      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setSessions(data.sessions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const nowIso = new Date().toISOString();
  const totalAttendees = sessions.reduce((sum, s) => sum + (s.attendeeCount || 0), 0);
  const avgAttendance = sessions.length > 0 && classData
    ? `${Math.round(totalAttendees / sessions.length)}/${classData.studentCount}`
    : '0/0';

  return (
    <AppShell role="admin" userName="Administrator">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Link href="/admin/jadwal" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)', textDecoration: 'none', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
          <ArrowLeft size={12} strokeWidth={2} />
          Kembali ke Daftar Kelas
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
            {classData?.canonicalName || 'Jadwal Kelas'}
          </h1>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px',
              borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)',
              color: '#ffffff', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Plus size={14} strokeWidth={2} />
            Buat Jadwal
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          Memuat jadwal sesi...
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '8px' }}>
            Belum ada jadwal pertemuan untuk kelas ini
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto 20px' }}>
            Tambahkan jadwal pertemuan kelas secara manual atau impor dari Excel agar sesi presensi aktif otomatis.
          </p>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            style={{ padding: '9px 14px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
          >
            + Buat Pertemuan Pertama
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sessions.map((session) => {
            const status = getSessionStatus(session, nowIso);
            const isOnline = session.mode === 'online';
            const dateLabel = formatDateLabel(session.date);

            const subtitle = status === 'completed'
              ? `${dateLabel} - Selesai - ${session.attendeeCount}/${classData?.studentCount || 0} hadir`
              : `${dateLabel} - ${session.startTime}-${session.endTime} - ${isOnline ? 'Online' : `Offline - ${session.address || ''}`}`;

            return (
              <div
                key={session.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px', borderRadius: '12px',
                  backgroundColor: status === 'active' ? 'var(--color-primary-light)' : '#ffffff',
                  border: status === 'active' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {status === 'active' && (
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-success)', flexShrink: 0 }} />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>{session.title}</span>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{subtitle}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      padding: '4px 9px', borderRadius: '10px', fontSize: '9px', fontWeight: 700,
                      backgroundColor: status === 'active' ? 'var(--color-success)' : status === 'completed' ? 'var(--color-text-faint)' : 'var(--color-border)',
                      color: status === 'upcoming' ? 'var(--color-text-main)' : '#ffffff',
                    }}
                  >
                    {status === 'active' ? 'QR AKTIF' : status === 'completed' ? 'Selesai' : 'Terjadwal'}
                  </span>

                  {status === 'active' && (
                    <button
                      type="button"
                      onClick={() => setMonitorSessionId(session.id)}
                      style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Lihat QR
                    </button>
                  )}
                  {status === 'upcoming' && (
                    <button
                      type="button"
                      onClick={() => setMonitorSessionId(session.id)}
                      style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff', color: 'var(--color-text-main)', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Buka Monitor
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Ubah pertemuan ${session.title}`}
                    onClick={() => setEditSession(session)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
                  >
                    <Pencil size={13} color="var(--color-text-muted)" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus pertemuan ${session.title}`}
                    onClick={() => setPendingDelete({ id: session.id, label: session.title })}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
                  >
                    <Trash2 size={13} color="var(--color-danger)" strokeWidth={2} />
                  </button>
                </div>
              </div>
            );
          })}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-sidebar-admin)', borderRadius: '12px', padding: '12px' }}>
            <span style={{ fontSize: '10px', color: '#e0e8ec' }}>
              Rekap presensi: {avgAttendance} rata-rata kehadiran
            </span>
            <a
              href={`/api/exports/attendance?classId=${encodeURIComponent(classId)}`}
              download
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '7px', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '10px', fontWeight: 700, textDecoration: 'none' }}
            >
              <Download size={12} strokeWidth={2} />
              Ekspor Rekap Presensi (CSV)
            </a>
          </div>
        </div>
      )}

      {classData && (
        <CreateSessionModal
          classId={classData.id}
          classNameTitle={classData.canonicalName}
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => loadData()}
        />
      )}

      {monitorSessionId && (
        <QrMonitorModal sessionId={monitorSessionId} onClose={() => setMonitorSessionId(null)} totalStudents={classData?.studentCount || 0} />
      )}

      {editSession && (
        <CreateSessionModal
          classId={classId}
          classNameTitle={classData?.canonicalName || ''}
          isOpen
          editSession={editSession}
          onClose={() => setEditSession(null)}
          onSuccess={() => {
            setEditSession(null);
            loadData();
          }}
        />
      )}

      {pendingDelete && (
        <DeleteDialog
          endpoint={`/api/sessions/${pendingDelete.id}`}
          entityLabel={pendingDelete.label}
          onClose={() => setPendingDelete(null)}
          onDeleted={() => {
            setPendingDelete(null);
            loadData();
          }}
        />
      )}
    </AppShell>
  );
}
