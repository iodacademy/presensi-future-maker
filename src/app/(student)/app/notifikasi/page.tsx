'use client';

import React from 'react';
import { BellRing, CheckCircle2 } from 'lucide-react';
import { StudentShell, useStudentReminders } from '@/components/student-shell';
import { reminderRows, ReminderItem } from '@/components/reminders';

/**
 * Seluruh pengingat peserta, dikelompokkan per jenis. Popover lonceng hanya
 * memuat lima; halaman ini memuat semuanya.
 *
 * All of a participant's reminders, grouped by kind. The bell popover holds
 * only five; this page holds them all.
 */
export default function StudentNotificationsPage() {
  const rows = reminderRows(useStudentReminders());
  const groups = [
    { label: 'Kabar rekrutmen', rows: rows.filter((r) => r.kind === 'karier') },
    { label: 'Survei belum diisi', rows: rows.filter((r) => r.kind === 'survei') },
    { label: 'Kuis belum dikerjakan', rows: rows.filter((r) => r.kind === 'kuis') },
  ].filter((g) => g.rows.length > 0);

  return (
    <StudentShell>
      <div className="student-mobile-header" style={{ backgroundColor: 'var(--color-primary)', padding: '24px 16px 18px', paddingRight: '110px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}>Notifikasi</h1>
      </div>
      <div className="student-topbar" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid var(--color-student-border)', padding: '18px 28px', paddingRight: '200px', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>Notifikasi</h1>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Kabar rekrutmen, survei, dan kuis yang menunggu kamu</p>
        </div>
      </div>

      <div style={{ padding: '16px', maxWidth: '760px', width: '100%' }}>
        {groups.length === 0 ? (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid var(--color-student-border)', padding: '40px 16px', textAlign: 'center' }}>
            <CheckCircle2 size={36} color="var(--color-success)" style={{ margin: '0 auto 10px', display: 'block' }} />
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-main)' }}>Semua beres</div>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Tidak ada kabar rekrutmen, survei, atau kuis yang menunggu.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#7c2d12' }}>
              <BellRing size={16} color="#b45309" /> {rows.length} hal belum kamu kerjakan
            </div>
            {groups.map((g) => (
              <section key={g.label} style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid var(--color-student-border)', padding: '6px' }}>
                <h2 style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-faint)', padding: '10px 12px 4px' }}>
                  {g.label} ({g.rows.length})
                </h2>
                {g.rows.map((r) => (
                  <ReminderItem key={r.key} row={r} />
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </StudentShell>
  );
}
