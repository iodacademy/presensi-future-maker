'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { BarChart, GainChart, StackedBar, StatCard, Panel, rateColor, scoreColor } from './charts';
import { RosterTable } from './roster-table';
import { formatDateTimeWib } from '@/lib/time';
import type { DashboardSnapshot } from '@/features/dashboard/snapshot-types';

/**
 * Dashboard umum seluruh daerah.
 *
 * Angkanya dibaca dari satu dokumen ringkasan, bukan dihitung saat halaman
 * dibuka: menghitungnya menuntut membaca sekitar tiga belas ribu dokumen, dan
 * ini halaman yang paling sering dibuka.
 *
 * The overall dashboard across every region.
 *
 * Its figures come from one snapshot document rather than being computed on
 * load: computing them means reading around thirteen thousand documents, and
 * this is the most-opened page there is.
 */
export default function AdminDashboardPage() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/snapshot${force ? '?refresh=1' : ''}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat dashboard');
      setSnapshot(data.snapshot);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <AppShell role="admin" userName="Administrator">
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          Memuat dashboard...
        </div>
      </AppShell>
    );
  }

  if (!snapshot) {
    return (
      <AppShell role="admin" userName="Administrator">
        <div role="alert" style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--color-danger)' }}>
          {error ?? 'Ringkasan belum tersedia'}
        </div>
        <Button variant="primary" onClick={() => load(true)} style={{ alignSelf: 'flex-start', fontSize: '11px', padding: '9px 14px' }}>
          Coba Lagi
        </Button>
      </AppShell>
    );
  }

  const dropRate = snapshot.totalRegistered > 0
    ? Math.round((snapshot.totalDroppedOut / snapshot.totalRegistered) * 100)
    : 0;

  return (
    <AppShell role="admin" userName="Administrator">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
            Dashboard
          </h1>
          {/* Waktu penghitungannya disebut. Angka yang terlihat seperti waktu
              nyata padahal berumur satu jam membuat admin menarik kesimpulan
              dari keadaan yang sudah berubah.

              The computation time is stated. Figures that look live while being
              an hour old have an admin draw conclusions from a state that has
              already changed. */}
          <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' }}>
            Dihitung {formatDateTimeWib(snapshot.generatedAt)} WIB oleh {snapshot.generatedBy}
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={() => load(true)}
          disabled={refreshing}
          style={{ fontSize: '11px', padding: '9px 14px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
        >
          <RefreshCw size={12} strokeWidth={2} />
          {refreshing ? 'Menghitung...' : 'Hitung Ulang'}
        </Button>
      </div>

      {error && (
        <div role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)', padding: '10px 12px', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <StatCard label="Terdaftar" value={snapshot.totalRegistered} detail={snapshot.classes.map((c) => `${c.city} ${c.registered}`).join(', ')} />
        <StatCard label="Aktif" value={snapshot.totalActive} detail={`${100 - dropRate}% dari terdaftar`} tone="baik" />
        <StatCard
          label="Drop out"
          value={snapshot.totalDroppedOut}
          detail={`${dropRate}% drop rate`}
          tone={dropRate >= 15 ? 'buruk' : 'netral'}
        />
        <StatCard
          label="Perlu ditindaklanjuti"
          value={snapshot.alerts.length}
          detail={`ambang hadir ${snapshot.thresholds.attendance}%, tugas ${snapshot.thresholds.task}%, kuis ${snapshot.thresholds.quiz}`}
          tone={snapshot.alerts.length > 0 ? 'buruk' : 'baik'}
        />
      </div>

      <Panel title="Status peserta per daerah" hint="Aktif dan drop out dihitung dari total terdaftar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {snapshot.classes.map((c) => (
            <div key={c.classId} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '170px', flexShrink: 0, fontSize: '10px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.className}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <StackedBar
                  parts={[
                    { label: 'Aktif', value: c.active, color: 'var(--color-success)' },
                    { label: 'Drop out', value: c.droppedOut, color: 'var(--color-danger)' },
                  ]}
                />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Kehadiran per pertemuan" hint="Persentase peserta aktif yang hadir di tiap pertemuan">
        <BarChart points={snapshot.attendancePerSession} colorFor={rateColor} />
      </Panel>

      <Panel title="Tugas terkumpul per tugas" hint="Dihitung dari peserta aktif">
        <BarChart points={snapshot.submissionPerTask} colorFor={rateColor} />
      </Panel>

      <Panel title="Nilai tugas" hint="Rata-rata nilai per tugas, standar 70">
        <BarChart points={snapshot.scorePerTask} colorFor={(v) => scoreColor(v)} suffix="" emptyLabel="belum dinilai" />
      </Panel>

      <Panel title="Kuis per sesi" hint="Rata-rata nilai kuis akhir sesi, KKM 70">
        <BarChart points={snapshot.quizPerSession} colorFor={(v) => scoreColor(v)} suffix="" emptyLabel="belum dikerjakan" />
      </Panel>

      <Panel title="Learning gain" hint="Rata-rata pretest dan postest tiap kelas, beserta kenaikan poinnya">
        <GainChart rows={snapshot.learningGain} />
      </Panel>

      <Panel title="Mentoring" hint="Sebaran pemakaian kuota dua sesi">
        <StackedBar
          parts={[
            { label: 'Belum mentoring', value: snapshot.mentoring.none, color: 'var(--color-danger)' },
            { label: '1 sesi', value: snapshot.mentoring.once, color: 'var(--color-warning)' },
            { label: '2 sesi, kuota habis', value: snapshot.mentoring.twice, color: 'var(--color-success)' },
          ]}
        />
      </Panel>

      <Panel title="Daftar peserta" hint="Catatan dan tindak lanjut tersimpan saat kolomnya ditinggalkan">
        <RosterTable snapshot={snapshot} onNoteSaved={() => load(true)} />
      </Panel>

      <Panel title="Performance ranking" hint="Rata-rata kehadiran, tugas, dan kuis. Nilai akhir berbobot ada di menu Nilai Akhir">
        {snapshot.ranking.length === 0 ? (
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Belum ada data</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {snapshot.ranking.slice(0, 10).map((r, i) => (
              <div key={r.studentId} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px' }}>
                <span style={{ width: '22px', flexShrink: 0, fontWeight: 700, color: 'var(--color-text-muted)' }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.studentName}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--color-text-faint)', flexShrink: 0 }}>{r.city}</span>
                <span style={{ width: '32px', flexShrink: 0, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-main)' }}>
                  {r.score}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Siswa berstatus alert"
        hint={`Ambang kehadiran ${snapshot.thresholds.attendance}%, tugas ${snapshot.thresholds.task}%, kuis ${snapshot.thresholds.quiz}. Diurutkan dari masalah terbanyak`}
      >
        {snapshot.alerts.length === 0 ? (
          <div style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}>
            Tidak ada peserta di bawah ambang.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '520px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg-app)' }}>
                  {['Nama', 'Kelas', 'Kehadiran', 'Tugas', 'Kuis', 'Masalah'].map((h) => (
                    <th key={h} style={{ padding: '8px', fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)', textAlign: h === 'Nama' || h === 'Kelas' ? 'left' : 'center', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshot.alerts.map((a, i) => (
                  <tr key={a.studentId} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px', fontSize: '10px', fontWeight: 600, color: 'var(--color-text-main)' }}>{a.studentName}</td>
                    <td style={{ padding: '8px', fontSize: '10px', color: 'var(--color-text-muted)' }}>{a.className}</td>
                    {([
                      [a.attendanceRate, snapshot.thresholds.attendance, '%'],
                      [a.taskRate, snapshot.thresholds.task, '%'],
                      [a.quizAverage, snapshot.thresholds.quiz, ''],
                    ] as const).map(([nilai, ambang, satuan], j) => (
                      <td key={j} style={{ padding: '8px', fontSize: '10px', textAlign: 'center', fontWeight: nilai < ambang ? 700 : 400, fontVariantNumeric: 'tabular-nums', color: nilai < ambang ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                        {nilai}{satuan}
                      </td>
                    ))}
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
                        <AlertTriangle size={9} strokeWidth={2.5} />
                        {a.issueCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Rating kepuasan" hint="Rata-rata pertanyaan bernilai angka, beserta persentase peserta aktif yang mengisi">
        {snapshot.surveys.length === 0 ? (
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Belum ada survei yang terbit</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {snapshot.surveys.map((s) => (
              <div key={s.formId} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: '11px', color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.formTitle}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--color-text-faint)', flexShrink: 0 }}>
                  {s.responseRate}% mengisi
                </span>
                <span
                  style={{
                    width: '42px', flexShrink: 0, textAlign: 'right', fontSize: '15px', fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: s.average === null
                      ? 'var(--color-text-faint)'
                      : s.average >= 4.2
                        ? 'var(--color-success)'
                        : s.average >= 3.5
                          ? 'var(--color-warning)'
                          : 'var(--color-danger)',
                  }}
                >
                  {s.average ?? '-'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
