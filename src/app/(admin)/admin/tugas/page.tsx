'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, ChevronRight, Download, Users } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Pagination, PAGE_SIZE } from '@/components/ui/pagination';
import type { ClassSummary } from '@/features/classes/types';
import { formatLongDateTimeWib } from '@/lib/time';
import { TASK_KIND_LABELS, type TaskKind } from '@/features/tasks/types';

interface TaskRow {
  id: string;
  title: string;
  kind: TaskKind;
  order: number;
  dueAt: string | null;
  published: boolean;
  submitted: number;
  graded: number;
  late: number;
}

/**
 * Rekap pengumpulan tugas, dikelompokkan per tugas.
 *
 * Kelas dipilih lebih dulu lewat kartu: admin menilai satu kelas dalam satu
 * duduk. Kelas yang dipilih disimpan di URL agar tombol kembali dari halaman
 * satu tugas membawanya ke tabel kelas yang sama, bukan ke awal lagi.
 *
 * The task submission report, grouped per task.
 *
 * A class is picked first through cards: an admin grades one class in one
 * sitting. The chosen class lives in the URL so the back button from a task's
 * page returns to the same class table, not to the start again.
 */
export default function AdminTugasPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [classId, setClassId] = useState<string | null>(null);

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [kind, setKind] = useState<TaskKind>('working-paper');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    setClassId(new URLSearchParams(window.location.search).get('kelas'));
    fetch('/api/classes')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setClasses(d?.classes || []))
      .catch((e) => console.error(e));
  }, []);

  const selectedClass = classes.find((c) => c.id === classId) ?? null;

  function chooseClass(id: string | null) {
    setClassId(id);
    router.replace(id ? `/admin/tugas?kelas=${encodeURIComponent(id)}` : '/admin/tugas');
  }

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/tasks/summary?classId=${encodeURIComponent(classId)}`)
      .then(async (res) => {
        // Kegagalan kueri ditampilkan, bukan ditelan: tabel kosong karena kueri
        // gagal terlihat persis sama dengan kelas yang memang belum bertugas.
        //
        // A failed query is shown rather than swallowed: a table empty because
        // the query failed looks exactly like a class with no tasks yet.
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat tugas');
        setTasks(data.tasks || []);
        setStudentCount(data.studentCount || 0);
      })
      .catch((e) => {
        setLoadError((e as Error).message);
        setTasks([]);
      })
      .finally(() => setLoading(false));
  }, [classId]);

  // Halaman kembali ke awal setiap kali penyaringnya berubah. Dibiarkan,
  // pencarian yang menyisakan tiga baris pada halaman tiga menampilkan daftar
  // kosong.
  //
  // The page resets whenever a filter changes. Left alone, a search leaving
  // three rows while on page three shows an empty list.
  useEffect(() => { setPage(0); }, [classId, kind, query]);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  /**
   * Satu sheet per tugas berisi No, Nama, dan tautan hasilnya. Seluruh peserta
   * aktif tercantum, termasuk yang belum mengumpulkan, agar yang kosong
   * terlihat tanpa mencocokkan daftar nama sendiri.
   *
   * One sheet per task holding No, Name and the link to the work. Every active
   * participant is listed, including those yet to submit, so the gaps show
   * without matching name lists by hand.
   */
  async function exportExcel() {
    if (!selectedClass) return;
    setExporting(true);
    setExportError(null);
    try {
      const daftar = ofKind.filter((t) => t.published);
      const rosters = await Promise.all(
        daftar.map(async (t) => {
          const resp = await fetch(`/api/tasks/${encodeURIComponent(t.id)}/roster`);
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || `Gagal memuat ${t.title}`);
          return data as {
            submitted: { studentName: string; url: string | null; fileUrl: string | null; fileLost: boolean }[];
            pending: { studentName: string }[];
          };
        })
      );
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const dipakai = new Set<string>();
      daftar.forEach((t, i) => {
        const baris = [
          ...rosters[i].submitted.map((r) => ({
            nama: r.studentName,
            // Berkas unggahan dibuka lewat aplikasi, jadi tautannya harus lengkap dengan alamatnya.
            // Uploaded files open through the app, so the link needs its full address.
            link: r.url ?? (r.fileUrl ? `${window.location.origin}${r.fileUrl}` : null),
            ket: r.fileLost ? 'Berkas tidak tersimpan, perlu unggah ulang' : 'Terkumpul tanpa tautan',
          })),
          ...rosters[i].pending.map((r) => ({ nama: r.studentName, link: null, ket: 'Belum mengumpulkan' })),
        ].sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

        const label = kind === 'capstone' ? 'Link Capstone' : 'Link Tugas';
        const ws = XLSX.utils.aoa_to_sheet([['No', 'Nama', label], ...baris.map((b, j) => [j + 1, b.nama, b.link ?? b.ket])]);
        baris.forEach((b, j) => {
          if (b.link) ws[XLSX.utils.encode_cell({ r: j + 1, c: 2 })].l = { Target: b.link };
        });
        ws['!cols'] = [{ wch: 5 }, { wch: 34 }, { wch: 70 }];
        ws['!autofilter'] = { ref: `A1:C${baris.length + 1}` };

        // Nama sheet paling panjang 31 karakter, tanpa : \ / ? * [ ], dan harus unik.
        // A sheet name is at most 31 characters, without : \ / ? * [ ], and unique.
        let nama = `${i + 1}. ${t.title}`.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim();
        while (dipakai.has(nama)) nama = `${nama.slice(0, 28)} ${dipakai.size}`;
        dipakai.add(nama);
        XLSX.utils.book_append_sheet(wb, ws, nama);
      });
      if (daftar.length === 0) throw new Error(`Belum ada ${TASK_KIND_LABELS[kind].toLowerCase()} yang terbit`);
      const jenis = kind === 'capstone' ? 'Capstone' : 'Tugas_Praktik_Mandiri';
      XLSX.writeFile(wb, `${jenis}_${selectedClass.canonicalName.replace(/[^\w-]+/g, '_')}.xlsx`);
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const ofKind = tasks.filter((t) => t.kind === kind);
  const needle = query.trim().toLowerCase();
  const visible = ofKind.filter((t) => needle === '' || t.title.toLowerCase().includes(needle));
  const halaman = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (!classId || !selectedClass) {
    return (
      <AppShell role="admin" userName="Administrator">
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
            Tugas Siswa
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' }}>
            Pilih kelas untuk melihat tugasnya dan menilai pengumpulan peserta.
          </p>
        </div>

        {classes.length === 0 ? (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed var(--color-border)', padding: '36px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            {classId ? 'Memuat kelas...' : 'Belum ada kelas'}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {classes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => chooseClass(c.id)}
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

  const th: React.CSSProperties = { textAlign: 'left', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', padding: '10px 12px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { fontSize: '12px', color: 'var(--color-text-main)', padding: '12px', borderBottom: '1px solid var(--color-border)', verticalAlign: 'middle' };

  return (
    <AppShell role="admin" userName="Administrator">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <button
          type="button"
          onClick={() => chooseClass(null)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-primary)', fontSize: '11px', fontWeight: 600, alignSelf: 'flex-start' }}
        >
          <ArrowLeft size={12} strokeWidth={2} /> Kembali ke Daftar Kelas
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
              {selectedClass.canonicalName}
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' }}>
              Tugas Siswa - {studentCount} peserta aktif. Klik sebuah tugas untuk melihat dan menilai pengumpulannya.
            </p>
          </div>
          <a
            href={`/api/exports/tasks?kind=${kind}&classId=${encodeURIComponent(selectedClass.id)}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', textDecoration: 'none', fontSize: '11px', fontWeight: 700 }}
          >
            <Download size={12} strokeWidth={2} /> Ekspor CSV
          </a>
          {(kind === 'daily' || kind === 'capstone') && (
            <button
              type="button"
              onClick={exportExcel}
              disabled={exporting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '11px', fontWeight: 700, cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.7 : 1 }}
            >
              <Download size={12} strokeWidth={2} /> {exporting ? 'Menyiapkan...' : `Ekspor Excel ${TASK_KIND_LABELS[kind]}`}
            </button>
          )}
        </div>
        {exportError && <p role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)', margin: 0 }}>Ekspor gagal: {exportError}</p>}
      </div>

      {/* Jenisnya diturunkan dari TASK_KIND_LABELS: daftar tertutup pernah
          menyembunyikan hasil praktik dari setiap admin.
          The kinds come from TASK_KIND_LABELS: a closed list once hid practice
          results from every admin. */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(Object.keys(TASK_KIND_LABELS) as TaskKind[]).map((k) => {
          const jumlah = tasks.filter((t) => t.kind === k).length;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              style={{
                padding: '7px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                fontSize: '11px', fontWeight: kind === k ? 700 : 400,
                backgroundColor: kind === k ? 'var(--color-primary)' : 'var(--color-border)',
                color: kind === k ? '#ffffff' : 'var(--color-text-main)',
              }}
            >
              {TASK_KIND_LABELS[k]} ({jumlah})
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff' }}>
        <Search size={13} color="var(--color-text-muted)" strokeWidth={2} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari judul tugas"
          aria-label="Cari tugas"
          style={{ border: 'none', outline: 'none', fontSize: '11px', flex: 1, color: 'var(--color-text-main)' }}
        />
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>Memuat tugas...</div>
      ) : loadError ? (
        <div role="alert" style={{ backgroundColor: 'var(--color-danger-light)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-danger)' }}>Daftar tugas gagal dimuat</div>
          <p style={{ fontSize: '11px', color: 'var(--color-danger)', marginTop: '6px', lineHeight: 1.55 }}>{loadError}</p>
        </div>
      ) : visible.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed var(--color-border)', padding: '36px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>
            {needle ? 'Tidak ada tugas yang cocok dengan pencarian' : `Belum ada ${TASK_KIND_LABELS[kind].toLowerCase()} di kelas ini`}
          </div>
          {!needle && (
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px', lineHeight: 1.55 }}>
              Periksa di menu Kelas apakah tugasnya sudah dibuat dan terbit.
            </p>
          )}
        </div>
      ) : (
        <>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: '44px', textAlign: 'center' }}>No</th>
                  <th style={th}>Tugas</th>
                  <th style={th}>Tenggat</th>
                  <th style={{ ...th, width: '170px' }}>Terkumpul</th>
                  <th style={{ ...th, textAlign: 'center' }}>Dinilai</th>
                  <th style={{ ...th, textAlign: 'center' }}>Menunggu nilai</th>
                  <th style={{ ...th, width: '36px' }} />
                </tr>
              </thead>
              <tbody>
                {halaman.map((t, i) => {
                  const pct = studentCount > 0 ? Math.min(100, Math.round((t.submitted / studentCount) * 100)) : 0;
                  // Hasil praktik di kelas tidak dinilai, jadi tidak pernah menunggu nilai.
                  // In-class practice results are not graded, so they never await a score.
                  const tanpaNilai = t.kind === 'working-paper';
                  const menunggu = tanpaNilai ? 0 : t.submitted - t.graded;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/admin/tugas/${t.id}`)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && router.push(`/admin/tugas/${t.id}`)}
                      tabIndex={0}
                      role="link"
                      aria-label={`Buka pengumpulan ${t.title}`}
                      style={{ cursor: 'pointer' }}
                      className="admin-row"
                    >
                      <td style={{ ...td, textAlign: 'center', color: 'var(--color-text-muted)' }}>{page * PAGE_SIZE + i + 1}</td>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{t.title}</div>
                        {!t.published && (
                          <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)', backgroundColor: 'var(--color-border)', padding: '2px 6px', borderRadius: '8px' }}>BELUM TERBIT</span>
                        )}
                      </td>
                      <td style={{ ...td, fontSize: '11px', color: 'var(--color-text-muted)' }}>{t.dueAt ? formatLongDateTimeWib(t.dueAt) : '-'}</td>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ flex: 1, height: '8px', borderRadius: '4px', backgroundColor: '#eef0f2', overflow: 'hidden' }}>
                            <span style={{ display: 'block', width: `${pct}%`, height: '100%', backgroundColor: 'var(--color-primary)' }} />
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{t.submitted}/{studentCount}</span>
                        </div>
                        {t.late > 0 && <div style={{ fontSize: '10px', color: 'var(--color-warning)', marginTop: '2px' }}>{t.late} terlambat</div>}
                      </td>
                      <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: 'var(--color-success)' }}>{tanpaNilai ? <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--color-text-muted)' }}>Tidak dinilai</span> : t.graded}</td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        {menunggu > 0 ? (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', backgroundColor: 'var(--color-warning)', padding: '3px 10px', borderRadius: '10px' }}>{menunggu}</span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>-</span>
                        )}
                      </td>
                      <td style={td}><ChevronRight size={15} color="var(--color-primary)" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalItems={visible.length} onChange={setPage} label="tugas" />
        </>
      )}
    </AppShell>
  );
}
