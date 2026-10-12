'use client';

import React, { useEffect, useState } from 'react';
import { CalendarDays, Clock, Video, Archive, CalendarCheck } from 'lucide-react';
import type { MentoringSlotDocument } from '@/features/mentoring/types';
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
        <div style={{ display: 'flex', gap: '6px' }}>
          {tabButton('mendatang', 'Akan datang', upcoming.length, CalendarCheck)}
          {tabButton('arsip', 'Arsip', archive.length, Archive)}
        </div>
      </div>

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
                  <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{s.studentName ?? '-'}</div>
                </div>
                {tab === 'mendatang' ? (
                  s.meetUrl ? (
                    <a href={s.meetUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '8px', backgroundColor: '#0e9f6e', color: '#ffffff', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
                      <Video size={13} /> Buka Meet
                    </a>
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
