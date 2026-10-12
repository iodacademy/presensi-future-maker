'use client';

import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { StudentDetailModal } from '@/components/student-detail-modal';
import { MentoringCountBadge } from '@/components/mentoring-count-badge';
import type { AssignmentDocument, Phase } from '@/features/assignments/types';

type Mentee = AssignmentDocument & { mentoringCount: number };

export default function MentorPesertaPage() {
  const [phase, setPhase] = useState<Phase>('bootcamp');
  const [students, setStudents] = useState<Mentee[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<Mentee | null>(null);
  const neverBooked = students.filter((s) => s.mentoringCount === 0);

  useEffect(() => {
    async function loadAssignedStudents() {
      setLoading(true);
      try {
        const res = await fetch(`/api/mentor/students?phase=${phase}`);
        if (res.ok) {
          const data = await res.json();
          setStudents(data.students || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    loadAssignedStudents();
  }, [phase]);

  return (
    <AppShell role="mentor" userName="Mentor">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Peserta Bimbingan</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Daftar peserta yang ditugaskan kepada Anda untuk bimbingan privat 1-on-1
          </p>
        </div>

        {/* Tab Fase Bootcamp / Magang */}
        <div style={{ display: 'flex', gap: '8px', backgroundColor: '#e4e4e7', padding: '4px', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setPhase('bootcamp')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: phase === 'bootcamp' ? '#ffffff' : 'transparent',
              color: phase === 'bootcamp' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              boxShadow: phase === 'bootcamp' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Bootcamp
          </button>
          <button
            type="button"
            onClick={() => setPhase('internship')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: phase === 'internship' ? '#ffffff' : 'transparent',
              color: phase === 'internship' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              boxShadow: phase === 'internship' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Magang
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Memuat daftar peserta bimbingan...
        </div>
      ) : students.length === 0 ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid var(--color-border)',
            padding: '56px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '8px' }}>
            Belum ada peserta bimbingan di fase {phase === 'bootcamp' ? 'Bootcamp' : 'Magang'}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto' }}>
            Admin akan menugaskan siswa bimbingan kepada Anda melalui menu Mentoring di Admin Panel.
          </p>
        </div>
      ) : (
        <>
        {neverBooked.length > 0 && (
          <div role="note" style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: 'var(--color-warning-light)', border: '1px solid var(--color-warning)', fontSize: '13px', color: '#7c2d12', lineHeight: 1.5 }}>
            <b>{neverBooked.length} peserta belum pernah mentoring:</b> {neverBooked.map((s) => s.studentName || s.studentId).join(', ')}. Ingatkan mereka untuk memilih jadwal.
          </div>
        )}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid var(--color-border)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafb', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Nama Siswa</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Fase</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Mentoring</th>
              </tr>
            </thead>
            <tbody>
              {students.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    <button
                      type="button"
                      onClick={() => setPicked(item)}
                      title="Lihat performa belajar"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 0, padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--color-primary)', cursor: 'pointer', textAlign: 'left' }}
                    >
                      {item.studentName || item.studentId} <ChevronRight size={14} />
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>
                    {item.phase}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <MentoringCountBadge count={item.mentoringCount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {picked && (
        <StudentDetailModal studentId={picked.studentId} name={picked.studentName || 'Peserta'} onClose={() => setPicked(null)} />
      )}
    </AppShell>
  );
}
