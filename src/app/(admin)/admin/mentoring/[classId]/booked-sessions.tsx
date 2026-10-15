'use client';

import React, { useEffect, useState } from 'react';
import { CalendarDays, Clock, Video, Archive, CalendarCheck, RefreshCw } from 'lucide-react';
import type { NumberedSlot as MentoringSlotDocument } from '@/features/mentoring/types';
import type { Phase } from '@/features/assignments/types';
import { formatLongDateWib } from '@/lib/time';

/**
 * Jadwal mentoring yang sudah dibooking di satu kelas, dikelompokkan per
 * mentor. Sesi yang sudah selesai pindah ke Arsip agar daftar utamanya hanya
 * berisi yang masih perlu disiapkan.
 *
 * A class's booked mentoring schedule, grouped per mentor. Finished sessions
 * move to the Archive so the main list holds only what still needs preparing.
 */
export function BookedSessions({ classId, phase }: { classId: string; phase: Phase }) {
  const [slots, setSlots] = useState<MentoringSlotDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'mendatang' | 'arsip'>('mendatang');
  const [creating, setCreating] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Pembaruan massal berjalan satu per satu: tiap booking memanggil Apps Script
  // beberapa detik, dan menembak semuanya sekaligus melampaui batas kuotanya.
  // The bulk refresh runs one at a time: each booking calls Apps Script for a few
  // seconds, and firing all at once overruns its quota.
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const refreshOne = async (slot: MentoringSlotDocument): Promise<boolean> => {
    const res = await fetch(`/api/mentoring/bookings/${slot.bookingId}/meet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: true }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memperbarui link Meet');
    setSlots((cur) => cur.map((s) => (s.id === slot.id ? { ...s, meetUrl: data.meetUrl } : s)));
    return true;
  };

  const refreshSingle = async (slot: MentoringSlotDocument) => {
    setCreating(slot.id);
    setActionError(null);
    setNotice(null);
    try {
      await refreshOne(slot);
      setNotice(`Link Meet ${slot.studentName ?? 'peserta'} diperbarui. Mentornya kini co-host.`);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setCreating(null);
    }
  };

  const refreshAll = async () => {
    setConfirmBulk(false);
    setActionError(null);
    setNotice(null);
    const targets = upcoming.filter((s) => s.bookingId && s.calendarEventId);
    setBulk({ done: 0, total: targets.length });
    const gagal: string[] = [];
    for (let i = 0; i < targets.length; i++) {
      try {
        await refreshOne(targets[i]);
      } catch (e) {
        gagal.push(`${targets[i].studentName ?? 'Peserta'}: ${(e as Error).message}`);
      }
      setBulk({ done: i + 1, total: targets.length });
    }
    setBulk(null);
    if (gagal.length > 0) setActionError(`${gagal.length} gagal diperbarui. ${gagal.join(' · ')}`);
    setNotice(`${targets.length - gagal.length} dari ${targets.length} link Meet diperbarui tanpa email.`);
  };

  const createMeet = async (slot: MentoringSlotDocument) => {
    setCreating(slot.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/mentoring/bookings/${slot.bookingId}/meet`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat link Meet');
      setSlots((cur) => cur.map((s) => (s.id === slot.id ? { ...s, meetUrl: data.meetUrl } : s)));
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setCreating(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/mentoring/slots?classId=${encodeURIComponent(classId)}&phase=${phase}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat jadwal');
        setSlots((data.slots || []).filter((s: MentoringSlotDocument) => s.status !== 'available'));
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [classId, phase]);

  // Masuk arsip begitu sesinya berakhir, bukan begitu dimulai: sesi yang sedang
  // berjalan masih perlu tautan Meet-nya di daftar utama.
  // Archived once the session ends, not when it starts: a session in progress
  // still needs its Meet link in the main list.
  const nowIso = new Date().toISOString();
  const upcoming = slots.filter((s) => s.endsAt > nowIso).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const archive = slots.filter((s) => s.endsAt <= nowIso).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const shown = tab === 'mendatang' ? upcoming : archive;

  const byMentor = new Map<string, { name: string; slots: MentoringSlotDocument[] }>();
  for (const s of shown) {
    const g = byMentor.get(s.mentorId) ?? { name: s.mentorName, slots: [] };
    g.slots.push(s);
    byMentor.set(s.mentorId, g);
  }
  const groups = [...byMentor.values()].sort((a, b) => a.name.localeCompare(b.name, 'id'));

  const tabButton = (value: 'mendatang' | 'arsip', label: string, count: number, Icon: typeof Archive) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      aria-pressed={tab === value}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
        fontSize: '11px', fontWeight: tab === value ? 700 : 400,
        backgroundColor: tab === value ? 'var(--color-primary)' : 'var(--color-border)',
        color: tab === value ? '#ffffff' : 'var(--color-text-main)',
      }}
    >
      <Icon size={12} /> {label} ({count})
    </button>
  );

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '14px', margin: 0 }}>Jadwal terbooking</h2>
          <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>Sesi mentoring yang sudah dipesan peserta, per mentor</p>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {tab === 'mendatang' && upcoming.some((s) => s.calendarEventId) && (
            <button
              type="button"
              onClick={() => setConfirmBulk(true)}
              disabled={bulk !== null}
              title="Ganti ruang Meet booking yang akan datang agar mentornya menjadi co-host"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '20px', border: '1px solid var(--color-primary)', backgroundColor: '#ffffff', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 700, cursor: bulk ? 'wait' : 'pointer' }}
            >
              <RefreshCw size={12} /> {bulk ? `Memperbarui ${bulk.done}/${bulk.total}...` : 'Perbarui semua link Meet'}
            </button>
          )}
          {tabButton('mendatang', 'Akan datang', upcoming.length, CalendarCheck)}
          {tabButton('arsip', 'Arsip', archive.length, Archive)}
        </div>
      </div>

      {confirmBulk && (
        <div role="dialog" aria-label="Konfirmasi pembaruan link Meet" style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'var(--color-primary-light)', fontSize: '12px', color: 'var(--color-text-main)', lineHeight: 1.55, display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 300px' }}>
            Ruang Meet {upcoming.filter((s) => s.calendarEventId).length} booking yang akan datang akan diganti dengan ruang baru yang mentornya co-host.
            Undangan di kalender ikut berganti <b>tanpa email</b>. Link Meet lama tidak dipakai lagi; mentor dan peserta melihat link baru di kalender dan aplikasi.
          </span>
          <button type="button" onClick={refreshAll} style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Ya, perbarui</button>
          <button type="button" onClick={() => setConfirmBulk(false)} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff', fontSize: '11px', cursor: 'pointer' }}>Batal</button>
        </div>
      )}

      {notice && (
        <div role="status" style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'var(--color-success-light)', color: '#3f6212', fontSize: '12px' }}>{notice}</div>
      )}

      {actionError && (
        <div role="alert" style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', fontSize: '12px' }}>
          {actionError}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>Memuat jadwal...</div>
      ) : error ? (
        <div role="alert" style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', fontSize: '12px' }}>
          Jadwal gagal dimuat: {error}
        </div>
      ) : groups.length === 0 ? (
        <div style={{ padding: '24px', borderRadius: '12px', border: '1px dashed var(--color-border)', backgroundColor: '#ffffff', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {tab === 'mendatang' ? 'Belum ada sesi mentoring yang akan datang.' : 'Belum ada sesi yang selesai.'}
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.name} style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: 'var(--color-bg-app)', borderBottom: '1px solid var(--color-border)' }}>
              <span aria-hidden style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                {g.name.charAt(0).toUpperCase()}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)', flex: 1 }}>{g.name}</span>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{g.slots.length} sesi</span>
            </div>
            {g.slots.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--color-border)', flexWrap: 'wrap', opacity: tab === 'arsip' ? 0.8 : 1 }}>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)' }}>
                    <CalendarDays size={13} color="var(--color-primary)" /> {formatLongDateWib(s.date)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    <Clock size={12} color="var(--color-primary)" /> {s.startTime} - {s.endTime} WIB
                  </div>
                </div>
                <div style={{ flex: '1 1 160px', minWidth: 0, fontSize: '12px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>Peserta</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontWeight: 600, color: 'var(--color-text-main)' }}>
                    {s.studentName ?? '-'}
                    {s.sessionNumber && (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '4px', backgroundColor: '#ede9fe', color: '#6d28d9' }}>Sesi ke-{s.sessionNumber}</span>
                    )}
                  </div>
                </div>
                {tab === 'mendatang' ? (
                  s.meetUrl ? (
                    <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                      <a href={s.meetUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '8px', backgroundColor: '#0e9f6e', color: '#ffffff', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                        <Video size={13} /> Buka Meet
                      </a>
                      {s.calendarEventId && (
                        <button
                          type="button"
                          onClick={() => refreshSingle(s)}
                          disabled={creating === s.id || bulk !== null}
                          aria-label={`Perbarui link Meet ${s.studentName ?? ''}`}
                          title="Ganti ruang Meet agar mentor menjadi co-host, tanpa email"
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff', cursor: creating === s.id ? 'wait' : 'pointer' }}
                        >
                          <RefreshCw size={13} color="var(--color-primary)" />
                        </button>
                      )}
                    </span>
                  ) : s.bookingId ? (
                    <button
                      type="button"
                      onClick={() => createMeet(s)}
                      disabled={creating === s.id}
                      title="Booking ini belum punya link Meet. Undangan kalender akan dikirim ke mentor dan peserta."
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--color-primary)', backgroundColor: '#ffffff', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 700, cursor: creating === s.id ? 'wait' : 'pointer' }}
                    >
                      <Video size={13} /> {creating === s.id ? 'Membuat link...' : 'Buat link Meet'}
                    </button>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Link Meet menyusul</span>
                  )
                ) : (
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', backgroundColor: '#eef0f2', padding: '3px 8px', borderRadius: '10px' }}>SELESAI</span>
                )}
              </div>
            ))}
          </div>
        ))
      )}
    </section>
  );
}
