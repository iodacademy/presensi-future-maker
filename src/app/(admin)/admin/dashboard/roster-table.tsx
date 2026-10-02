'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pagination, PAGE_SIZE } from '@/components/ui/pagination';
import type { DashboardSnapshot, RosterRow } from '@/features/dashboard/snapshot-types';

const STATUS_LABEL: Record<RosterRow['status'], { text: string; bg: string; fg: string }> = {
  aktif: { text: 'Aktif', bg: 'var(--color-success-light)', fg: 'var(--color-success)' },
  siaga: { text: 'Siaga', bg: 'var(--color-warning-light)', fg: '#7c2d12' },
  nonaktif: { text: 'Nonaktif', bg: 'var(--color-border)', fg: 'var(--color-text-muted)' },
};

/**
 * Tabel peserta beserta catatan admin.
 *
 * Catatannya diketik langsung di barisnya dan disimpan saat kolomnya
 * ditinggalkan, bukan lewat tombol simpan per baris: admin menelusuri belasan
 * peserta berturut-turut, dan satu tombol per baris berarti belasan ketukan
 * tambahan untuk pekerjaan yang sama.
 *
 * The participant table with the admin's notes.
 *
 * A note is typed in its row and saved when the field is left rather than
 * through a per-row save button: an admin works down a dozen participants in a
 * row, and a button each would mean a dozen extra taps for the same work.
 */
