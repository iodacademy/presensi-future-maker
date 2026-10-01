'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Search, ChevronRight, ExternalLink, FileText, Download, Users } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pagination, PAGE_SIZE } from '@/components/ui/pagination';
import type { SubmissionDocument } from '@/features/tasks/submission-types';
import type { ClassSummary } from '@/features/classes/types';
import { formatDateTimeWib } from '@/lib/time';
import { TASK_KIND_LABELS, type TaskKind } from '@/features/tasks/types';

type GradeTab = 'menunggu' | 'dinilai';

const GRADE_TABS: [GradeTab, string][] = [
  ['menunggu', 'Menunggu Dinilai'],
  ['dinilai', 'Sudah Dinilai'],
];

/**
 * Rekap pengumpulan tugas.
 *
 * Kelas dipilih lebih dulu lewat kartu, bukan lewat penyaring di atas satu
 * daftar gabungan: admin menilai satu kelas dalam satu duduk, dan daftar
 * gabungan empat kelas menuntutnya menyaring setiap kali membuka halaman.
 *
 * The task submission report.
 *
 * A class is picked first through cards rather than a filter above one merged
 * list: an admin grades one class in one sitting, and a merged list of four
 * classes makes them filter every time they open the page.
 */
export default function AdminTugasPage() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassSummary | null>(null);

  const [submissions, setSubmissions] = useState<SubmissionDocument[]>([]);
  const [totalKind, setTotalKind] = useState(0);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<TaskKind>('daily');
  const [gradeTab, setGradeTab] = useState<GradeTab>('menunggu');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const [grading, setGrading] = useState<SubmissionDocument | null>(null);
  const [scoreInput, setScoreInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [submittingGrade, setSubmittingGrade] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/classes')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setClasses(d?.classes || []))
      .catch((e) => console.error(e));
  }, []);

  async function loadSubmissions() {
    if (!selectedClass) return;
    setLoading(true);
    try {
      const dasar = `/api/submissions?kind=${kind}&classId=${encodeURIComponent(selectedClass.id)}`;
      // Keduanya diambil sekaligus: yang tersaring untuk daftarnya, dan
      // seluruhnya untuk membedakan "semua sudah dinilai" dari "belum ada yang
      // mengumpulkan". Keduanya berurutan akan menggandakan waktu tunggunya.
      //
      // Both are fetched at once: the filtered set for the list, and the whole
      // set to tell "everything is graded" from "nobody has submitted yet".
      // Doing them in sequence would double the wait.
      const [tersaring, semua] = await Promise.all([
        fetch(`${dasar}&graded=${gradeTab === 'dinilai'}`),
        fetch(dasar),
      ]);
      if (tersaring.ok) setSubmissions((await tersaring.json()).submissions || []);
      if (semua.ok) setTotalKind(((await semua.json()).submissions || []).length);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, kind, gradeTab]);

  // Halaman kembali ke awal setiap kali penyaringnya berubah. Dibiarkan,
  // pencarian yang menyisakan tiga baris pada halaman tiga menampilkan daftar
  // kosong.
  //
  // The page resets whenever a filter changes. Left alone, a search leaving
  // three rows while on page three shows an empty list.
  useEffect(() => { setPage(0); }, [selectedClass, kind, gradeTab, query]);

  function openGrade(sub: SubmissionDocument) {
    setGrading(sub);
    setScoreInput(sub.score !== null && sub.score !== undefined ? String(sub.score) : '');
    setFeedbackInput(sub.feedbackPreview || '');
    setGradeError(null);
  }

  async function handleSaveGrade(e: React.FormEvent) {
    e.preventDefault();
    if (!grading) return;
    setSubmittingGrade(true);
    setGradeError(null);
    try {
      const scoreNum = parseInt(scoreInput, 10);
      if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
        throw new Error('Nilai harus berupa angka bulat antara 0 dan 100');
      }
      const res = await fetch(`/api/submissions/${grading.id}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: scoreNum, feedback: feedbackInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan nilai');
      setGrading(null);
      loadSubmissions();
    } catch (err) {
      setGradeError((err as Error).message);
    } finally {
      setSubmittingGrade(false);
    }
  }

  const needle = query.trim().toLowerCase();
  const visible = submissions.filter(
    (s) =>
      needle === '' ||
      s.studentName.toLowerCase().includes(needle) ||
      (s.taskTitle ?? '').toLowerCase().includes(needle)
  );
  const halaman = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (!selectedClass) {
    return (
      <AppShell role="admin" userName="Administrator">
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
            Tugas Siswa
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' }}>
            Pilih kelas untuk melihat dan menilai pengumpulan pesertanya.
          </p>
        </div>

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
                onClick={() => setSelectedClass(c)}
                style={{
                  flex: '1 1 260px', minWidth: '240px', textAlign: 'left', cursor: 'pointer',
                  padding: '16px', borderRadius: '12px',
                  border: '1px solid var(--color-border)', backgroundColor: '#ffffff',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    {c.canonicalName}
                  </div>
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

  return (
    <AppShell role="admin" userName="Administrator">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <button
          type="button"
          onClick={() => setSelectedClass(null)}
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
              Tugas Siswa - {selectedClass.studentCount} peserta
            </p>
          </div>
          <a
            href={`/api/exports/tasks?kind=${kind}&classId=${encodeURIComponent(selectedClass.id)}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', textDecoration: 'none', fontSize: '11px', fontWeight: 700 }}
          >
            <Download size={12} strokeWidth={2} /> Ekspor CSV
          </a>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(Object.keys(TASK_KIND_LABELS) as TaskKind[]).map((k) => (
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
            {TASK_KIND_LABELS[k]}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)' }}>
        {GRADE_TABS.map(([value, label]) => {
          const active = gradeTab === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setGradeTab(value)}
              aria-current={active ? 'page' : undefined}
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff' }}>
        <Search size={13} color="var(--color-text-muted)" strokeWidth={2} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama peserta atau judul tugas"
          aria-label="Cari pengumpulan"
          style={{ border: 'none', outline: 'none', fontSize: '11px', flex: 1, color: 'var(--color-text-main)' }}
        />
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          Memuat pengumpulan...
        </div>
      ) : visible.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed var(--color-border)', padding: '36px', textAlign: 'center' }}>
          {/* Daftar kosong punya dua sebab yang sangat berbeda: tidak ada
              yang mengumpulkan, atau semuanya sudah dinilai. Menyebut keduanya
              sebagai "sudah dinilai" memberi tahu admin bahwa pekerjaannya
              selesai padahal belum satu pun peserta mengumpulkan.

              An empty list has two very different causes: nobody submitted, or
              everything is graded. Calling both "everything is graded" tells an
              admin their work is done when not one participant has submitted. */}
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>
            {needle
              ? 'Tidak ada yang cocok dengan pencarian'
              : totalKind === 0
                ? `Belum ada ${TASK_KIND_LABELS[kind].toLowerCase()} yang dikumpulkan`
                : gradeTab === 'menunggu'
                  ? 'Tidak ada tugas yang menunggu dinilai'
                  : 'Belum ada tugas yang dinilai'}
          </div>
          {!needle && (
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px', lineHeight: 1.55 }}>
              {totalKind === 0
                ? `Kelas ini belum memiliki ${TASK_KIND_LABELS[kind].toLowerCase()}, atau pesertanya belum mengumpulkan. Periksa di menu Kelas apakah tugasnya sudah dibuat dan terbit.`
                : gradeTab === 'menunggu'
                  ? `Seluruh ${totalKind} pengumpulan ${TASK_KIND_LABELS[kind].toLowerCase()} di kelas ini sudah dinilai.`
                  : `Ada ${totalKind} pengumpulan yang menunggu dinilai.`}
            </p>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {halaman.map((sub) => {
              const dinilai = sub.score !== null && sub.score !== undefined;
              return (
                <div
                  key={sub.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '10px',
                    border: '1px solid var(--color-border)', backgroundColor: '#ffffff',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sub.studentName}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sub.taskTitle || sub.taskId}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '9px', color: 'var(--color-text-faint)' }}>
                        {formatDateTimeWib(sub.submittedAt)} WIB
                      </span>
                      {sub.late && (
                        <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-warning)' }}>Terlambat</span>
                      )}
                    </div>
                  </div>

                  {dinilai && (
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-success)', flexShrink: 0 }}>
                      {sub.score}
                    </span>
                  )}

                  <Button
                    variant={dinilai ? 'secondary' : 'primary'}
                    onClick={() => openGrade(sub)}
                    style={{ fontSize: '10px', padding: '7px 12px', flexShrink: 0 }}
                  >
                    {dinilai ? 'Lihat' : 'Nilai'}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Diurutkan paling awal mengumpulkan lebih dulu, mengikuti urutan
              kueri layanannya: yang menunggu paling lama dinilai lebih dulu.

              Ordered earliest submission first, following the service query:
              whoever has waited longest is graded first. */}
          <Pagination page={page} totalItems={visible.length} onChange={setPage} label="pengumpulan" />
        </>
      )}

      {grading && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div role="dialog" aria-modal="true" aria-label="Penilaian tugas" style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                Penilaian Tugas
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                <strong>{grading.studentName}</strong> - {grading.taskTitle}
              </div>
            </div>

            {/* Isi pengumpulan dibuka langsung dari sini. Tautan yang hanya
                tercetak sebagai teks menuntut admin menyalinnya ke bilah
                alamat untuk setiap peserta.

                The submission opens straight from here. A link printed as
                plain text makes an admin copy it into the address bar for
                every participant. */}
            <div style={{ backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                HASIL PENGUMPULAN
              </div>
              {grading.url ? (
                <a
                  href={grading.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 12px', borderRadius: '8px', backgroundColor: 'var(--color-primary)', color: '#ffffff', textDecoration: 'none', fontSize: '11px', fontWeight: 700 }}
                >
                  <ExternalLink size={12} strokeWidth={2} />
                  Buka {grading.fileName || 'berkas pengumpulan'}
                </a>
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  <FileText size={12} strokeWidth={2} />
                  {grading.fileName || 'Peserta tidak melampirkan tautan'}
                </div>
              )}
              {grading.url && (
                <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '6px', wordBreak: 'break-all' }}>
                  {grading.url}
                </div>
              )}
            </div>

            <form onSubmit={handleSaveGrade} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Input label="SKOR NILAI (0 - 100)" type="number" min="0" max="100" step="1" placeholder="85" value={scoreInput} onChange={(e) => setScoreInput(e.target.value)} required />
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-faint)', display: 'block', marginBottom: '6px' }}>
                  CATATAN UNTUK PESERTA
                </label>
                <textarea
                  placeholder="Apresiasi dan catatan perbaikan."
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  rows={4}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  required
                />
              </div>
              {gradeError && (
                <div role="alert" style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '10px', borderRadius: '6px', fontSize: '11px' }}>
                  {gradeError}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <Button variant="secondary" type="button" onClick={() => setGrading(null)} disabled={submittingGrade}>
                  Tutup
                </Button>
                <Button variant="primary" type="submit" disabled={submittingGrade}>
                  {submittingGrade ? 'Menyimpan...' : 'Simpan Nilai'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
