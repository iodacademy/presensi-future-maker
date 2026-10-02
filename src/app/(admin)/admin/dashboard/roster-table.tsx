'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Pagination, PAGE_SIZE } from '@/components/ui/pagination';
import type { DashboardSnapshot, RosterRow } from '@/features/dashboard/snapshot-types';
import s from './dashboard.module.css';

const STATUS_LABEL: Record<RosterRow['status'], { text: string; bg: string; fg: string }> = {
  aktif: { text: 'Aman', bg: 'var(--color-success-light)', fg: '#4d6e00' },
  siaga: { text: 'Perlu tindak lanjut', bg: 'var(--color-danger-light)', fg: 'var(--color-danger)' },
  nonaktif: { text: 'Nonaktif', bg: 'var(--color-border)', fg: 'var(--color-text-muted)' },
};

/**
 * Tabel peserta beserta catatan admin.
 *
 * Barisnya diterima dari luar, bukan disaring sendiri dari ringkasannya:
 * penyaring daerah di kepala halaman berlaku untuk seluruh panel, dan tabel yang
 * menyaring sendiri akan menampilkan daerah yang berbeda dari grafik di atasnya.
 *
 * Catatannya diketik langsung di barisnya dan disimpan saat kolomnya
 * ditinggalkan, bukan lewat tombol simpan per baris: admin menelusuri belasan
 * peserta berturut-turut, dan satu tombol per baris berarti belasan ketukan
 * tambahan untuk pekerjaan yang sama.
 *
 * The participant table with the admin's notes.
 *
 * Its rows come from outside rather than being filtered here: the region filter in
 * the page header applies to every panel, and a table filtering on its own would
 * show a different region from the charts above it.
 *
 * A note is typed in its row and saved when the field is left rather than through
 * a per-row save button: an admin works down a dozen participants in a row, and a
 * button each would mean a dozen extra taps for the same work.
 */
