'use client';

import React, { useEffect, useState } from 'react';
import { Plus, UserCheck, Download } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Input } from '@/components/ui/input';
import { AssignStudentModal } from './assign-student-modal';
import type { ClassSummary } from '@/features/classes/types';
import type { MentoringSlotDocument } from '@/features/mentoring/types';
import type { Phase } from '@/features/assignments/types';

export default function AdminMentoringPage() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classMentorIds, setClassMentorIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>('bootcamp');
  const [slots, setSlots] = useState<MentoringSlotDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableMentors, setAvailableMentors] = useState<{ uid: string; name: string; email: string }[]>([]);
  const [selectedMentorId, setSelectedMentorId] = useState<string>('');
  const [slotDate, setSlotDate] = useState<string>('');
  const [slotStartTime, setSlotStartTime] = useState<string>('16:00');
  const [submittingSlot, setSubmittingSlot] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignMentorId, setAssignMentorId] = useState<string>('');
  const [assignMentorName, setAssignMentorName] = useState<string>('');

  async function loadSlotsFor(classId: string, ph: Phase) {
    if (!classId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/mentoring/slots?classId=${encodeURIComponent(classId)}&phase=${ph}`);
      if (res.ok) { const data = await res.json(); setSlots(data.slots || []); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await fetch('/api/classes');
        if (res.ok) {
          const data = await res.json();
          const list = data.classes || [];
          setClasses(list);
          if (list.length > 0) setSelectedClassId(list[0].id);
        }
      } catch (e) { console.error(e); }
    }
    loadClasses();
  }, []);

  // slots secara inheren bergantung pada selectedClassId (harus tahu kelas dulu
  // sebelum bisa query slot-nya) -- ini dependent sequential data, TIDAK bisa
  // dijadikan Promise.all dengan loadClasses. Satu-satunya perbaikan nyata di
  // sini adalah menghindari effect ini jalan sia-sia (selectedClassId kosong).
  //
  // slots inherently depends on selectedClassId (must know the class before
  // querying its slots) -- this is dependent sequential data, it CANNOT be
  // Promise.all'd with loadClasses. The only real fix here is avoiding this
  // effect firing wastefully (empty selectedClassId).
  useEffect(() => {
    if (selectedClassId) loadSlotsFor(selectedClassId, phase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, phase]);

  // mentorIds kelas dipakai untuk hitung statistik "Belum Punya Slot" -- cuma
  // butuh field ini tiap ganti kelas, tidak perlu ikut refetch tiap ganti fase.
  //
  // Class mentorIds is used for the "Belum Punya Slot" stat -- only needed on
  // class change, no need to refetch on phase change.
  useEffect(() => {
    if (!selectedClassId) { setClassMentorIds([]); return; }
    fetch(`/api/classes/${selectedClassId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setClassMentorIds(data?.class?.mentorIds || []))
      .catch(() => setClassMentorIds([]));
  }, [selectedClassId]);

  // Cache mentor list di memori komponen -- endpoint /api/mentors sama dipakai
  // 2 tempat (modal Tambah Slot & tombol Assign Siswa), tidak perlu fetch ulang
  // kalau sudah pernah diambil dalam sesi halaman ini.
  //
  // Cache mentor list in component memory -- the /api/mentors endpoint is
  // used by 2 places (Add Slot modal & Assign Student button), no need to
  // refetch if already fetched during this page session.
  async function ensureMentorsLoaded() {
    if (availableMentors.length > 0) return availableMentors;
    try {
      const res = await fetch('/api/mentors');
      if (res.ok) {
        const data = await res.json();
        const mentors = data.mentors || [];
        setAvailableMentors(mentors);
        return mentors;
      }
    } catch (e) { console.error(e); }
    return [];
  }

  async function handleOpenModal() {
    setIsModalOpen(true);
    setSlotError(null);
    const mentors = await ensureMentorsLoaded();
    if (mentors.length > 0) setSelectedMentorId(mentors[0].uid);
  }

  async function handleCreateSlot(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingSlot(true);
    setSlotError(null);
    try {
      const res = await fetch('/api/mentoring/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClassId, phase, mentorId: selectedMentorId, date: slotDate, startTime: slotStartTime }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat slot');
      setIsModalOpen(false);
      loadSlotsFor(selectedClassId, phase);
    } catch (err: any) { setSlotError(err.message); } finally { setSubmittingSlot(false); }
  }

  async function handleCancelBooking(bookingId: string) {
    if (!confirm('Batalkan booking ini? Slot akan dilepaskan dan kuota siswa akan dikembalikan.')) return;
    try {
      const res = await fetch(`/api/mentoring/bookings/${bookingId}/cancel`, { method: 'POST' });
      if (res.ok) loadSlotsFor(selectedClassId, phase);
    } catch (e) { console.error(e); }
  }

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const totalSlots = slots.length;
  const bookedSlots = slots.filter((s) => s.status === 'booked').length;
  const availableSlots = slots.filter((s) => s.status === 'available').length;
  // Mentor kelas ini yang belum bikin satupun slot mentoring untuk fase terpilih.
  // Mentors of this class who haven't created any mentoring slot for the selected phase.
  const mentorIdsWithSlot = new Set(slots.map((s) => s.mentorId));
  const unassignedCount = classMentorIds.filter((id) => !mentorIdsWithSlot.has(id)).length;

  const labelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: 'var(--color-text-faint)' };

  return (
    <AppShell role="admin" userName="Administrator">
      {/* Header (node 10:1974): judul + 3 tombol (Tambah Mentor / Assign Siswa / Ekspor CSV) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>Mentoring</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
            {selectedClass?.canonicalName || '-'} - {phase === 'bootcamp' ? 'Bootcamp' : 'Magang'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleOpenModal}
            disabled={!selectedClassId}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
          >
            <Plus size={14} strokeWidth={2} />
            Tambah Mentor
          </button>
          <button
            type="button"
            disabled={!selectedClassId}
            onClick={async () => {
              const mentors = await ensureMentorsLoaded();
              if (mentors.length > 0) {
                setAssignMentorId(mentors[0].uid);
                setAssignMentorName(mentors[0].name);
                setIsAssignOpen(true);
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-warning)', color: '#ffffff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
          >
            <UserCheck size={14} strokeWidth={2} />
            Assign Siswa
          </button>
          {selectedClassId && (
            <a
              href={`/api/exports/mentoring?classId=${encodeURIComponent(selectedClassId)}&phase=${phase}`}
              download
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff', color: 'var(--color-text-main)', fontSize: '10px', fontWeight: 600, textDecoration: 'none' }}
            >
              Ekspor CSV
            </a>
          )}
        </div>
      </div>

      {/* Filter kelas & fase */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 600, outline: 'none' }}
        >
          {classes.map((c) => <option key={c.id} value={c.id}>{c.canonicalName}</option>)}
        </select>

        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-border)', padding: '4px', borderRadius: '8px' }}>
          {(['bootcamp', 'internship'] as Phase[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPhase(p)}
              style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer', backgroundColor: phase === p ? '#ffffff' : 'transparent', color: phase === p ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
            >
              {p === 'bootcamp' ? 'Bootcamp' : 'Magang'}
            </button>
          ))}
        </div>
      </div>

      {/* 4 kartu statistik (node 10:1991): radius=12, angka bold 18px berwarna beda */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {[
          { value: totalSlots, label: 'Total Slot', color: 'var(--color-primary)' },
          { value: bookedSlots, label: 'Sudah Dibooking', color: 'var(--color-success)' },
          { value: availableSlots, label: 'Belum Dibooking', color: 'var(--color-text-faint)' },
          { value: unassignedCount, label: 'Belum Punya Slot', color: 'var(--color-warning)' },
        ].map((stat) => (
          <div key={stat.label} style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabel slot (node 10:2004) */}
      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>Memuat slot mentoring...</div>
      ) : slots.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '8px' }}>
            Belum ada slot mentoring untuk fase {phase === 'bootcamp' ? 'Bootcamp' : 'Magang'}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto' }}>
            Tambahkan slot mentoring berdurasi 45 menit agar peserta bimbingan dapat memilih jadwal.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Header tabel abu (node 10:2005) */}
          <div style={{ display: 'flex', padding: '10px', borderRadius: '8px', backgroundColor: 'var(--color-border)', fontSize: '9px', fontWeight: 700, color: 'var(--color-text-main)' }}>
            <span style={{ width: '18%' }}>TANGGAL</span>
            <span style={{ width: '14%' }}>JAM</span>
            <span style={{ width: '18%' }}>MENTOR</span>
            <span style={{ width: '18%' }}>STATUS</span>
            <span style={{ flex: 1 }}>PESERTA</span>
          </div>

          {slots.map((slot, i) => {
            const isBooked = slot.status === 'booked';
            const isUnassigned = !slot.studentName && isBooked === false && i === slots.length - 1; // contoh highlight terakhir
            return (
              <div
                key={slot.id}
                style={{
                  display: 'flex', alignItems: 'center', padding: '10px 12px', borderRadius: '8px',
                  backgroundColor: i === 0 ? 'var(--color-primary-light)' : isUnassigned ? '#fff8f5' : '#ffffff',
                  border: i === 0 ? 'none' : isUnassigned ? '1px solid var(--color-warning)' : '1px solid var(--color-border)',
                }}
              >
                <span style={{ width: '18%', fontSize: '10px', fontWeight: 600, color: 'var(--color-text-main)' }}>{slot.date}</span>
                <span style={{ width: '14%', fontSize: '10px', color: 'var(--color-text-main)' }}>{slot.startTime}</span>
                <span style={{ width: '18%', fontSize: '10px', color: 'var(--color-text-main)' }}>{slot.mentorName}</span>
                <span style={{ width: '18%' }}>
                  <span
                    style={{
                      padding: '3px 8px', borderRadius: '10px', fontSize: '8px', fontWeight: 700,
                      backgroundColor: isBooked ? 'var(--color-success)' : '#ffd500',
                      color: isBooked ? '#ffffff' : '#7c2d12',
                    }}
                  >
                    {isBooked ? 'DIBOOKING' : 'TERSEDIA'}
                  </span>
                </span>
                <span style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: slot.studentName ? 'var(--color-text-main)' : 'var(--color-text-faint)' }}>
                    {slot.studentName || '-'}
                  </span>
                  {isBooked && slot.bookingId && (
                    <button
                      type="button"
                      onClick={() => handleCancelBooking(slot.bookingId!)}
                      style={{ fontSize: '9px', padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--color-danger)', color: '#ffffff', cursor: 'pointer', fontWeight: 700 }}
                    >
                      Batalkan
                    </button>
                  )}
                </span>
              </div>
            );
          })}

          <div style={{ textAlign: 'center', fontSize: '9px', color: 'var(--color-text-faint)', marginTop: '4px' }}>
            Menampilkan {slots.length} dari {totalSlots} slot
          </div>
        </div>
      )}

      {/* Modal Tambah Slot */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)' }}>
              Tambah Slot Mentoring ({phase === 'bootcamp' ? 'Bootcamp' : 'Magang'})
            </h2>
            <form onSubmit={handleCreateSlot} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={labelStyle}>PILIH MENTOR</label>
                <select
                  value={selectedMentorId}
                  onChange={(e) => setSelectedMentorId(e.target.value)}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px', outline: 'none' }}
                  required
                >
                  {availableMentors.map((m) => <option key={m.uid} value={m.uid}>{m.name} ({m.email})</option>)}
                </select>
              </div>
              <Input label="TANGGAL" type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} required />
              <Input label="JAM MULAI (DURASI OTOMATIS 45 MENIT)" placeholder="16:00" value={slotStartTime} onChange={(e) => setSlotStartTime(e.target.value)} required />
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                Link Google Meet dari akun penyelenggara akan dibuat otomatis saat slot dibuat.
              </div>
              {slotError && <div style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '10px', borderRadius: '6px', fontSize: '11px' }}>{slotError}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={submittingSlot} style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-border)', color: 'var(--color-text-main)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Batal</button>
                <button type="submit" disabled={submittingSlot} style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  {submittingSlot ? 'Menyimpan...' : 'Buat Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAssignOpen && selectedClass && (
        <AssignStudentModal
          isOpen={isAssignOpen}
          classId={selectedClass.id}
          className={selectedClass.canonicalName}
          phase={phase}
          mentorId={assignMentorId}
          mentorName={assignMentorName}
          onClose={() => setIsAssignOpen(false)}
          onSuccess={() => setIsAssignOpen(false)}
        />
      )}
    </AppShell>
  );
}
