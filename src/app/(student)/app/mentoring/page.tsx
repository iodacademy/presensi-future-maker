'use client';

import React, { useEffect, useState } from 'react';
import { Video, Users } from 'lucide-react';
import { StudentShell } from '@/components/student-shell';
import { Button } from '@/components/ui/button';
import type { MentoringStudentView, MentoringSlotDocument } from '@/features/mentoring/types';
import type { Phase } from '@/features/assignments/types';

export default function StudentMentoringPage() {
  const [phase, setPhase] = useState<Phase>('bootcamp');
  const [data, setData] = useState<MentoringStudentView | null>(null);
  const [loading, setLoading] = useState(true);

  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [confirmEarlySlot, setConfirmEarlySlot] = useState<MentoringSlotDocument | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  async function loadMentoringView() {
    try {
      setLoading(true);
      const res = await fetch(`/api/mentoring/student?phase=${phase}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMentoringView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function performBooking(slotId: string, acknowledgeEarly: boolean = false) {
    setBookingLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch('/api/mentoring/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, acknowledgeEarlySecondSession: acknowledgeEarly }),
      });

      const resData = await res.json();
      if (!res.ok) {
        if (resData.error && resData.error.startsWith('KONFIRMASI_MINGGU_PERTAMA:')) {
          const slot = data?.slots.find((s) => s.id === slotId) || null;
          setConfirmEarlySlot(slot);
          setBookingSlotId(slotId);
          return;
        }
        throw new Error(resData.error || 'Gagal membooking slot');
      }

      setConfirmEarlySlot(null);
      setBookingSlotId(null);
      setActionSuccess('Slot berhasil dibooking! Tautan Google Meet telah disiapkan.');
      loadMentoringView();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setBookingLoading(false);
    }
  }

  const assignedMentor = data?.assignedMentor;
  const quotaUsed = data?.quotaUsed || 0;
  const maxQuota = data?.maxQuota || 2;
  const remainingQuota = Math.max(0, maxQuota - quotaUsed);

  const phaseTab = (p: Phase, label: string) => (
    <button
      key={p}
      type="button"
      onClick={() => setPhase(p)}
      style={{
        padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
        fontSize: '11px', fontWeight: phase === p ? 700 : 400,
        backgroundColor: phase === p ? 'var(--color-primary)' : 'var(--color-border)',
        color: phase === p ? '#ffffff' : 'var(--color-text-main)',
      }}
    >
      {label}
    </button>
  );

  return (
    <StudentShell userName="Peserta">
      {/* Header mobile (node 11:2992) */}
      <div className="student-mobile-header" style={{ padding: '24px 16px 16px', paddingRight: '120px', borderBottom: '1px solid #eeeeee' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>Mentoring</h1>
        {assignedMentor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', padding: '10px', borderRadius: '10px', backgroundColor: 'var(--color-primary-light)' }}>
            <span style={{ width: '28px', height: '28px', borderRadius: '14px', backgroundColor: 'var(--color-primary)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
              {assignedMentor.name.charAt(0)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-main)' }}>Mentor {assignedMentor.name}</div>
              <div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>{assignedMentor.email}</div>
            </div>
            <span style={{ fontSize: '8px', fontWeight: 700, color: '#ffffff', backgroundColor: 'var(--color-success)', padding: '4px 8px', borderRadius: '10px' }}>
              {phase === 'bootcamp' ? 'BOOTCAMP' : 'MAGANG'}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          {phaseTab('bootcamp', 'Bootcamp')}
          {phaseTab('internship', 'Magang')}
        </div>
      </div>

      {/* Topbar desktop (node 15:249) */}
      <div className="student-topbar" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid var(--color-student-border)', padding: '18px 28px', paddingRight: '150px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>Sesi Mentoring 1-on-1</h1>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Pilih slot waktu yang tersedia untuk sesi privat dengan mentormu</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ padding: '7px 14px', borderRadius: '20px', backgroundColor: '#fff8e5', border: '1px solid var(--color-highlight-yellow)', color: 'var(--color-highlight-yellow-text)', fontSize: '11px', fontWeight: 700 }}>
            Sisa Kuota: {remainingQuota} / {maxQuota} Sesi
          </div>
          {phaseTab('bootcamp', 'Bootcamp')}
          {phaseTab('internship', 'Magang')}
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {actionError && (
          <div style={{ padding: '10px 14px', backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', borderRadius: '8px', marginBottom: '14px', fontSize: '12px', fontWeight: 600 }}>
            {actionError}
          </div>
        )}
        {actionSuccess && (
          <div style={{ padding: '10px 14px', backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)', borderRadius: '8px', marginBottom: '14px', fontSize: '12px', fontWeight: 600 }}>
            {actionSuccess}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Memuat jadwal mentoring...</div>
        ) : !assignedMentor ? (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '6px' }}>Mentor Belum Ditugaskan</div>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Anda belum di-assign ke mentor manapun untuk fase {phase === 'bootcamp' ? 'Bootcamp' : 'Magang'}.
            </p>
          </div>
        ) : (
          <div className="student-content-grid student-content-grid--mentoring" style={{ gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '10px' }}>Daftar Slot Mentoring</h2>
              {data?.slots.length === 0 ? (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed var(--color-border)', padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                  Mentor belum membuka slot jadwal untuk fase ini.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data?.slots.map((slot) => {
                    const isBookedByMe = slot.isMyBooking;
                    const isAvailable = slot.status === 'available';

                    return (
                      <div
                        key={slot.id}
                        style={{
                          backgroundColor: isBookedByMe ? 'var(--color-success-light)' : '#ffffff',
                          border: isBookedByMe ? '1px solid var(--color-success)' : isAvailable ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                          borderRadius: '12px', padding: '16px',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                            <strong style={{ fontSize: '12px', color: 'var(--color-text-main)' }}>{slot.date} - {slot.startTime}</strong>
                            <span style={{
                              fontSize: '8px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px',
                              backgroundColor: isBookedByMe ? 'var(--color-success)' : isAvailable ? 'var(--color-highlight-yellow)' : 'var(--color-text-faint)',
                              color: isBookedByMe ? '#ffffff' : isAvailable ? 'var(--color-highlight-yellow-text)' : '#ffffff',
                            }}>
                              {isBookedByMe ? 'BOOKING SAYA' : isAvailable ? 'TERSEDIA' : 'PENUH'}
                            </span>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                            {slot.startTime} - {slot.endTime} WIB - Google Meet - Privat 1-on-1 (45 menit)
                          </div>
                        </div>

                        {isBookedByMe ? (
                          // Tanpa tautan, tombol tidak boleh terlihat dapat diklik: pengguna
                          // yang menekan href="#" mengira Meet gagal dibuka.
                          //
                          // With no link the button must not look clickable: a user pressing
                          // href="#" would think Meet failed to open.
                          slot.meetUrl ? (
                            <a href={slot.meetUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                              <Button variant="secondary" style={{ border: '1px solid var(--color-success)', color: 'var(--color-success)', fontSize: '11px', padding: '8px 14px' }}>
                                <Video size={13} strokeWidth={2} /> Masuk Meet
                              </Button>
                            </a>
                          ) : (
                            <Button variant="secondary" disabled style={{ fontSize: '11px', opacity: 0.6, padding: '8px 14px' }}>
                              Link menyusul
                            </Button>
                          )
                        ) : isAvailable ? (
                          <Button variant="primary" disabled={bookingLoading || remainingQuota <= 0} onClick={() => performBooking(slot.id, false)} style={{ fontSize: '11px', padding: '8px 14px' }}>
                            {bookingLoading && bookingSlotId === slot.id ? 'Membooking...' : 'Pilih Slot Ini'}
                          </Button>
                        ) : (
                          <Button variant="secondary" disabled style={{ fontSize: '11px', opacity: 0.6, padding: '8px 14px' }}>Tidak Tersedia</Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Info Kuota mobile (node 11:3028) -- versi ringkas untuk mobile */}
              <div className="student-mobile-only" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff8e5', border: '1px solid var(--color-highlight-yellow)', borderRadius: '10px', padding: '10px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-highlight-yellow-text)' }}>Sisa kuota: {remainingQuota} / {maxQuota} - Ideal minggu 2</span>
              </div>

              {/* Informasi & Aturan Mentoring (node 15:304) */}
              <div style={{ backgroundColor: '#fff8e5', border: '1px solid var(--color-highlight-yellow)', borderRadius: '14px', padding: '18px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-highlight-yellow-text)', marginBottom: '10px' }}>Informasi & Aturan Mentoring</h3>
                <ul style={{ fontSize: '11px', color: 'var(--color-highlight-yellow-text)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.4, margin: 0 }}>
                  <li>Kuota maksimal: 2 kali per peserta selama fase {phase === 'bootcamp' ? 'Bootcamp' : 'Magang'}.</li>
                  <li>Idealnya ambil 1 sesi di minggu pertama, 1 sesi di minggu kedua.</li>
                  <li>Link Google Meet otomatis dikirim ke Google Calendar kamu.</li>
                </ul>
              </div>

              {/* Riwayat Sesi Selesai (node 15:309) */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '18px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '8px' }}>Riwayat Sesi Selesai</h3>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>Belum ada sesi yang selesai.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {confirmEarlySlot && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '420px', padding: '22px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '8px' }}>Saran Pengambilan Sesi Mentoring</h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: '18px' }}>
              Anda sedang mengambil sesi ke-2 di minggu pertama periode. Disarankan sesi kedua diambil pada minggu kedua. Tetap booking sekarang?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button variant="secondary" onClick={() => { setConfirmEarlySlot(null); setBookingSlotId(null); }} disabled={bookingLoading}>Pilih Tanggal Lain</Button>
              <Button variant="primary" onClick={() => performBooking(confirmEarlySlot.id, true)} disabled={bookingLoading}>
                {bookingLoading ? 'Memproses...' : 'Ya, Tetap Booking'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </StudentShell>
  );
}