export function RosterTable({
  snapshot,
  rows,
  onNoteSaved,
}: {
  snapshot: DashboardSnapshot;
  rows: RosterRow[];
  onNoteSaved: () => void;
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'semua' | RosterRow['status']>('semua');
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState<Record<string, { note: string; followUp: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (statusFilter === 'semua' || r.status === statusFilter) &&
      (needle === '' || r.studentName.toLowerCase().includes(needle) || r.className.toLowerCase().includes(needle))
  );
  const halaman = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  React.useEffect(() => { setPage(0); }, [query, statusFilter, rows]);

  function nilaiDraft(r: RosterRow) {
    return draft[r.studentId] ?? { note: r.note, followUp: r.followUp };
  }

  async function simpanCatatan(r: RosterRow) {
    const d = nilaiDraft(r);
    if (d.note === r.note && d.followUp === r.followUp) return;

    setSaving(r.studentId);
    try {
      await fetch(`/api/dashboard/notes/${r.studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      onNoteSaved();
    } catch {
      // Catatannya tetap di layar; kegagalan jaringan bukan alasan menghapus
      // yang baru diketik.
      //
      // The note stays on screen; a network failure is no reason to erase what
      // was just typed.
    } finally {
      setSaving(null);
    }
  }

  const hitung = (st: RosterRow['status']) => rows.filter((r) => r.status === st).length;
  const KQ = snapshot.quizLabels.length;
  const TG = snapshot.taskLabels.length;

  /**
   * Satu sel nilai kuis atau tugas.
   *
   * Belum dikerjakan dibedakan dari nilai nol, dan keduanya dibedakan dari
   * belum berjalan: nol berarti dikerjakan dan salah semua, belum dikerjakan
   * menunggu peserta, dan belum berjalan tidak menunggu siapa pun.
   *
   * One quiz or task score cell.
   *
   * Unattempted differs from a score of zero, and both differ from not-yet-open:
   * zero means attempted and all wrong, unattempted waits on the participant, and
   * not-yet-open waits on nobody.
   */
  function sel(nilai: number | null, terkumpul: boolean | null, jenis: 'kuis' | 'tugas') {
    if (terkumpul === null && nilai === null) {
      return <span style={{ color: 'var(--color-text-faint)' }}>·</span>;
    }
    if (terkumpul === false) {
      return (
        <span className={s.stpill} style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)', fontSize: '11px' }}>
          {jenis === 'kuis' ? 'Belum dikerjakan' : 'Tidak mengumpulkan'}
        </span>
      );
    }
    if (nilai === null) {
      return <span style={{ color: 'var(--color-text-faint)' }} title="Sudah dikumpulkan, belum dinilai">belum dinilai</span>;
    }
    return (
      <span className={s.num} style={nilai < 70 ? { color: 'var(--color-danger)', fontWeight: 600 } : undefined}>
        {nilai}
      </span>
    );
  }

  const warnaHadir = (p: number) =>
    p >= 85 ? '#4d6e00' : p >= 70 ? '#7a5f00' : 'var(--color-danger)';
  const warnaMentoring = (m: number) =>
    m >= 2
      ? { background: 'var(--color-success-light)', color: '#4d6e00' }
      : m === 1
        ? { background: 'var(--color-warning-light)', color: '#7a5f00' }
        : { background: 'var(--color-danger-light)', color: 'var(--color-danger)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 11px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', flex: '1 1 220px' }}>
          <Search size={12} color="var(--color-text-muted)" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau kelas"
            aria-label="Cari peserta"
            style={{ border: 'none', outline: 'none', fontSize: '12px', flex: 1, color: 'var(--color-text-main)', background: 'transparent' }}
          />
        </div>

        <div className={s.sumrow}>
          <button
            type="button"
            aria-pressed={statusFilter === 'semua'}
            onClick={() => setStatusFilter('semua')}
            style={{ background: 'var(--color-bg-app)', color: 'var(--color-text-main)' }}
          >
            Semua: {rows.length}
          </button>
          {(['siaga', 'aktif', 'nonaktif'] as const).map((st) => (
            <button
              key={st}
              type="button"
              aria-pressed={statusFilter === st}
              onClick={() => setStatusFilter(st)}
              style={{ background: STATUS_LABEL[st].bg, color: STATUS_LABEL[st].fg }}
            >
              {STATUS_LABEL[st].text}: {hitung(st)}
            </button>
          ))}
        </div>
      </div>

      {/* Tabel digulir mendatar, bukan dipersempit kolomnya: dua puluh kolom
          yang dipaksa muat membuat tiap selnya terpotong dan tidak terbaca.

          The table scrolls sideways rather than squeezing its columns: twenty
          columns forced to fit would leave every cell truncated and
          unreadable. */}
      <div className={s.scroll} style={{ border: '1px solid var(--color-border)', borderRadius: '10px' }}>
        <table className={`${s.table} ${s.roster}`} style={{ minWidth: `${900 + (KQ + TG) * 60}px` }}>
          <thead>
            <tr>
              <th rowSpan={2} className={s.ctr} style={{ width: '44px' }}>No</th>
              <th rowSpan={2} className={s.stick}>Nama peserta</th>
              <th rowSpan={2}>Pertemuan 1 sampai {snapshot.sessionLabels.length}</th>
              <th rowSpan={2} className={s.ctr}>Hadir</th>
              <th rowSpan={2} className={s.ctr}>Mentoring</th>
              <th rowSpan={2} className={`${s.ctr} ${s.sep}`}>Pre test</th>
              {KQ > 0 && <th colSpan={KQ} className={`${s.ctr} ${s.grp} ${s.sep}`}>Kuis</th>}
              {TG > 0 && <th colSpan={TG} className={`${s.ctr} ${s.grp} ${s.sep}`}>Tugas</th>}
              <th rowSpan={2} className={`${s.ctr} ${s.sep}`}>Post test</th>
              <th rowSpan={2} className={s.ctr}>Capstone</th>
              <th rowSpan={2} className={s.sep}>Status</th>
              <th rowSpan={2}>Catatan</th>
            </tr>
            <tr>
              {snapshot.quizLabels.map((label, i) => (
                <th key={`q${i}`} className={`${s.ctr} ${s.subh} ${i === 0 ? s.sep : ''}`} title={label}>{i + 1}</th>
              ))}
              {snapshot.taskLabels.map((label, i) => (
                <th key={`t${i}`} className={`${s.ctr} ${s.subh} ${i === 0 ? s.sep : ''}`} title={label}>{i + 1}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {halaman.map((r, i) => {
              const d = nilaiDraft(r);
              const sudah = r.attendance.filter((a) => a !== null).length;
              const hadir = r.attendance.filter((a) => a === true).length;

              return (
                <tr key={r.studentId}>
                  <td className={`${s.ctr} ${s.num}`} style={{ color: 'var(--color-text-muted)' }}>
                    {page * PAGE_SIZE + i + 1}
                  </td>
                  <td className={s.stick} style={{ fontWeight: 600 }}>
                    {r.studentName}
                    <div style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-faint)' }}>{r.className}</div>
                  </td>

                  {/* Titik per pertemuan: angka ringkas tidak dapat memberi
                      tahu pertemuan mana yang terlewat.

                      A dot per meeting: a summary figure cannot say which
                      meeting was missed. */}
                  <td>
                    <span className={s.dots} aria-label={`Hadir ${hadir} dari ${sudah} pertemuan`}>
                      {r.attendance.map((a, j) => (
                        <span
                          key={j}
                          className={`${s.dot} ${a === true ? s.dotH : a === false ? s.dotX : s.dotN}`}
                          title={`${snapshot.sessionLabels[j] ?? `Pertemuan ${j + 1}`}: ${a === null ? 'belum berjalan' : a ? 'hadir' : 'tidak hadir'}`}
                        />
                      ))}
                    </span>
                  </td>

                  <td className={`${s.ctr} ${s.num}`}>
                    <b style={{ color: warnaHadir(r.attendanceRate) }}>{r.attendanceRate}%</b>{' '}
                    <span style={{ color: 'var(--color-text-faint)' }}>{hadir}/{sudah}</span>
                  </td>
                  <td className={s.ctr}>
                    <span className={`${s.stpill} ${s.num}`} style={warnaMentoring(r.mentoringUsed)}>
                      {Math.min(2, r.mentoringUsed)}/2
                    </span>
                  </td>
                  <td className={`${s.ctr} ${s.sep}`}>
                    {r.pretest === null ? <span style={{ color: 'var(--color-text-faint)' }}>·</span> : <span className={s.num}>{r.pretest}</span>}
                  </td>

                  {r.quizScores.map((x, j) => (
                    <td key={`q${j}`} className={`${s.ctr} ${j === 0 ? s.sep : ''}`}>
                      {/* Kuis tidak punya catatan pengumpulan: nilai yang tidak
                          ada berarti belum dikerjakan.

                          A quiz has no submission record: a missing score means it
                          was not attempted. */}
                      {sel(x, x === null ? false : true, 'kuis')}
                    </td>
                  ))}
                  {r.taskScores.map((x, j) => (
                    <td key={`t${j}`} className={`${s.ctr} ${j === 0 ? s.sep : ''}`}>
                      {sel(x, r.taskSubmitted[j], 'tugas')}
                    </td>
                  ))}

                  <td className={`${s.ctr} ${s.sep}`}>
                    {r.posttest === null ? <span style={{ color: 'var(--color-text-faint)' }}>Belum dimulai</span> : <span className={s.num}>{r.posttest}</span>}
                  </td>
                  <td className={s.ctr}>
                    {r.capstone === null ? <span style={{ color: 'var(--color-text-faint)' }}>Belum dimulai</span> : <span className={s.num}>{r.capstone}</span>}
                  </td>

                  <td className={s.sep}>
                    <span className={s.stpill} style={{ background: STATUS_LABEL[r.status].bg, color: STATUS_LABEL[r.status].fg }}>
                      {STATUS_LABEL[r.status].text}
                    </span>
                  </td>

                  <td className={s.note}>
                    <input
                      value={d.note}
                      onChange={(e) => setDraft((p) => ({ ...p, [r.studentId]: { ...d, note: e.target.value } }))}
                      onBlur={() => simpanCatatan(r)}
                      placeholder="Catatan"
                      aria-label={`Catatan untuk ${r.studentName}`}
                      maxLength={500}
                      className={s.noteInput}
                    />
                    <input
                      value={d.followUp}
                      onChange={(e) => setDraft((p) => ({ ...p, [r.studentId]: { ...d, followUp: e.target.value } }))}
                      onBlur={() => simpanCatatan(r)}
                      placeholder="Tindak lanjut"
                      aria-label={`Tindak lanjut untuk ${r.studentName}`}
                      maxLength={500}
                      className={s.noteInput}
                      style={{ marginTop: '3px' }}
                    />
                    {saving === r.studentId && (
                      <div style={{ fontSize: '10px', color: 'var(--color-text-faint)', marginTop: '2px' }}>Menyimpan...</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visible.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px' }}>
          Tidak ada peserta yang cocok
        </div>
      ) : (
        <Pagination page={page} totalItems={visible.length} onChange={setPage} label="peserta" />
      )}

      <div className={s.legend}>
        <span><span className={`${s.dot} ${s.dotH}`} /> hadir</span>
        <span><span className={`${s.dot} ${s.dotX}`} /> tidak hadir</span>
        <span><span className={`${s.dot} ${s.dotN}`} /> belum berjalan</span>
        <span>Nilai merah: di bawah 70</span>
        <span>· belum berjalan</span>
      </div>
    </div>
  );
}
