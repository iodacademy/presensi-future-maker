'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import type { ClassSummary } from '@/features/classes/types';

// Halaman awal Jadwal & Presensi: daftar kelas saja (mirip /admin/kelas).
// Klik kartu -> masuk ke /admin/jadwal/[classId] untuk lihat & kelola sesi kelas itu.
//
// Jadwal & Attendance landing page: class list only (similar to /admin/kelas).
// Click a card -> navigate to /admin/jadwal/[classId] to view & manage that class's sessions.
export default function AdminJadwalPage() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClasses() {
      try {
        setLoading(true);
        const res = await fetch('/api/classes');
        if (res.ok) {
          const data = await res.json();
          setClasses(data.classes || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadClasses();
  }, []);

  return (
    <AppShell role="admin" userName="Administrator">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
          Jadwal dan Presensi
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
          Pilih kelas untuk kelola jadwal dan presensinya
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          Memuat daftar kelas...
        </div>
      ) : classes.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '8px' }}>
            Belum ada kelas terdaftar
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Buat kelas terlebih dahulu di menu Kelas sebelum mengatur jadwal.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          {classes.map((cls) => (
            <Link key={cls.id} href={`/admin/jadwal/${cls.id}`} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  width: '280px', backgroundColor: '#ffffff', borderRadius: '14px', padding: '16px',
                  border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)' }}>{cls.programName}</h3>
                  <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '9px', fontWeight: 700, backgroundColor: 'var(--color-border)', color: 'var(--color-text-main)' }}>
                    {cls.city}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{cls.studentCount} peserta</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 600, color: 'var(--color-primary)' }}>
                    Kelola Jadwal
                    <ChevronRight size={12} strokeWidth={2} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
