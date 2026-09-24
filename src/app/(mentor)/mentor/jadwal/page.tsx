'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import type { MentoringSlotDocument } from '@/features/mentoring/types';

export default function MentorJadwalPage() {
  const [slots, setSlots] = useState<MentoringSlotDocument[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <AppShell role="mentor" userName="Mentor">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Jadwal Mentoring Saya</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '2px' }}>
          Daftar sesi bimbingan privat 1-on-1 yang telah dibooking oleh peserta Anda
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Memuat jadwal mentoring...
        </div>
      ) : slots.length === 0 ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid var(--color-border)',
            padding: '48px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '8px' }}>
            Belum ada sesi bimbingan yang dibooking
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            Peserta yang telah memilih jadwal Anda akan otomatis muncul di halaman ini.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {slots.map((slot) => (
            <div
              key={slot.id}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                padding: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--color-primary-light)',
                      color: 'var(--color-primary)',
                      textTransform: 'uppercase',
                    }}
                  >
                    FASE {slot.phase}
                  </span>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{slot.studentName || 'Peserta'}</h3>
                </div>

                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  📅 {slot.date} • ⏰ {slot.startTime} - {slot.endTime} WIB (Durasi 45 menit)
                </div>
              </div>

              <div>
                {slot.meetUrl ? (
                  <a href={slot.meetUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                    <Button variant="primary">
                      🎥 Masuk Google Meet
                    </Button>
                  </a>
                ) : (
                  <Button variant="secondary" disabled style={{ opacity: 0.6 }}>
                    Link belum tersedia
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
