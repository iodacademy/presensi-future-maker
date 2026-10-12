'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, Clock, Video, BellRing, MessageCircle, Mail, X, ChevronRight, TrendingUp } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { StudentDetailModal } from '@/components/student-detail-modal';
import type { MentoringSlotDocument } from '@/features/mentoring/types';
import type { MenteeProfile } from '@/features/mentoring/service';
import { formatLongDateWib } from '@/lib/time';
import { whatsAppLink } from '@/lib/whatsapp';

export default function MentorJadwalPage() {
  const [slots, setSlots] = useState<MentoringSlotDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MentoringSlotDocument | null>(null);
  const [performanceOf, setPerformanceOf] = useState<MentoringSlotDocument | null>(null);

  useEffect(() => {
    async function loadSchedule() {
      try {
        setLoading(true);
        const res = await fetch('/api/mentoring/mentor');
        if (res.ok) {
          const data = await res.json();
          setSlots(data.slots || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    loadSchedule();
  }, []);

  // Sesi yang sedang berjalan tetap di daftar utama: tautan Meet-nya masih dibutuhkan.
  // A session in progress stays in the main list: its Meet link is still needed.
  const nowIso = new Date().toISOString();
  const upcoming = slots.filter((s) => s.endsAt > nowIso);
  const past = slots.filter((s) => s.endsAt <= nowIso).reverse();

  return (
    <AppShell role="mentor" userName="Mentor">
      <div style={{ marginBottom: '18px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Jadwal Mentoring Saya</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '2px' }}>
          Daftar sesi bimbingan privat 1-on-1 yang telah dibooking oleh peserta Anda
        </p>
      </div>

      <div role="note" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '14px 16px', borderRadius: '12px', backgroundColor: 'var(--color-warning-light)', border: '1px solid var(--color-warning)', marginBottom: '18px' }}>
        <BellRing size={20} color="#7c2d12" style={{ flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '13px', color: '#7c2d12', lineHeight: 1.55 }}>
          <b>Jangan lupa ingatkan peserta sebelum sesi mentoring.</b> Kirim pengingat sehari sebelumnya dan satu jam sebelum sesi dimulai.
          Klik kartu peserta untuk melihat profil, nomor WhatsApp, dan performa belajarnya, lalu tekan <b>Kirim pengingat</b>.
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Memuat jadwal mentoring...
        </div>
      ) : slots.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '8px' }}>
            Belum ada sesi bimbingan yang dibooking
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            Peserta yang telah memilih jadwal Anda akan otomatis muncul di halaman ini.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {upcoming.length === 0 && (
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Tidak ada sesi yang akan datang.</p>
          )}
          {upcoming.map((slot) => <SlotCard key={slot.id} slot={slot} onOpen={() => setSelected(slot)} />)}

          {past.length > 0 && (
            <details style={{ marginTop: '8px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', padding: '6px 0' }}>
                Sesi yang sudah selesai ({past.length})
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', opacity: 0.75 }}>
                {past.map((slot) => <SlotCard key={slot.id} slot={slot} past onOpen={() => setSelected(slot)} />)}
              </div>
            </details>
          )}
        </div>
      )}

      {selected && (
        <MenteeModal
          slot={selected}
          onClose={() => setSelected(null)}
          onShowPerformance={() => { setPerformanceOf(selected); setSelected(null); }}
        />
      )}
      {performanceOf?.studentId && (
        <StudentDetailModal studentId={performanceOf.studentId} name={performanceOf.studentName || 'Peserta'} onClose={() => setPerformanceOf(null)} />
      )}
    </AppShell>
  );
}

