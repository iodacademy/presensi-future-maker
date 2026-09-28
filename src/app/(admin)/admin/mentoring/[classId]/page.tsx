'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, ChevronRight, UserCheck } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import type { ClassDocument } from '@/features/classes/types';
import type { Phase } from '@/features/assignments/types';

interface Mentor {
  uid: string;
  name: string;
  email: string;
}

interface StudentRow {
  student: { uid: string; name: string };
  assignment: { mentorId: string; mentorName: string } | null;
}

const PHASES: [Phase, string][] = [
  ['bootcamp', 'Bootcamp'],
  ['internship', 'Magang'],
];

/**
 * Daftar mentor sebuah kelas beserta jumlah peserta bimbingannya.
 *
 * Mentor yang ditampilkan adalah yang sudah ditugaskan ke kelas ini saat kelas
 * disusun; penugasan peserta hanya dapat diberikan kepada mereka, sebab layanan
 * menolak mentor yang bukan anggota kelas.
 *
 * A class's mentor list with how many participants each guides.
 *
 * The mentors shown are those assigned to this class when it was set up;
 * participants can only be assigned to them, since the service refuses a mentor
 * who is not a member of the class.
 */
export default function MentoringClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const router = useRouter();

  const [classData, setClassData] = useState<ClassDocument | null>(null);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [phase, setPhase] = useState<Phase>('bootcamp');
  const [loading, setLoading] = useState(true);

  async function load(currentPhase: Phase) {
    setLoading(true);
    try {
      const [clsRes, mentorRes, studentRes] = await Promise.all([
        fetch(`/api/classes/${classId}`),
        fetch('/api/mentors'),
        fetch(`/api/assignments?classId=${encodeURIComponent(classId)}&phase=${currentPhase}`),
      ]);

      const cls = clsRes.ok ? (await clsRes.json()).class : null;
      setClassData(cls);

      const allMentors: Mentor[] = mentorRes.ok ? (await mentorRes.json()).mentors || [] : [];
      // Hanya mentor kelas ini. Menampilkan seluruh mentor akan menawarkan
      // pilihan yang pasti ditolak layanan.
      //
      // Only this class's mentors. Showing every mentor would offer a choice
      // the service is certain to refuse.
      setMentors(allMentors.filter((m) => (cls?.mentorIds ?? []).includes(m.uid)));

      setStudents(studentRes.ok ? (await studentRes.json()).students || [] : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(phase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, phase]);

  const unassigned = students.filter((s) => !s.assignment).length;

  return (
    <AppShell role="admin" userName="Administrator">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Link
          href="/admin/mentoring"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)', textDecoration: 'none', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}
        >
          <ArrowLeft size={12} strokeWidth={2} />
          Kembali ke Daftar Kelas
        </Link>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)' }}>
          {classData?.canonicalName || 'Mentoring'}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
          {mentors.length} mentor - {students.length} peserta
          {unassigned > 0 && ` - ${unassigned} belum punya mentor`}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)' }}>
        {PHASES.map(([value, label]) => {
          const active = phase === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setPhase(value)}
              aria-pressed={active}
              style={{
                padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px',
                borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
                fontWeight: active ? 700 : 400,
                color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          Memuat data mentoring...
        </div>
      ) : mentors.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed var(--color-border)', padding: '36px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '8px' }}>
            Kelas ini belum punya mentor
          </div>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', maxWidth: '340px', margin: '0 auto 14px' }}>
            Tambahkan mentor lewat halaman Kelas, lalu peserta dapat ditugaskan kepada mereka di sini.
          </p>
          <Link href={`/admin/kelas/${classId}`} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)' }}>
            Buka Course Builder
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {mentors.map((mentor) => {
            const guided = students.filter((s) => s.assignment?.mentorId === mentor.uid);
            return (
              <button
                key={mentor.uid}
                type="button"
                onClick={() => router.push(`/admin/mentoring/${classId}/${mentor.uid}?phase=${phase}`)}
                style={{
                  textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px',
                  backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)',
                  padding: '14px', cursor: 'pointer',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 700,
                  }}
                >
                  {mentor.name.charAt(0).toUpperCase()}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>{mentor.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {mentor.email}
                  </div>
                </div>

                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 600, color: guided.length > 0 ? 'var(--color-success)' : 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                  <UserCheck size={12} strokeWidth={2} />
                  {guided.length} peserta
                </span>

                <ChevronRight size={14} color="var(--color-primary)" strokeWidth={2} style={{ flexShrink: 0 }} />
              </button>
            );
          })}

          {unassigned > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', borderRadius: '12px', backgroundColor: 'var(--color-warning-light)', border: '1px solid #ffd500' }}>
              <Users size={14} color="#7c2d12" strokeWidth={2} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: '#7c2d12' }}>
                {unassigned} peserta belum punya mentor pada fase ini. Mereka tidak dapat memesan slot mentoring
                sampai ditugaskan.
              </span>
            </div>
          )}

          {/* Tautan ke halaman slot terpisah dihapus: halaman itu menanyakan
              ulang mentor mana yang dimaksud, padahal admin memilih mentornya
              tepat di daftar atas. Jadwal kini berada pada halaman mentornya.

              The link to a separate slot page is gone: that page asked again
              which mentor was meant, although the admin picks the mentor right
              in the list above. The schedule now lives on the mentor's page. */}
        </div>
      )}
    </AppShell>
  );
}
