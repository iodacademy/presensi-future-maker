'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import type { Phase } from '@/features/assignments/types';

interface AssignStudentModalProps {
  isOpen: boolean;
  classId: string;
  className: string;
  phase: Phase;
  mentorId: string;
  mentorName: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface StudentRow {
  student: { uid: string; name: string };
  assignment: { mentorId: string; mentorName?: string } | null;
}

// Modal dibangun presisi mengikuti node Figma 10:2045 (w=560, radius=16, padding=22, itemSpacing=14)
// Aturan D-01: assign berarti peserta -> mentor per fase, bukan alokasi ke jadwal tertentu.
// Modal built precisely following Figma node 10:2045.
// Per D-01: assignment maps student -> mentor per phase, not to a specific slot.
export function AssignStudentModal({
  isOpen, classId, className, phase, mentorId, mentorName, onClose, onSuccess,
}: AssignStudentModalProps) {
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`/api/assignments?classId=${encodeURIComponent(classId)}&phase=${phase}`)
      .then((r) => r.json())
      .then((d) => setStudents(d.students || []))
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [isOpen, classId, phase]);

  const filtered = useMemo(
    () => students.filter((s) => s.student.name.toLowerCase().includes(search.toLowerCase())),
    [students, search]
  );

  if (!isOpen) return null;

  async function handleConfirm() {
    if (!selectedStudentId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudentId, classId, phase, mentorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menugaskan mentor');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '16px' }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '560px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Header (node 10:2046) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-main)' }}>
              Assign Siswa ke Mentor
            </h2>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
              Fase {phase === 'bootcamp' ? 'Bootcamp' : 'Magang'} - Mentor {mentorName}
            </span>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <X size={18} color="var(--color-text-faint)" strokeWidth={2} />
          </button>
        </div>

        {/* Search box (node 10:2052) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
          <Search size={13} color="var(--color-text-faint)" strokeWidth={2} />
          <input
            placeholder="Cari nama peserta berdasarkan kelas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: '10px', flex: 1, fontFamily: 'inherit' }}
          />
        </div>

        {/* List peserta (node 10:2058) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-faint)', letterSpacing: '0.3px' }}>
            PESERTA - {className.toUpperCase()} (MENTOR {mentorName.toUpperCase()})
          </span>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '11px' }}>Memuat peserta...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-faint)', fontSize: '11px' }}>Tidak ada peserta ditemukan.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
              {filtered.map((row) => {
                const isSelected = selectedStudentId === row.student.uid;
                const isAssignedElsewhere = row.assignment && row.assignment.mentorId !== mentorId;
                return (
                  <div
                    key={row.student.uid}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '9px', borderRadius: '8px',
                      backgroundColor: isSelected ? 'var(--color-primary-light)' : 'transparent',
                      border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    }}
                  >
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-secondary, #58cae7)', color: '#ffffff', fontSize: '9px', fontWeight: 700 }}>
                      {row.student.name.charAt(0).toUpperCase()}
                    </span>
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-main)' }}>{row.student.name}</span>
                      <span style={{ fontSize: '8px', color: isAssignedElsewhere ? 'var(--color-text-faint)' : 'var(--color-text-muted)' }}>
                        {isAssignedElsewhere ? `Sudah dengan mentor: ${row.assignment?.mentorName || '-'}` : 'Belum ada mentor di fase ini'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId(row.student.uid)}
                      style={{
                        padding: '5px 10px', borderRadius: '7px', fontSize: '9px', fontWeight: 700, cursor: 'pointer',
                        border: isSelected ? 'none' : '1px solid var(--color-primary)',
                        backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                        color: isSelected ? '#ffffff' : 'var(--color-primary)',
                      }}
                    >
                      Pilih
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {error && <div style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '10px', borderRadius: '6px', fontSize: '11px' }}>{error}</div>}

        {/* Footer tombol (node 10:2082) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={onClose} disabled={submitting} style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-border)', color: 'var(--color-text-main)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !selectedStudentId}
            style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '11px', fontWeight: 700, cursor: 'pointer', opacity: !selectedStudentId ? 0.5 : 1 }}
          >
            {submitting ? 'Menyimpan...' : 'Konfirmasi Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}
