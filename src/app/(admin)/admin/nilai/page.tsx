'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, Users, Search, AlertTriangle } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Pagination, PAGE_SIZE } from '@/components/ui/pagination';
import { ImportScores } from './import-scores';
import { COMPONENT_LABELS, GRADE_WEIGHTS, type FinalGrade, type GradeComponent } from '@/features/grading/types';
import type { ClassSummary } from '@/features/classes/types';

/**
 * Nilai akhir peserta.
 *
 * Kelas dipilih lebih dulu lewat kartu, sama seperti halaman tugas: nilai
 * dibaca satu kelas dalam satu duduk, dan daftar gabungan empat kelas menuntut
 * admin menyaring setiap kali membuka halaman.
 *
 * Participants' final scores.
 *
 * A class is picked first through cards, as on the tasks page: scores are read
 * one class at a time, and a merged list of four classes makes an admin filter
 * every time they open the page.
 */
export default function AdminNilaiPage() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [selected, setSelected] = useState<ClassSummary | null>(null);
  const [grades, setGrades] = useState<FinalGrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/classes')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setClasses(d?.classes || []))
      .catch((e) => console.error(e));
  }, []);

  const load = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/grading/final?classId=${encodeURIComponent(selected.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat nilai');
      setGrades(data.grades || []);
    } catch (e) {
      setError((e as Error).message);
      setGrades([]);
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  // Halaman kembali ke awal saat pencariannya berubah. Dibiarkan, pencarian
  // yang menyisakan tiga baris pada halaman tiga menampilkan daftar kosong.
  //
  // The page resets when the search changes. Left alone, a search leaving three
  // rows while on page three shows an empty list.
  useEffect(() => { setPage(0); }, [selected, query]);

  if (!selected) {
    return (
      <AppShell role="admin" userName="Administrator">
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
            Nilai Akhir
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' }}>
            {Object.entries(GRADE_WEIGHTS)
              .map(([k, w]) => `${COMPONENT_LABELS[k as GradeComponent]} ${w}%`)
              .join(' - ')}
          </p>
        </div>

        {/* Impor berada di layar daftar kelas sebab berkasnya memuat seluruh
            kelas sekaligus: penilaian capstone satu angkatan dikerjakan dalam
            satu rapat, bukan per kelas. Tidak ada daftar yang perlu disegarkan
            di sini; nilainya terbaca saat sebuah kelas dibuka.

            The import sits on the class list because the file covers every
            class at once: a cohort's capstone assessment happens in one
            meeting, not per class. There is no list to refresh here; the scores
            are read when a class is opened. */}
        <ImportScores onImported={() => setGrades([])} />

        {classes.length === 0 ? (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed var(--color-border)', padding: '36px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            Belum ada kelas
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {classes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c)}
                style={{
                  flex: '1 1 260px', minWidth: '240px', textAlign: 'left', cursor: 'pointer',
                  padding: '16px', borderRadius: '12px',
                  border: '1px solid var(--color-border)', backgroundColor: '#ffffff',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)' }}>{c.canonicalName}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '3px' }}>
                    <Users size={11} strokeWidth={2} />
                    {c.studentCount} peserta
                  </div>
                </div>
                <ChevronRight size={15} color="var(--color-primary)" strokeWidth={2} style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}
      </AppShell>
    );
  }

  const needle = query.trim().toLowerCase();
  const visible = grades.filter((g) => needle === '' || g.studentName.toLowerCase().includes(needle));
  const halaman = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const belumLengkap = grades.filter((g) => g.pending.length > 0).length;

  return (
    <AppShell role="admin" userName="Administrator">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <button
          type="button"
          onClick={() => setSelected(null)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-primary)', fontSize: '11px', fontWeight: 600, alignSelf: 'flex-start' }}
        >
          <ArrowLeft size={12} strokeWidth={2} /> Kembali ke Daftar Kelas
        </button>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
          {selected.canonicalName}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' }}>
          Nilai Akhir - {grades.length} peserta
        </p>
      </div>

      {/* Komponen yang belum dinilai disebut di muka. Nilai akhir yang dibaca
          sebagai final padahal capstone-nya belum masuk akan dipakai untuk
          keputusan yang salah.

          Unassessed components are named up front. A final score read as final
          when the capstone is not yet in would be used for the wrong
          decision. */}
      {belumLengkap > 0 && (
        <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '11px 13px', borderRadius: '10px', backgroundColor: 'var(--color-warning-light)' }}>
          <AlertTriangle size={13} color="#7c2d12" strokeWidth={2} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span style={{ fontSize: '10px', color: '#7c2d12', lineHeight: 1.55 }}>
            {belumLengkap} peserta masih punya komponen yang belum dinilai. Nilainya dihitung dengan komponen itu bernilai nol, jadi angkanya akan naik setelah nilainya masuk.
          </span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff' }}>
        <Search size={13} color="var(--color-text-muted)" strokeWidth={2} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama peserta"
          aria-label="Cari peserta"
          style={{ border: 'none', outline: 'none', fontSize: '11px', flex: 1, color: 'var(--color-text-main)' }}
        />
      </div>

      {error && (
        <div role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)', padding: '10px 12px', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          Menghitung nilai...
        </div>
      ) : visible.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed var(--color-border)', padding: '36px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          {needle ? 'Tidak ada peserta yang cocok' : 'Kelas ini belum punya peserta aktif'}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {halaman.map((g, i) => {
              const peringkat = visible.indexOf(g) + 1;
              const isOpen = openId === g.studentId;

              return (
                <div key={g.studentId} style={{ borderRadius: '10px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : g.studentId)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Tutup' : 'Buka'} rincian nilai ${g.studentName}`}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', width: '22px', flexShrink: 0 }}>
                      {peringkat}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.studentName}
                    </span>
                    {g.pending.length > 0 && (
                      <span style={{ fontSize: '9px', fontWeight: 600, color: '#7c2d12', backgroundColor: 'var(--color-warning-light)', padding: '3px 8px', borderRadius: '10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {g.pending.map((p) => COMPONENT_LABELS[p]).join(', ')} belum
                      </span>
                    )}
                    <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-main)', flexShrink: 0, minWidth: '34px', textAlign: 'right' }}>
                      {g.score}
                    </span>
                  </button>

                  {isOpen && (
                    <div style={{ padding: '0 14px 12px 46px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ height: '1px', backgroundColor: 'var(--color-border)', marginBottom: '6px' }} />
                      {g.breakdown.map((b) => (
                        <div key={b.component} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '10px' }}>
                          <span style={{ width: '120px', flexShrink: 0, color: 'var(--color-text-muted)' }}>
                            {COMPONENT_LABELS[b.component]}
                          </span>
                          <span style={{ width: '42px', flexShrink: 0, textAlign: 'right', fontWeight: 600, color: 'var(--color-text-main)' }}>
                            {b.score}
                          </span>
                          <span style={{ width: '38px', flexShrink: 0, textAlign: 'right', color: 'var(--color-text-faint)' }}>
                            {b.weight}%
                          </span>
                          <span style={{ width: '46px', flexShrink: 0, textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                            {b.weighted}
                          </span>
                          <span style={{ flex: 1, minWidth: 0, color: 'var(--color-text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.detail}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Pagination page={page} totalItems={visible.length} onChange={setPage} label="peserta" />
        </>
      )}
    </AppShell>
  );
}
