'use client';

import React, { useEffect, useState } from 'react';
import { Video, CalendarX2, CheckCircle2, CalendarDays, Clock, Loader2 } from 'lucide-react';
import { StudentShell } from '@/components/student-shell';
import { Button } from '@/components/ui/button';
import type { MentoringStudentView, MentoringSlotDocument } from '@/features/mentoring/types';
import type { Phase } from '@/features/assignments/types';
import { isSlotPast } from '@/features/mentoring/policy';
import { formatLongDateWib } from '@/lib/time';

export default function StudentMentoringPage() {
  const [phase, setPhase] = useState<Phase>('bootcamp');
  const [data, setData] = useState<MentoringStudentView | null>(null);
  const [loading, setLoading] = useState(true);

  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [confirmEarlySlot, setConfirmEarlySlot] = useState<MentoringSlotDocument | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [cancelSlot, setCancelSlot] = useState<MentoringSlotDocument | null>(null);
  // Modal selama Apps Script membuat undangan dan Meet (hingga ~20 detik), lalu hasilnya.
  // A modal while Apps Script creates the invitation and Meet (up to ~20 seconds), then its result.
  const [scheduling, setScheduling] = useState<{ slot: MentoringSlotDocument; done: boolean; meetUrl: string | null } | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

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
    const target = data?.slots.find((s) => s.id === slotId);
    if (target) setScheduling({ slot: target, done: false, meetUrl: null });

    try {
      const res = await fetch('/api/mentoring/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, acknowledgeEarlySecondSession: acknowledgeEarly }),
      });

      const resData = await res.json();
      if (!res.ok) {
        if (resData.error && resData.error.startsWith('KONFIRMASI_MINGGU_PERTAMA:')) {
          setScheduling(null);
          const slot = data?.slots.find((s) => s.id === slotId) || null;
          setConfirmEarlySlot(slot);
          setBookingSlotId(slotId);
          return;
        }
        throw new Error(resData.error || 'Gagal membooking slot');
      }

      setConfirmEarlySlot(null);
      setBookingSlotId(null);
      setScheduling((cur) => (cur ? { ...cur, done: true, meetUrl: resData.meetUrl ?? null } : null));
      loadMentoringView();
    } catch (err: any) {
      setScheduling(null);
      setActionError(err.message);
    } finally {
      setBookingLoading(false);
    }
  }

  async function performCancel(slot: MentoringSlotDocument) {
    if (!slot.bookingId) return;
    setCancelLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/mentoring/bookings/${slot.bookingId}/cancel`, { method: 'POST' });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Gagal membatalkan jadwal');
      setCancelSlot(null);
      setActionSuccess('Jadwal mentoring dibatalkan. Kuota dikembalikan dan undangan di Google Calendar ikut dihapus.');
      loadMentoringView();
    } catch (err: any) {
      setCancelSlot(null);
      setActionError(err.message);
    } finally {
      setCancelLoading(false);
    }
  }

  const nowIso = new Date().toISOString();
  const pastMine = (data?.slots ?? []).filter((sl) => sl.isMyBooking && isSlotPast(sl.startsAt, nowIso));
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
    <StudentShell>
      {/* Header mobile (node 11:2992) */}
      <div className="student-mobile-header" style={{ padding: '24px 16px 16px', paddingRight: '110px', borderBottom: '1px solid #eeeeee' }}>
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
      <div className="student-topbar" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid var(--color-student-border)', padding: '18px 28px', paddingRight: '200px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>Sesi Mentoring 1-on-1</h1>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {assignedMentor ? <>Mentor kamu: <b style={{ color: 'var(--color-text-main)' }}>{assignedMentor.name}</b> · pilih slot waktu yang tersedia</> : 'Pilih slot waktu yang tersedia untuk sesi privat dengan mentormu'}
          </p>
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
                    // Slot yang sudah dimulai tidak dapat dipilih maupun dibatalkan.
                    // A slot that has started can be neither picked nor cancelled.
                    const isPast = isSlotPast(slot.startsAt, nowIso);
                    const isAvailable = slot.status === 'available' && !isPast;

                    return (
                      <div
                        key={slot.id}
                        style={{
                          backgroundColor: isPast ? '#f4f4f5' : isBookedByMe ? 'var(--color-success-light)' : '#ffffff',
                          border: isPast ? '1px solid var(--color-student-border)' : isBookedByMe ? '1px solid var(--color-success)' : isAvailable ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                          borderRadius: '12px', padding: '16px', opacity: isPast ? 0.75 : 1,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', minWidth: 0, flex: '1 1 260px' }}>
                          <span style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: '#ffffff', backgroundColor: isPast ? '#a1a1aa' : 'var(--color-primary)' }}>
                            {slot.mentorName.charAt(0).toUpperCase()}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mentor</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: '14px', color: isPast ? 'var(--color-text-muted)' : 'var(--color-text-main)' }}>{slot.mentorName}</strong>
                              <span style={{
                                fontSize: '8px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px',
                                backgroundColor: isPast ? '#a1a1aa' : isBookedByMe ? 'var(--color-success)' : isAvailable ? 'var(--color-highlight-yellow)' : 'var(--color-text-faint)',
                                color: isPast ? '#ffffff' : isBookedByMe ? '#ffffff' : isAvailable ? 'var(--color-highlight-yellow-text)' : '#ffffff',
                              }}>
                                {isPast ? (isBookedByMe ? 'SELESAI' : 'SUDAH LEWAT') : isBookedByMe ? 'BOOKING SAYA' : isAvailable ? 'TERSEDIA' : 'PENUH'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: isPast ? 'var(--color-text-muted)' : 'var(--color-text-main)', marginTop: '6px' }}>
                              <CalendarDays size={13} color="var(--color-primary)" /> {formatLongDateWib(slot.date)}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                              <Clock size={13} color="var(--color-primary)" /> {slot.startTime} - {slot.endTime} WIB · Google Meet · 45 menit
                            </div>
                          </div>
                        </div>

                        {isPast ? (
                          <Button variant="secondary" disabled style={{ fontSize: '11px', opacity: 0.6, padding: '8px 14px' }}>
                            {isBookedByMe ? 'Sesi selesai' : 'Sudah lewat'}
                          </Button>
                        ) : isBookedByMe ? (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {/* Tanpa tautan, tombol tidak boleh terlihat dapat diklik: pengguna
                              yang menekan href="#" mengira Meet gagal dibuka.

                              With no link the button must not look clickable: a user pressing
                              href="#" would think Meet failed to open. */}
                          {slot.meetUrl ? (
                            <a href={slot.meetUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                              <Button variant="secondary" style={{ border: '1px solid var(--color-success)', color: 'var(--color-success)', fontSize: '11px', padding: '8px 14px' }}>
                                <Video size={13} strokeWidth={2} /> Masuk Meet
                              </Button>
                            </a>
                          ) : (
                            <Button variant="secondary" disabled style={{ fontSize: '11px', opacity: 0.6, padding: '8px 14px' }}>
                              Link menyusul
                            </Button>
                          )}
                            <Button
                              variant="secondary"
                              onClick={() => setCancelSlot(slot)}
                              disabled={cancelLoading}
                              style={{ fontSize: '11px', padding: '8px 14px', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}
                            >
                              <CalendarX2 size={13} strokeWidth={2} /> Batalkan
                            </Button>
                          </div>
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
              {/* Tanpa display inline: gaya inline mengalahkan class yang menyembunyikannya di desktop.
                  No inline display: an inline style beats the class that hides it on desktop. */}
              <div className="student-mobile-only" style={{ textAlign: 'center', backgroundColor: '#fff8e5', border: '1px solid var(--color-highlight-yellow)', borderRadius: '10px', padding: '10px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-highlight-yellow-text)' }}>Sisa kuota: {remainingQuota} / {maxQuota} - Ideal minggu 2</span>
              </div>

              {/* Informasi & Aturan Mentoring (node 15:304) */}
              <div style={{ backgroundColor: '#fff8e5', border: '1px solid var(--color-highlight-yellow)', borderRadius: '14px', padding: '18px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-highlight-yellow-text)', marginBottom: '10px' }}>Informasi & Aturan Mentoring</h3>
                <ul style={{ fontSize: '11px', color: 'var(--color-highlight-yellow-text)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.4, margin: 0 }}>
                  <li>Kuota maksimal: 2 kali per peserta selama fase {phase === 'bootcamp' ? 'Bootcamp' : 'Magang'}.</li>
                  <li>Idealnya ambil 1 sesi di minggu pertama, 1 sesi di minggu kedua.</li>
                  <li>Link Google Meet otomatis dikirim ke Google Calendar kamu.</li>
                  <li>Pengingat dikirim ke email kamu 1 jam dan 10 menit sebelum sesi dimulai.</li>
                </ul>
              </div>

              {/* Riwayat Sesi Selesai (node 15:309) */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '18px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '8px' }}>Riwayat Sesi Selesai</h3>
                {pastMine.length === 0 ? (
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>Belum ada sesi yang selesai.</p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {pastMine.map((sl) => (
                      <li key={sl.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '11px' }}>
                        <CheckCircle2 size={14} color="var(--color-success)" style={{ flexShrink: 0, marginTop: '1px' }} />
                        <span>
                          <b style={{ color: 'var(--color-text-main)' }}>{formatLongDateWib(sl.date)}</b>
                          <span style={{ display: 'block', color: 'var(--color-text-muted)' }}>{sl.startTime}-{sl.endTime} WIB · Mentor {sl.mentorName}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {scheduling && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: '16px' }}>
          <div role="dialog" aria-modal="true" aria-labelledby="scheduling-title" aria-busy={!scheduling.done} style={{ backgroundColor: '#ffffff', borderRadius: '14px', width: '100%', maxWidth: '400px', padding: '26px 22px', textAlign: 'center' }}>
            {!scheduling.done ? (
              <>
                <Loader2 size={40} color="var(--color-primary)" className="spin" style={{ margin: '0 auto 14px', display: 'block' }} />
                <h3 id="scheduling-title" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '6px' }}>Sedang menjadwalkan...</h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
                  Membuat undangan Google Calendar dan link Google Meet bersama Mentor {scheduling.slot.mentorName}. Mohon tunggu dan jangan tutup halaman ini.
                </p>
                <p role="status" style={{ fontSize: '11px', color: 'var(--color-text-faint)', marginTop: '12px' }}>Biasanya selesai dalam 5-20 detik</p>
              </>
            ) : (
              <>
                <CheckCircle2 size={44} color="var(--color-success)" style={{ margin: '0 auto 12px', display: 'block' }} />
                <h3 id="scheduling-title" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '6px' }}>Jadwal berhasil dibuat</h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '0 0 4px' }}>
                  Mentor {scheduling.slot.mentorName}<br />
                  {formatLongDateWib(scheduling.slot.date)}, {scheduling.slot.startTime}-{scheduling.slot.endTime} WIB
                </p>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '8px 0 16px' }}>
                  {scheduling.meetUrl
                    ? 'Undangan Google Calendar sudah dikirim ke email kamu dan mentor. Pengingat menyusul 1 jam dan 10 menit sebelum sesi.'
                    : 'Slot sudah menjadi milikmu. Undangan dan link Meet sedang disiapkan dan akan menyusul.'}
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {scheduling.meetUrl && (
                    <a href={scheduling.meetUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      <Button variant="secondary" style={{ border: '1px solid var(--color-success)', color: 'var(--color-success)' }}>
                        <Video size={14} strokeWidth={2} /> Buka link Meet
                      </Button>
                    </a>
                  )}
                  <Button variant="primary" onClick={() => setScheduling(null)}>Tutup</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {cancelSlot && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '16px' }}>
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-title" style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '420px', padding: '22px' }}>
            <h3 id="cancel-title" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '8px' }}>Batalkan jadwal mentoring?</h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: '6px' }}>
              {formatLongDateWib(cancelSlot.date)}, {cancelSlot.startTime}-{cancelSlot.endTime} WIB bersama Mentor {cancelSlot.mentorName}.
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: '18px' }}>
              Slot akan dibuka kembali untuk peserta lain, kuota kamu dikembalikan, dan undangan di Google Calendar ikut dihapus.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={() => setCancelSlot(null)} disabled={cancelLoading}>Tidak jadi</Button>
              <Button variant="danger" onClick={() => performCancel(cancelSlot)} disabled={cancelLoading}>
                {cancelLoading ? 'Membatalkan...' : 'Ya, Batalkan'}
              </Button>
            </div>
          </div>
        </div>
      )}

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
