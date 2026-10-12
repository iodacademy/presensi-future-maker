'use client';

import React, { useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Search, Check } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import type { ClassDocument } from '@/features/classes/types';
import type { Phase } from '@/features/assignments/types';
import { MentorSlots } from './mentor-slots';

interface StudentRow {
  student: { uid: string; name: string; email: string };
  assignment: { mentorId: string; mentorName: string } | null;
}

/**
 * Pemilihan peserta bimbingan seorang mentor.
 *
 * Peserta dicentang berombongan alih-alih ditugaskan satu per satu: satu kelas
 * berisi belasan peserta, dan menugaskan mereka satu demi satu berarti belasan
 * putaran dialog yang sama.
 *
 * Selecting the participants a mentor guides.
 *
 * Participants are ticked in batches rather than assigned one at a time: a
 * class holds well over a dozen, and assigning them singly means as many
 * rounds of the same dialog.
 */
export default function MentorAssignmentPage({
  params,
}: {
  params: Promise<{ classId: string; mentorId: string }>;
}) {
  const { classId, mentorId } = use(params);
  const searchParams = useSearchParams();
  const phase = (searchParams.get('phase') as Phase) || 'bootcamp';

  const [classData, setClassData] = useState<ClassDocument | null>(null);
  const [mentorName, setMentorName] = useState('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [showOthers, setShowOthers] = useState(false);
  const [tab, setTab] = useState<'peserta' | 'jadwal'>('peserta');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [clsRes, mentorRes, studentRes] = await Promise.all([
        fetch(`/api/classes/${classId}`),
        fetch('/api/mentors'),
        fetch(`/api/assignments?classId=${encodeURIComponent(classId)}&phase=${phase}`),
      ]);

      setClassData(clsRes.ok ? (await clsRes.json()).class : null);

      if (mentorRes.ok) {
        const list = (await mentorRes.json()).mentors || [];
        setMentorName(list.find((m: { uid: string }) => m.uid === mentorId)?.name ?? 'Mentor');
      }

      const rows: StudentRow[] = studentRes.ok ? (await studentRes.json()).students || [] : [];
      setStudents(rows);
      // Peserta yang sudah dibimbing mentor ini tercentang sejak awal, sehingga
      // halaman ini menggambarkan keadaan sekarang, bukan formulir kosong.
      //
      // Participants already guided by this mentor start ticked, so the page
      // describes the current state rather than presenting an empty form.
      setSelected(new Set(rows.filter((r) => r.assignment?.mentorId === mentorId).map((r) => r.student.uid)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, mentorId, phase]);

  // Peserta yang sudah dibimbing mentor lain disembunyikan agar daftar pilihan
  // hanya berisi yang perlu ditugaskan. Mereka tetap dapat ditampilkan untuk
  // dipindahkan: penugasan baru menggantikan yang lama, dan tanpa pilihan ini
  // memindahkan peserta antar-mentor menjadi mustahil.
  //
  // Participants already guided by another mentor are hidden so the list holds
  // only those needing assignment. They can still be shown for moving: a new
  // assignment replaces the old one, and without this option moving a
  // participant between mentors would be impossible.
  const otherCount = students.filter((r) => r.assignment && r.assignment.mentorId !== mentorId).length;
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return students.filter(
      (r) =>
        (showOthers || !r.assignment || r.assignment.mentorId === mentorId) &&
        (!needle ||
          r.student.name.toLowerCase().includes(needle) ||
          (r.student.email ?? '').toLowerCase().includes(needle))
    );
  }, [students, query, showOthers, mentorId]);

  const alreadyMine = new Set(
    students.filter((r) => r.assignment?.mentorId === mentorId).map((r) => r.student.uid)
  );
  const toAdd = [...selected].filter((uid) => !alreadyMine.has(uid));

  async function handleSave() {
    if (toAdd.length === 0) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, mentorId, phase, studentIds: toAdd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan penugasan');

      const gagal = data.failures?.length ?? 0;
      setStatus({
        type: gagal > 0 ? 'error' : 'success',
        text:
          gagal > 0
            ? `${data.assigned} peserta ditugaskan, ${gagal} gagal: ${data.failures[0].reason}`
            : `${data.assigned} peserta ditugaskan kepada ${mentorName}`,
      });
      await load();
    } catch (e) {
      setStatus({ type: 'error', text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  function toggle(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  return (
    <AppShell role="admin" userName="Administrator">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Link
          href={`/admin/mentoring/${classId}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)', textDecoration: 'none', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}
        >
          <ArrowLeft size={12} strokeWidth={2} />
          Kembali ke Daftar Mentor
        </Link>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)' }}>
          {mentorName}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
          {classData?.canonicalName} - fase {phase === 'bootcamp' ? 'Bootcamp' : 'Magang'} - {alreadyMine.size} peserta dibimbing
        </p>
      </div>

      {status && (
        <div
          role="alert"
          style={{
            padding: '10px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
            backgroundColor: status.type === 'success' ? 'var(--color-success-light)' : 'var(--color-danger-light)',
            color: status.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
          }}
        >
          {status.text}
        </div>
      )}

      {/* Penugasan dan jadwal tetap pada satu halaman karena keduanya melekat
          pada mentor ini; dua halaman membuat admin menyebut mentor yang sama
          dua kali. Tab memisahkan tampilannya tanpa memisahkan alurnya: daftar
          peserta sepanjang satu kelas mendorong jadwal jauh ke bawah layar.

          Assignment and scheduling stay on one page because both belong to this
          mentor; two pages made an admin name the same mentor twice. Tabs split
          the view without splitting the flow: a class-long participant list
          pushed the schedule far below the fold. */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
        {([
          ['peserta', `Peserta Bimbingan${alreadyMine.size > 0 ? ` (${alreadyMine.size})` : ''}`],
          ['jadwal', 'Jadwal Mentoring'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-current={tab === key ? 'page' : undefined}
            style={{
              padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontSize: '11px', fontWeight: tab === key ? 700 : 600,
              backgroundColor: tab === key ? 'var(--color-primary)' : 'var(--color-border)',
              color: tab === key ? '#ffffff' : 'var(--color-text-main)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'peserta' && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff' }}>
        <Search size={13} color="var(--color-text-muted)" strokeWidth={2} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama atau email peserta"
          aria-label="Cari peserta"
          style={{ border: 'none', outline: 'none', fontSize: '11px', flex: 1, color: 'var(--color-text-main)' }}
        />
      </div>
      )}

      {tab === 'peserta' && otherCount > 0 && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-muted)', cursor: 'pointer', alignSelf: 'flex-start' }}>
          <input type="checkbox" checked={showOthers} onChange={(e) => setShowOthers(e.target.checked)} style={{ margin: 0 }} />
          Tampilkan juga {otherCount} peserta yang dibimbing mentor lain (untuk memindahkan)
        </label>
      )}

      {tab === 'peserta' && (loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          Memuat daftar peserta...
        </div>
      ) : visible.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed var(--color-border)', padding: '36px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          {query ? 'Tidak ada peserta yang cocok' : students.length > 0 ? 'Semua peserta kelas ini sudah punya mentor' : 'Kelas ini belum punya peserta'}
        </div>
      ) : (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          {visible.map((row, i) => {
            const uid = row.student.uid;
            const checked = selected.has(uid);
            const other = row.assignment && row.assignment.mentorId !== mentorId ? row.assignment : null;

            return (
              <label
                key={uid}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', cursor: 'pointer',
                  borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                  backgroundColor: checked ? 'var(--color-primary-light)' : '#ffffff',
                }}
              >
                <input type="checkbox" checked={checked} onChange={() => toggle(uid)} style={{ margin: 0, flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)' }}>{row.student.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.student.email}
                  </div>
                </div>

                {/* Hanya muncul saat peserta mentor lain ditampilkan untuk dipindahkan.
                    Only shown while other mentors' participants are shown for moving. */}
                {other && (
                  <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--color-warning-text, #7c2d12)', backgroundColor: 'var(--color-warning-light)', padding: '3px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
                    kini: {other.mentorName}
                  </span>
                )}

                {alreadyMine.has(uid) && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontWeight: 700, color: 'var(--color-success)', whiteSpace: 'nowrap' }}>
                    <Check size={11} strokeWidth={2.5} />
                    dibimbing
                  </span>
                )}
              </label>
            );
          })}
        </div>
      ))}

      {tab === 'peserta' && !loading && students.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            {toAdd.length > 0
              ? `${toAdd.length} peserta akan ditugaskan`
              : 'Centang peserta untuk menugaskannya'}
          </span>
          <Button variant="primary" onClick={handleSave} disabled={toAdd.length === 0 || saving}>
            {saving ? 'Menyimpan...' : `Tugaskan ${toAdd.length > 0 ? toAdd.length + ' peserta' : ''}`}
          </Button>
        </div>
      )}

      {tab === 'jadwal' && (
        <MentorSlots classId={classId} mentorId={mentorId} mentorName={mentorName} phase={phase} />
      )}
    </AppShell>
  );
}
