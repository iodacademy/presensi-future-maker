'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Users, ChevronRight, Download } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import type { ClassSummary } from '@/features/classes/types';

/**
 * Daftar kelas sebagai pintu masuk mentoring.
 *
 * Sebelumnya seluruh pengaturan mentoring berada pada satu halaman dengan
 * pemilih kelas, sehingga slot, penugasan, dan pembatalan bercampur. Penugasan
 * dikerjakan per kelas, lalu per mentor, sehingga urutannya kini mengikuti
 * urutan itu.
 *
 * The class list as the entry point to mentoring.
 *
 * All mentoring settings previously sat on one page behind a class picker, so
 * slots, assignments, and cancellations were mixed together. Assignment is done
 * per class, then per mentor, so the navigation now follows that order.
 */
export default function AdminMentoringPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/classes')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setClasses(d.classes || []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell role="admin" userName="Administrator">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
            Mentoring
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' }}>
            Pilih kelas untuk mengatur penugasan mentor dan slot mentoring
          </p>
        </div>
        <a
          href="/api/exports/mentoring-recordings"
          title="Sesi 1-on-1 yang sudah selesai dan punya rekaman, satu sheet per kelas"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '8px', backgroundColor: 'var(--color-primary)', color: '#ffffff', textDecoration: 'none', fontSize: '11px', fontWeight: 700 }}
        >
          <Download size={12} strokeWidth={2} /> Ekspor Rekaman Mentoring
        </a>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          Memuat daftar kelas...
        </div>
      ) : classes.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed var(--color-border)', padding: '36px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Belum ada kelas</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {classes.map((cls) => (
            <button
              key={cls.id}
              type="button"
              onClick={() => router.push(`/admin/mentoring/${cls.id}`)}
              style={{
                textAlign: 'left', backgroundColor: '#ffffff', borderRadius: '14px',
                border: '1px solid var(--color-border)', padding: '16px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>
                  {cls.programName}
                </h3>
                <span style={{ padding: '3px 8px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: '10px', fontSize: '9px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {cls.city}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <GraduationCap size={12} color="var(--color-text-muted)" strokeWidth={2} />
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  {cls.mentorCount} mentor - {cls.studentCount} peserta
                </span>
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--color-border)' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 600, color: 'var(--color-primary)' }}>
                  <Users size={12} strokeWidth={2} />
                  Atur mentoring
                </span>
                <ChevronRight size={14} color="var(--color-primary)" strokeWidth={2} />
              </div>
            </button>
          ))}
        </div>
      )}
    </AppShell>
  );
}