function SlotCard({ slot, past = false, onOpen }: { slot: MentoringSlotDocument; past?: boolean; onOpen: () => void }) {
  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '16px 18px' }}>
      {/* Seluruh bagian kiri adalah tombol agar mudah diklik di layar sentuh.
          The whole left side is a button so it is easy to tap on touch screens. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Lihat profil ${slot.studentName ?? 'peserta'}`}
        style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit' }}
      >
        <span aria-hidden style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, flexShrink: 0 }}>
          {(slot.studentName ?? 'P').charAt(0).toUpperCase()}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>{slot.studentName || 'Peserta'}</span>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', textTransform: 'uppercase' }}>
              Fase {slot.phase}
            </span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: 'var(--color-text-main)' }}>
              <CalendarDays size={14} color="var(--color-primary)" /> {formatLongDateWib(slot.date)}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={14} color="var(--color-primary)" /> {slot.startTime} - {slot.endTime} WIB
            </span>
          </span>
        </span>
        <ChevronRight size={18} color="var(--color-text-faint)" style={{ flexShrink: 0 }} />
      </button>

      {past ? (
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', backgroundColor: '#eef0f2', padding: '4px 10px', borderRadius: '10px' }}>SELESAI</span>
      ) : slot.meetUrl ? (
        <a href={slot.meetUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '10px', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
          <Video size={16} /> Masuk Google Meet
        </a>
      ) : (
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Link Meet belum tersedia</span>
      )}
    </div>
  );
}

function MenteeModal({ slot, onClose, onShowPerformance }: { slot: MentoringSlotDocument; onClose: () => void; onShowPerformance: () => void }) {
  const [profile, setProfile] = useState<MenteeProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!slot.studentId) {
      setError('Data peserta tidak tersedia');
      return;
    }
    fetch(`/api/mentoring/mentor/students/${slot.studentId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat profil peserta');
        setProfile(data.profile);
      })
      .catch((e) => setError((e as Error).message));
  }, [slot.studentId]);

  const tanggal = formatLongDateWib(slot.date);
  const pengingat =
    `Halo ${profile?.name ?? slot.studentName ?? ''}, saya ${slot.mentorName}, mentor Future Innovators Bootcamp. ` +
    `Mengingatkan sesi mentoring kita pada ${tanggal} pukul ${slot.startTime} - ${slot.endTime} WIB.` +
    (slot.meetUrl ? ` Link Google Meet: ${slot.meetUrl}` : '') +
    ' Sampai jumpa!';
  const reminderUrl = whatsAppLink(profile?.phone, pengingat);
  const chatUrl = whatsAppLink(profile?.phone, '');

  const field = (label: string, value: React.ReactNode) => (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mentee-title"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: 'min(520px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '18px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="mentee-title" style={{ fontSize: '17px', margin: 0 }}>{profile?.name ?? slot.studentName ?? 'Peserta'}</h2>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '3px 0 0' }}>
              {tanggal} · {slot.startTime} - {slot.endTime} WIB
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Tutup" style={{ border: '1px solid var(--color-border)', background: '#ffffff', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error ? (
            <div role="alert" style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', fontSize: '13px' }}>{error}</div>
          ) : !profile ? (
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0' }}>Memuat profil peserta...</p>
          ) : (
            <>
              <div style={{ borderRadius: '12px', backgroundColor: 'var(--color-bg-app)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {field('Nomor WhatsApp', profile.phone ?? 'Belum diisi peserta')}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {reminderUrl ? (
                    <>
                      <a href={reminderUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', backgroundColor: '#128c4a', color: '#ffffff', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
                        <BellRing size={15} /> Kirim pengingat
                      </a>
                      <a href={chatUrl!} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', border: '1px solid #128c4a', color: '#128c4a', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
                        <MessageCircle size={15} /> Chat WhatsApp
                      </a>
                    </>
                  ) : (
                    <a href={`mailto:${profile.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
                      <Mail size={15} /> Kirim email
                    </a>
                  )}
                </div>
                {reminderUrl && (
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                    <b>Kirim pengingat</b> membuka WhatsApp dengan pesan berisi tanggal, jam, dan link Meet. Periksa dulu sebelum mengirim.
                  </p>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                {field('Kelas', profile.className || '-')}
                {field('Email', profile.email)}
                {field('Usia', profile.age === null ? '-' : `${profile.age} tahun`)}
                {field('Jenis kelamin', profile.gender ?? '-')}
                {field('Status saat mendaftar', profile.entryStatus ?? '-')}
                {field('Disabilitas', profile.disability ?? '-')}
              </div>

              <button
                type="button"
                onClick={onShowPerformance}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '11px 14px', borderRadius: '10px', border: 0, backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                <TrendingUp size={16} /> Lihat performa belajar
              </button>

              {!profile.phone && (
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>
                  Peserta belum melengkapi profilnya, sehingga nomor WhatsApp belum tersedia.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
