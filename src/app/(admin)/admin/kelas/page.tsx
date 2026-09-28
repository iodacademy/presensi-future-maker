'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, BookOpen, Plus, Table2, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { CreateClassModal } from './create-class-modal';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import type { ClassSummary } from '@/features/classes/types';

// Warna badge kota mengikuti Figma: kota pertama primer (#0072ce), sisanya netral (#d9d9d6)
// City badge colors follow Figma: first city primary blue, rest neutral gray
const CITY_ACCENT_ORDER = new Map<string, { bg: string; fg: string }>();

function getCityBadgeStyle(city: string, index: number) {
  // Node 10:1284 (Semarang) memakai primary; 10:1298/10:1314/10:1328 memakai netral
  if (!CITY_ACCENT_ORDER.has(city) && index === 0) {
    CITY_ACCENT_ORDER.set(city, { bg: 'var(--color-primary-light)', fg: 'var(--color-primary)' });
  }
  return CITY_ACCENT_ORDER.get(city) ?? { bg: 'var(--color-border)', fg: 'var(--color-text-main)' };
}

export default function AdminKelasPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);

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

  useEffect(() => {
    loadClasses();
  }, []);

  return (
    <AppShell role="admin" userName="Administrator">
      {/* Header (node 10:1269): judul Poppins Bold 16px + subjudul Inter 11px #666666 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>Kelas</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
            {classes.length} kelas terdaftar
          </p>
        </div>

        {/* Tombol grup (node 10:1273): gap 8, tombol Tabel abu border + tombol Buat Kelas biru */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              backgroundColor: '#ffffff',
              fontSize: '10px',
              fontWeight: 400,
              color: 'var(--color-text-main)',
              cursor: 'pointer',
            }}
          >
            <Table2 size={14} color="var(--color-text-main)" strokeWidth={2} />
            {viewMode === 'cards' ? 'Tabel' : 'Kartu'}
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Plus size={14} color="#ffffff" strokeWidth={2} />
            Buat Kelas
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          Memuat data kelas...
        </div>
      ) : classes.length === 0 ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid var(--color-border)',
            padding: '56px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '8px' }}>
            Belum ada kelas yang terdaftar
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', maxWidth: '420px', margin: '0 auto 20px' }}>
            Mulai dengan menambahkan unit Kota + Kelas baru agar Anda dapat menyusun jadwal, mengimpor akun peserta, dan menugaskan mentor.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            + Buat Kelas Pertama
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* Grid kartu (node 10:1280): 3 kolom, itemSpacing 14, kartu w=280 radius=14 */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '14px',
          }}
        >
          {classes.map((cls, index) => {
            const isFirst = index === 0;
            const badge = getCityBadgeStyle(cls.city, index);
            return (
              <div
                key={cls.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  border: isFirst ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  cursor: 'pointer',
                }}
                onClick={() => router.push(`/admin/kelas/${cls.id}`)}
              >
                {/* Header kartu: judul Poppins Bold 13px + badge kota pill radius=10 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    {cls.programName}
                  </h3>
                  <span
                    style={{
                      padding: '3px 8px',
                      backgroundColor: badge.bg,
                      color: badge.fg,
                      borderRadius: '10px',
                      fontSize: '9px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cls.city}
                  </span>
                </div>

                {/* Info mentor/peserta: icon 12px + teks 10px #666666 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <GraduationCap size={12} color="var(--color-text-muted)" strokeWidth={2} />
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                    {cls.mentorCount} mentor - {cls.studentCount} peserta
                  </span>
                </div>

                {/* Divider tipis #d9d9d6 */}
                <div style={{ height: '1px', backgroundColor: 'var(--color-border)' }} />

                {/* Info tugas: sukses hijau bila ada, abu jika belum */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {cls.dailyTaskCount > 0 ? (
                      <span style={{ fontSize: '9px', color: 'var(--color-success)' }}>
                        {cls.dailyTaskCount} Tugas Praktik Mandiri - {cls.capstoneTaskCount} Capstone
                      </span>
                    ) : (
                      <>
                        <BookOpen size={12} color="var(--color-text-faint)" strokeWidth={2} />
                        <span style={{ fontSize: '9px', color: 'var(--color-text-faint)' }}>
                          Belum ada instruksi tugas
                        </span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`Hapus kelas ${cls.canonicalName}`}
                    // Seluruh kartu membuka halaman kelas; tanpa stopPropagation
                    // satu klik membuka halaman sekaligus dialog hapus.
                    //
                    // The whole card opens the class page; without stopPropagation
                    // one click would open the page and the delete dialog at once.
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDelete({ id: cls.id, label: cls.canonicalName });
                    }}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
                  >
                    <Trash2 size={13} color="var(--color-danger)" strokeWidth={2} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Tampilan Tabel (tidak ada di Figma sebagai frame terpisah — mengikuti gaya kartu) */
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid var(--color-border)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafb', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-main)' }}>Kelas</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-main)' }}>Kota</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-main)' }}>Mentor</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-main)' }}>Peserta</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-main)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((cls) => (
                <tr
                  key={cls.id}
                  style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                  onClick={() => router.push(`/admin/kelas/${cls.id}`)}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-main)' }}>{cls.programName}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>{cls.city}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>{cls.mentorCount}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>{cls.studentCount}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '10px',
                        fontSize: '9px',
                        fontWeight: 700,
                        backgroundColor: cls.status === 'active' ? 'var(--color-success-light)' : 'var(--color-border)',
                        color: cls.status === 'active' ? 'var(--color-success)' : 'var(--color-text-main)',
                      }}
                    >
                      {cls.status === 'active' ? 'AKTIF' : 'DRAFT'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateClassModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadClasses}
      />

      {pendingDelete && (
        <DeleteDialog
          endpoint={`/api/classes/${pendingDelete.id}`}
          impactQuery="?impact=1"
          entityLabel={pendingDelete.label}
          onClose={() => setPendingDelete(null)}
          onDeleted={() => {
            setPendingDelete(null);
            loadClasses();
          }}
        />
      )}
    </AppShell>
  );
}