export function RosterTable({ snapshot, onNoteSaved }: { snapshot: DashboardSnapshot; onNoteSaved: () => void }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'semua' | RosterRow['status']>('semua');
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState<Record<string, { note: string; followUp: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const visible = snapshot.roster.filter(
    (r) =>
      (statusFilter === 'semua' || r.status === statusFilter) &&
      (needle === '' || r.studentName.toLowerCase().includes(needle) || r.className.toLowerCase().includes(needle))
  );
  const halaman = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  React.useEffect(() => { setPage(0); }, [query, statusFilter]);

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

  function exportCsv() {
    // Ekspor memuat seluruh baris yang tersaring, bukan halaman yang sedang
    // dilihat: berkas berisi sepuluh baris dari seratus peserta tidak dapat
    // dipakai untuk apa pun.
    //
    // The export carries every filtered row rather than the page in view: a
    // file holding ten of a hundred participants is no use for anything.
    const rows = visible.map((r, i) => ({
      No: i + 1,
      'Nama peserta': r.studentName,
      Jurusan: r.programName,
      Daerah: r.city,
      ...Object.fromEntries(
        snapshot.sessionLabels.map((label, j) => [
          `Pertemuan ${j + 1}`,
          r.attendance[j] === null ? '' : r.attendance[j] ? 'Hadir' : 'Tidak',
        ])
      ),
      'Kehadiran (%)': r.attendanceRate,
      Mentoring: `${r.mentoringUsed}/2`,
      'Pre test': r.pretest ?? '',
      ...Object.fromEntries(snapshot.quizLabels.map((label, j) => [`Kuis ${j + 1}`, r.quizScores[j] ?? ''])),
      ...Object.fromEntries(snapshot.taskLabels.map((label, j) => [`Tugas ${j + 1}`, r.taskScores[j] ?? ''])),
      'Post test': r.posttest ?? '',
      Capstone: r.capstone ?? '',
      Status: STATUS_LABEL[r.status].text,
      Catatan: r.note,
      'Tindak lanjut': r.followUp,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Peserta');
    XLSX.writeFile(wb, `daftar-peserta-${snapshot.id}.xlsx`);
  }

  const sel: React.CSSProperties = { padding: '8px 6px', fontSize: '10px', whiteSpace: 'nowrap' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 11px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff', flex: '1 1 220px' }}>
          <Search size={12} color="var(--color-text-muted)" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau kelas"
            aria-label="Cari peserta"
            style={{ border: 'none', outline: 'none', fontSize: '11px', flex: 1, color: 'var(--color-text-main)' }}
          />
        </div>

        {(['semua', 'siaga', 'aktif', 'nonaktif'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            aria-pressed={statusFilter === s}
            style={{
              padding: '6px 13px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontSize: '10px', fontWeight: statusFilter === s ? 700 : 400,
              backgroundColor: statusFilter === s ? 'var(--color-primary)' : 'var(--color-border)',
              color: statusFilter === s ? '#ffffff' : 'var(--color-text-main)',
            }}
          >
            {s === 'semua' ? 'Semua' : STATUS_LABEL[s].text}
          </button>
        ))}

        <Button variant="secondary" onClick={exportCsv} style={{ fontSize: '10px', padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <Download size={11} strokeWidth={2} /> Ekspor
        </Button>
      </div>

      {/* Tabel digulir mendatar, bukan dipersempit kolomnya: dua puluh kolom
          yang dipaksa muat membuat tiap selnya terpotong dan tidak terbaca.

          The table scrolls sideways rather than squeezing its columns: twenty
          columns forced to fit would leave every cell truncated and
          unreadable. */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '960px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg-app)' }}>
              <th style={{ ...sel, textAlign: 'left', fontWeight: 700, color: 'var(--color-text-muted)', position: 'sticky', left: 0, backgroundColor: 'var(--color-bg-app)', minWidth: '140px' }}>
                Nama peserta
              </th>
              <th style={{ ...sel, fontWeight: 700, color: 'var(--color-text-muted)' }}>Kehadiran</th>
              <th style={{ ...sel, fontWeight: 700, color: 'var(--color-text-muted)' }}>Hadir</th>
              <th style={{ ...sel, fontWeight: 700, color: 'var(--color-text-muted)' }}>Mentoring</th>
              <th style={{ ...sel, fontWeight: 700, color: 'var(--color-text-muted)' }}>Pre</th>
              <th style={{ ...sel, fontWeight: 700, color: 'var(--color-text-muted)' }}>Kuis</th>
              <th style={{ ...sel, fontWeight: 700, color: 'var(--color-text-muted)' }}>Tugas</th>
              <th style={{ ...sel, fontWeight: 700, color: 'var(--color-text-muted)' }}>Post</th>
              <th style={{ ...sel, fontWeight: 700, color: 'var(--color-text-muted)' }}>Capstone</th>
              <th style={{ ...sel, fontWeight: 700, color: 'var(--color-text-muted)' }}>Status</th>
              <th style={{ ...sel, textAlign: 'left', fontWeight: 700, color: 'var(--color-text-muted)', minWidth: '200px' }}>Catatan</th>
            </tr>
          </thead>

          <tbody>
            {halaman.map((r, i) => {
              const d = nilaiDraft(r);
              const rataKuis = r.quizScores.filter((x): x is number => x !== null);
              const rataTugas = r.taskScores.filter((x): x is number => x !== null);
              const avg = (xs: number[]) => (xs.length === 0 ? null : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length));

              return (
                <tr key={r.studentId} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--color-border)' }}>
                  <td style={{ ...sel, position: 'sticky', left: 0, backgroundColor: '#ffffff', fontWeight: 600, color: 'var(--color-text-main)' }}>
                    {r.studentName}
                    <div style={{ fontSize: '9px', fontWeight: 400, color: 'var(--color-text-faint)' }}>{r.className}</div>
                  </td>

                  {/* Titik per pertemuan: angka ringkas tidak dapat memberi
                      tahu pertemuan mana yang terlewat.

                      A dot per meeting: a summary figure cannot say which
                      meeting was missed. */}
                  <td style={{ ...sel, textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', gap: '2px' }}>
                      {r.attendance.map((a, j) => (
                        <span
                          key={j}
                          title={`${snapshot.sessionLabels[j] ?? `Pertemuan ${j + 1}`}: ${a === null ? 'belum berjalan' : a ? 'hadir' : 'tidak hadir'}`}
                          style={{
                            width: '7px', height: '7px', borderRadius: '50%',
                            backgroundColor: a === null ? 'var(--color-border)' : a ? 'var(--color-success)' : 'var(--color-danger)',
                          }}
                        />
                      ))}
                    </span>
                  </td>

                  <td style={{ ...sel, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: r.attendanceRate >= snapshot.thresholds.attendance ? 'var(--color-text-main)' : 'var(--color-danger)' }}>
                    {r.attendanceRate}%
                  </td>
                  <td style={{ ...sel, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-muted)' }}>
                    {r.mentoringUsed}/2
                  </td>
                  <td style={{ ...sel, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: r.pretest === null ? 'var(--color-text-faint)' : 'var(--color-text-main)' }}>
                    {r.pretest ?? '-'}
                  </td>
                  <td style={{ ...sel, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-main)' }}>
                    {avg(rataKuis) ?? '-'}
                  </td>
                  <td style={{ ...sel, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-main)' }}>
                    {avg(rataTugas) ?? '-'}
                  </td>
                  <td style={{ ...sel, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: r.posttest === null ? 'var(--color-text-faint)' : 'var(--color-text-main)' }}>
                    {r.posttest ?? '-'}
                  </td>
                  <td style={{ ...sel, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: r.capstone === null ? 'var(--color-text-faint)' : 'var(--color-text-main)' }}>
                    {r.capstone ?? '-'}
                  </td>

                  <td style={{ ...sel, textAlign: 'center' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', backgroundColor: STATUS_LABEL[r.status].bg, color: STATUS_LABEL[r.status].fg }}>
                      {STATUS_LABEL[r.status].text}
                    </span>
                  </td>

                  <td style={{ ...sel, whiteSpace: 'normal' }}>
                    <input
                      value={d.note}
                      onChange={(e) => setDraft((p) => ({ ...p, [r.studentId]: { ...d, note: e.target.value } }))}
                      onBlur={() => simpanCatatan(r)}
                      placeholder="Catatan"
                      aria-label={`Catatan untuk ${r.studentName}`}
                      maxLength={500}
                      style={{ width: '100%', padding: '5px 7px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '10px' }}
                    />
                    <input
                      value={d.followUp}
                      onChange={(e) => setDraft((p) => ({ ...p, [r.studentId]: { ...d, followUp: e.target.value } }))}
                      onBlur={() => simpanCatatan(r)}
                      placeholder="Tindak lanjut"
                      aria-label={`Tindak lanjut untuk ${r.studentName}`}
                      maxLength={500}
                      style={{ width: '100%', marginTop: '3px', padding: '5px 7px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '10px' }}
                    />
                    {saving === r.studentId && (
                      <div style={{ fontSize: '9px', color: 'var(--color-text-faint)', marginTop: '2px' }}>Menyimpan...</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visible.length === 0 ? (
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px' }}>
          Tidak ada peserta yang cocok
        </div>
      ) : (
        <Pagination page={page} totalItems={visible.length} onChange={setPage} label="peserta" />
      )}
    </div>
  );
}
