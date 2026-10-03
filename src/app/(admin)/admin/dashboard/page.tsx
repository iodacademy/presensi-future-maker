'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { AppShell } from '@/components/app-shell';
import { DailyBars, GainChart, GroupedBars, Heatmap, ProfileBars, TrendLines, cityColor } from './charts';
import { RosterTable } from './roster-table';
import { formatDateTimeWib } from '@/lib/time';
import type { DashboardSnapshot, RosterRow } from '@/features/dashboard/snapshot-types';
import s from './dashboard.module.css';

/**
 * Dashboard admin, mengikuti rancangan "Dashboard FutureMakers update".
 *
 * Angkanya dibaca dari satu dokumen ringkasan, bukan dihitung saat halaman
 * dibuka: menghitungnya menuntut membaca sekitar tiga belas ribu dokumen, dan
 * ini halaman yang paling sering dibuka.
 *
 * Penyaring daerahnya bekerja di peramban, bukan dengan memuat ulang: ringkasan
 * itu sudah memuat satu baris per peserta beserta daerahnya, sehingga berpindah
 * daerah tidak menuntut satu pun pembacaan tambahan.
 *
 * The admin dashboard, following the "Dashboard FutureMakers update" design.
 *
 * Its figures come from one snapshot document rather than being computed on load:
 * computing them means reading around thirteen thousand documents, and this is
 * the most-opened page there is.
 *
 * The region filter works in the browser rather than by refetching: the snapshot
 * already carries one row per participant with their region, so switching regions
 * costs no extra reads at all.
 */
export default function AdminDashboardPage() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState<string>('Semua');

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
        <button type="button" className={s.linkbtn} onClick={() => load(true)}>Coba Lagi</button>
      </AppShell>
    );
  }

  return (
    <DashboardBody
      snapshot={snapshot}
      city={city}
      onCity={setCity}
      onReload={load}
      refreshing={refreshing}
      error={error}
    />
  );
}

function DashboardBody({
  snapshot,
  city,
  onCity,
  onReload,
  refreshing,
  error,
}: {
  snapshot: DashboardSnapshot;
  city: string;
  onCity: (c: string) => void;
  onReload: (force?: boolean) => void;
  refreshing: boolean;
  error: string | null;
}) {
  // Daerahnya diturunkan dari kelas yang ada, bukan didaftar di kode: kelas
  // baru akan muncul sendiri pada penyaringnya.
  //
  // The regions derive from the existing classes rather than a list in code: a
  // new class appears in the filter on its own.
  const allCities = useMemo(
    () => [...new Set(snapshot.classes.map((c) => c.city))].filter(Boolean).sort(),
    [snapshot.classes]
  );
  const cities = useMemo(() => (city === 'Semua' ? allCities : [city]), [city, allCities]);
  const satuDaerah = cities.length === 1;

  const kelasTerpilih = snapshot.classes.filter((c) => cities.includes(c.city));
  const terdaftar = kelasTerpilih.reduce((t, c) => t + c.registered, 0);
  const aktif = kelasTerpilih.reduce((t, c) => t + c.active, 0);
  const keluar = terdaftar - aktif;
  const dropRate = terdaftar > 0 ? Math.round((keluar / terdaftar) * 100) : 0;

  // Seluruh panel disaring dari baris peserta yang sama, sehingga tidak ada
  // angka yang menyimpang dari angka lain saat daerahnya berpindah.
  //
  // Every panel filters from the same participant rows, so no figure can drift
  // from another when the region changes.
  const rosterKota = useMemo(
    () => snapshot.roster.filter((r) => cities.includes(r.city)),
    [snapshot.roster, cities]
  );
  const rosterAktif = rosterKota.filter((r) => r.status !== 'nonaktif');

  const perKota = useMemo(() => {
    const peta = new Map<string, RosterRow[]>();
    for (const r of snapshot.roster) {
      if (r.status === 'nonaktif') continue;
      if (!peta.has(r.city)) peta.set(r.city, []);
      peta.get(r.city)!.push(r);
    }
    return peta;
  }, [snapshot.roster]);

  const profilKota = snapshot.profiles.filter((p) => cities.includes(p.city));
  const belumLengkap = cities.reduce((t, k) => t + (snapshot.profilePendingByCity[k] ?? 0), 0);

  function exportExcel() {
    // Ekspor memuat seluruh baris daerah yang sedang dipilih, bukan halaman
    // tabelnya: berkas berisi sepuluh baris dari seratus peserta tidak dapat
    // dipakai untuk apa pun.
    //
    // The export carries every row of the selected region rather than the table's
    // page: a file holding ten of a hundred participants is no use for anything.
    const wb = XLSX.utils.book_new();
    for (const kota of cities) {
      const baris = snapshot.roster.filter((r) => r.city === kota);
      if (baris.length === 0) continue;
      const rows = baris.map((r, i) => ({
        No: i + 1,
        'Nama peserta': r.studentName,
        Jurusan: r.programName,
        Daerah: r.city,
        ...Object.fromEntries(
          snapshot.sessionLabels.map((label, j) => [
            `Pertemuan ${j + 1}`,
            r.attendance[j] === null ? '' : r.attendance[j] ? 'Hadir' : 'Tidak hadir',
          ])
        ),
        'Kehadiran (%)': r.attendanceRate,
        Mentoring: `${r.mentoringUsed}/2`,
        'Pre test': r.pretest ?? '',
        ...Object.fromEntries(snapshot.quizLabels.map((_, j) => [`Kuis ${j + 1}`, r.quizScores[j] ?? ''])),
        ...Object.fromEntries(
          snapshot.taskLabels.map((_, j) => [
            `Tugas ${j + 1}`,
            r.taskScores[j] ?? (r.taskSubmitted[j] === false ? 'Tidak mengumpulkan' : ''),
          ])
        ),
        'Post test': r.posttest ?? '',
        Capstone: r.capstone ?? '',
        Status: r.status,
        Catatan: r.note,
        'Tindak lanjut': r.followUp,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), kota.slice(0, 31));
    }
    XLSX.writeFile(wb, `FutureMakers_${city === 'Semua' ? 'Semua_Daerah' : city.replace(/\s/g, '_')}.xlsx`);
  }

  const sesiBerjalan = snapshot.sessionLabels.filter((_, i) =>
    rosterAktif.some((r) => r.attendance[i] !== null)
  ).length;

  return (
    <AppShell role="admin" userName="Administrator">
      <div className={s.wrap}>
        <header className={s.header}>
          <div>
            <p className={s.eyebrow}>Bootcamp Future Innovators</p>
            <h1 className={s.title}>
              {satuDaerah ? `Dashboard ${city}` : `Dashboard umum ${allCities.length} daerah`}
            </h1>
          </div>

          <div className={s.hdrActions}>
            <div className={s.seg} role="group" aria-label="Filter daerah">
              {['Semua', ...allCities].map((k) => (
                <button key={k} type="button" aria-pressed={city === k} onClick={() => onCity(k)}>
                  {k === 'Semua' ? 'Semua daerah' : k}
                </button>
              ))}
            </div>
            <button type="button" className={s.headerBtn} onClick={exportExcel}>
              <Download size={13} strokeWidth={2} /> Unduh Excel
            </button>
            <button type="button" className={s.headerBtn} onClick={() => onReload(true)} disabled={refreshing}>
              <RefreshCw size={13} strokeWidth={2} />
              {refreshing ? 'Menghitung...' : 'Hitung Ulang'}
            </button>
            {/* Waktu penghitungannya tetap disebut. Angka yang terlihat seperti
                waktu nyata padahal berumur satu jam membuat admin menarik
                kesimpulan dari keadaan yang sudah berubah.

                The computation time is still stated. Figures that look live while
                being an hour old have an admin draw conclusions from a state that
                has already changed. */}
            <p className={s.generated}>
              Dihitung {formatDateTimeWib(snapshot.generatedAt)} WIB oleh {snapshot.generatedBy}
            </p>
          </div>
        </header>

        {error && (
          <div role="alert" style={{ fontSize: '12px', color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)', padding: '10px 12px', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        {/* --- fase program -------------------------------------------------- */}
        <section className={s.panel} aria-labelledby="h-fase" style={{ gap: '12px' }}>
          <div className={s.panelHead}>
            <h2 id="h-fase">Fase program</h2>
            <p className={s.hint}>{snapshot.phaseCaption}</p>
          </div>
          <div className={s.scroll}>
            <div className={s.tl}>
              {snapshot.phases.map((f) => (
                <div
                  key={f.name}
                  className={`${s.ph} ${f.status === 'selesai' ? s.done : ''} ${f.status === 'berjalan' ? s.now : ''}`}
                >
                  {f.status === 'berjalan' && <span className={s.tag}>Sekarang</span>}
                  <p className={s.n}>{f.name}</p>
                  <p className={s.d}>{f.range}</p>
                  {f.progress !== null && f.status === 'berjalan' && (
                    <div className={s.prog}>
                      <i style={{ width: `${f.progress}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --- status peserta ------------------------------------------------ */}
        <section className={s.panel} aria-labelledby="h-status">
          <div className={s.panelHead}>
            <h2 id="h-status">Status peserta</h2>
            <p className={s.hint}>Aktif dan drop out dihitung dari total terdaftar</p>
          </div>
          <div className={s.kpis}>
            <div className={s.kpi}>
              <p className={s.l}>Terdaftar</p>
              <p className={s.v}>{terdaftar}</p>
              <p className={s.s}>
                {satuDaerah
                  ? kelasTerpilih.map((c) => c.programName || c.className).join(', ')
                  : kelasTerpilih.map((c) => `${singkatan(c.city)} ${c.registered}`).join(', ')}
              </p>
            </div>
            <div className={s.kpi}>
              <p className={s.l}>Aktif</p>
              <p className={s.v}>{aktif}</p>
              <p className={`${s.s} ${s.sGood}`}>{100 - dropRate}% dari terdaftar</p>
            </div>
            <div className={s.kpi}>
              <p className={s.l}>Drop out</p>
              <p className={s.v}>{keluar}</p>
              <p className={`${s.s} ${dropRate >= 15 ? s.sBad : ''}`}>{dropRate}% drop rate</p>
            </div>
          </div>

          <div>
            <p className={s.sub}>Komposisi peserta per daerah</p>
            <div className={s.bars}>
              {kelasTerpilih.map((c) => {
                const total = c.registered || 1;
                const d = Math.round((c.droppedOut / total) * 100);
                return (
                  <div key={c.classId} className={s.row}>
                    <span title={c.className}>{c.city}</span>
                    <div className={s.stack}>
                      <div className={s.segOk} style={{ width: `${(c.active / total) * 100}%` }}>
                        {c.active} aktif
                      </div>
                      {c.droppedOut > 0 && (
                        <div className={s.segBad} style={{ width: `${(c.droppedOut / total) * 100}%` }}>
                          {c.droppedOut}
                        </div>
                      )}
                    </div>
                    <span className={s.num} style={{ fontSize: '12px', color: d >= 15 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                      drop {d}%
                    </span>
                  </div>
                );
              })}
            </div>
            <div className={s.legend}>
              <span><span className={`${s.sw} ${s.swOk}`} />Aktif</span>
              <span><span className={`${s.sw} ${s.swBad}`} />Drop out</span>
              <span>Label merah: drop rate 15% ke atas</span>
            </div>
          </div>
        </section>

        {/* --- profil peserta ------------------------------------------------ */}
        <ProfilePanel profiles={profilKota} pending={belumLengkap} />

        {/* --- kehadiran ---------------------------------------------------- */}
        <section className={s.panel} aria-labelledby="h-hadir">
          <div className={s.panelHead}>
            <h2 id="h-hadir">Kehadiran per pertemuan</h2>
            <p className={s.hint}>Persentase peserta aktif yang hadir di tiap pertemuan</p>
          </div>
          <Heatmap
            cities={cities}
            columnLabel="Day"
            columns={snapshot.sessionLabels}
            valueFor={(kota, i) => {
              const baris = perKota.get(kota) ?? [];
              // Pertemuan yang belum berjalan dibedakan dari pertemuan tanpa
              // kehadiran: yang pertama belum terjadi, yang kedua kegagalan.
              //
              // A meeting not yet held differs from one with no attendance: the
              // first has not happened, the second is a failure.
              const terhitung = baris.filter((r) => r.attendance[i] !== null);
              if (terhitung.length === 0) return null;
              return { hit: terhitung.filter((r) => r.attendance[i] === true).length, total: terhitung.length };
            }}
          />
          <div className={s.legend}>
            <span><span className={`${s.sw} ${s.ok}`} />85% ke atas</span>
            <span><span className={`${s.sw} ${s.wr}`} />70 sampai 84%</span>
            <span><span className={`${s.sw} ${s.bd}`} />di bawah 70%</span>
            <span><span className={`${s.sw} ${s.na}`} />belum berjalan</span>
          </div>
        </section>

        {/* --- learning analytics ------------------------------------------- */}
        <section className={s.panel} aria-labelledby="h-la">
          <div className={s.panelHead}>
            <h2 id="h-la">Learning Analytics</h2>
            <p className={s.hint}>Pengumpulan tugas, nilai tugas, kuis formatif, dan learning gain</p>
          </div>

          <div className={s.laGrid}>
            <div className={`${s.box} ${s.laItem}`} role="group" aria-labelledby="h-tugas">
              <div className={s.panelHead}>
                <h3 id="h-tugas">Tugas terkumpul per tugas</h3>
              </div>
              <p className={s.hint}>Dihitung dari peserta aktif</p>
              <Heatmap
                cities={cities}
                columnLabel="Tugas"
                columns={snapshot.taskLabels}
                valueFor={(kota, i) => {
                  const baris = perKota.get(kota) ?? [];
                  const terbuka = baris.filter((r) => r.taskSubmitted[i] !== null);
                  if (terbuka.length === 0) return null;
                  return { hit: terbuka.filter((r) => r.taskSubmitted[i] === true).length, total: terbuka.length };
                }}
              />
              <div className={s.legend}>
                <span><span className={`${s.sw} ${s.ok}`} />85% ke atas</span>
                <span><span className={`${s.sw} ${s.wr}`} />70 sampai 84%</span>
                <span><span className={`${s.sw} ${s.bd}`} />di bawah 70%</span>
                <span><span className={`${s.sw} ${s.na}`} />belum dibuka</span>
              </div>
            </div>

            <div className={`${s.box} ${s.laItem}`} role="group" aria-labelledby="h-nilai">
              <div className={s.panelHead}>
                <h3 id="h-nilai">Nilai tugas</h3>
              </div>
              <p className={s.hint}>Rata-rata nilai per tugas, garis merah adalah standar 70</p>
              <GroupedBars
                cities={cities}
                columns={snapshot.taskLabels}
                columnLabel="Tugas"
                reference={{ value: 70, label: 'Standar 70' }}
                valueFor={(kota, i) => rata((perKota.get(kota) ?? []).map((r) => r.taskScores[i]))}
              />
              <CityLegend cities={cities} />
            </div>

            <div className={`${s.box} ${s.laItem}`} role="group" aria-labelledby="h-kuis">
              <div className={s.panelHead}>
                <h3 id="h-kuis">Kuis formatif per sesi</h3>
              </div>
              <p className={s.hint}>Rata-rata nilai kuis akhir sesi, garis putus-putus adalah KKM 70</p>
              <TrendLines
                cities={cities}
                columns={snapshot.quizLabels}
                reference={{ value: 70, label: 'KKM 70' }}
                valueFor={(kota, i) => rata((perKota.get(kota) ?? []).map((r) => r.quizScores[i]))}
              />
              <CityLegend cities={cities} />
            </div>

            <div className={`${s.box} ${s.laItem}`} role="group" aria-labelledby="h-gain">
              <div className={s.panelHead}>
                <h3 id="h-gain">Learning gain</h3>
              </div>
              <p className={s.hint}>Rata-rata pretest dan postest, label hijau adalah kenaikan poin</p>
              <GainChart
                rows={cities.map((kota) => {
                  const baris = perKota.get(kota) ?? [];
                  return {
                    className: kota,
                    pretest: rata(baris.map((r) => r.pretest)),
                    posttest: rata(baris.map((r) => r.posttest)),
                  };
                })}
              />
              <div className={s.legend}>
                <span><span className={s.sw} style={{ background: '#bfd6ec' }} />Pretest</span>
                <span><span className={s.sw} style={{ background: 'var(--color-primary)' }} />Post test</span>
              </div>
            </div>

            <div className={`${s.box} ${s.laItem} ${s.laWide}`} role="group" aria-labelledby="h-login">
              <div className={s.panelHead}>
                <h3 id="h-login">Aktivitas login LMS</h3>
                {/* Bahwa ini dihitung sekali per hari disebut: admin yang
                    menyangka angkanya jumlah pembukaan akan menyimpulkan
                    pemakaian yang jauh lebih rendah dari kenyataannya.

                    That this counts once a day is stated: an admin who reads the
                    figure as a number of opens would conclude usage far lower than
                    it is. */}
                <p className={s.hint}>
                  Dari {rosterAktif.length} peserta aktif. Dihitung sekali per peserta per hari, bukan tiap kali membuka
                </p>
              </div>
              <DailyBars
                total={rosterAktif.length}
                points={snapshot.logins.map((l) => ({
                  date: l.date,
                  value: cities.reduce((t, k) => t + (l.byCity[k] ?? 0), 0),
                }))}
              />
            </div>

            <div className={`${s.box} ${s.laItem} ${s.laWide}`} role="group" aria-labelledby="h-mentor">
              <div className={s.panelHead}>
                <h3 id="h-mentor">Mentoring</h3>
                <p className={`${s.hint} ${s.num}`}>
                  Jatah terpakai {rosterAktif.reduce((t, r) => t + Math.min(2, r.mentoringUsed), 0)} dari{' '}
                  {rosterAktif.length * 2} sesi (2 sesi per peserta aktif)
                </p>
              </div>
              <div className={s.bars}>
                {cities.map((kota) => {
                  const baris = perKota.get(kota) ?? [];
                  const total = baris.length || 1;
                  const belum = baris.filter((r) => r.mentoringUsed <= 0).length;
                  const sekali = baris.filter((r) => r.mentoringUsed === 1).length;
                  const duaKali = baris.filter((r) => r.mentoringUsed >= 2).length;
                  return (
                    <div key={kota} className={s.row}>
                      <span>{kota}</span>
                      <div className={s.stack}>
                        {belum > 0 && <div className={s.bd} style={{ width: `${(belum / total) * 100}%`, justifyContent: 'center' }}>{belum}</div>}
                        {sekali > 0 && <div className={s.ok} style={{ width: `${(sekali / total) * 100}%`, justifyContent: 'center' }}>{sekali}</div>}
                        {duaKali > 0 && (
                          <div style={{ width: `${(duaKali / total) * 100}%`, justifyContent: 'center', background: 'var(--color-primary)', color: '#ffffff' }}>
                            {duaKali}
                          </div>
                        )}
                      </div>
                      <span className={s.num} style={{ fontSize: '12px', color: belum / total >= 0.3 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                        {Math.round((belum / total) * 100)}% belum
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className={s.legend}>
                <span><span className={`${s.sw} ${s.bd}`} />Belum mentoring</span>
                <span><span className={`${s.sw} ${s.ok}`} />1 sesi</span>
                <span><span className={s.sw} style={{ background: 'var(--color-primary)' }} />2 sesi, jatah habis</span>
              </div>
            </div>
          </div>
        </section>

        {/* --- daftar peserta, hanya saat satu daerah dipilih ---------------- */}
        {/* Tabelnya memuat dua puluh kolom per peserta; seratus baris dari empat
            daerah sekaligus tidak dapat ditelusuri, dan pemilihan daerah adalah
            cara menyaringnya.

            The table carries twenty columns per participant; a hundred rows from
            four regions at once cannot be scanned, and picking a region is how it
            narrows. */}
        {satuDaerah && (
          <section className={s.panel} aria-labelledby="h-peserta">
            <div className={s.panelHead}>
              <h2 id="h-peserta">Daftar peserta</h2>
              <p className={s.hint}>
                {rosterKota.length} peserta {city}, {sesiBerjalan} dari {snapshot.sessionLabels.length} pertemuan sudah berjalan
              </p>
            </div>
            <RosterTable snapshot={snapshot} rows={rosterKota} onNoteSaved={() => onReload(true)} />
          </section>
        )}

        {/* --- peringkat ---------------------------------------------------- */}
        <section className={s.panel} aria-labelledby="h-rank">
          <div className={s.panelHead}>
            <h2 id="h-rank">Performance ranking</h2>
            <p className={s.hint}>
              Rata-rata kehadiran, tugas, dan kuis. Nilai akhir berbobot ada di menu Nilai Akhir
            </p>
          </div>
          {satuDaerah ? (
            <RankTable rows={snapshot.ranking.filter((r) => r.city === city)} />
          ) : (
            <div className={s.rk4}>
              {cities.map((kota) => {
                const baris = snapshot.ranking.filter((r) => r.city === kota);
                const kelas = snapshot.classes.find((c) => c.city === kota);
                return (
                  <div key={kota} className={s.rkbox}>
                    <h3>
                      {kota}
                      {kelas && <small>{kelas.className}</small>}
                    </h3>
                    <div>
                      {baris.slice(0, 5).map((r, i) => (
                        <div key={r.studentId} className={s.rkrow}>
                          <span className={`${s.rkn} ${i < 3 ? s.top : ''}`}>{i + 1}</span>
                          <span>{r.studentName}</span>
                          <span className={s.rkscore}>{r.score}</span>
                        </div>
                      ))}
                      {baris.length === 0 && <div className={s.empty}>Belum ada data</div>}
                    </div>
                    {baris.length > 5 && (
                      <button type="button" className={s.linkbtn} onClick={() => onCity(kota)}>
                        Lihat semua {baris.length} peserta
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* --- siswa berstatus alert ---------------------------------------- */}
        <section className={s.panel} aria-labelledby="h-alert">
          <div className={s.panelHead}>
            <h2 id="h-alert">Siswa berstatus alert</h2>
            <span className={`${s.hint} ${s.num}`}>
              {snapshot.alerts.filter((a) => cities.includes(a.city)).length} siswa
            </span>
          </div>
          <AlertTable
            rows={snapshot.alerts.filter((a) => cities.includes(a.city))}
            thresholds={snapshot.thresholds}
            roster={snapshot.roster}
          />
          <div className={s.legend}>
            <span><span className={`${s.sw} ${s.bd}`} />di bawah batas</span>
            <span><span className={`${s.sw} ${s.wr}`} />mendekati batas</span>
            <span>
              Batas: kehadiran {snapshot.thresholds.attendance}%, tugas {snapshot.thresholds.task}%, kuis{' '}
              {snapshot.thresholds.quiz}
            </span>
            <span>Diurutkan dari masalah terbanyak</span>
          </div>
        </section>

        {/* --- rating kepuasan --------------------------------------------- */}
        <section className={s.panel} aria-labelledby="h-puas">
          <div className={s.panelHead}>
            <h2 id="h-puas">Rating kepuasan</h2>
            <p className={s.hint}>
              Rata-rata pertanyaan bernilai angka, beserta persentase peserta aktif yang mengisi
            </p>
          </div>
          <SurveyHeatmap snapshot={snapshot} cities={cities} />
        </section>
      </div>
    </AppShell>
  );
}

/**
 * Singkatan nama daerah untuk ubin yang sempit.
 *
 * Diturunkan dari namanya, bukan dari daftar di kode: daerah baru akan
 * tersingkat sendiri tanpa menyunting apa pun. Nama satu kata diambil tiga
 * hurufnya tanpa vokal di tengah ("Semarang" menjadi "SMG"), nama banyak kata
 * diambil huruf awalnya ("DKI Jakarta" menjadi "DKI").
 *
 * A region's abbreviation for the narrow tiles.
 *
 * Derived from the name rather than a list in code: a new region abbreviates
 * itself with nothing to edit. A one-word name takes three letters with its inner
 * vowels dropped ("Semarang" becomes "SMG"); a multi-word name takes its initials
 * ("DKI Jakarta" becomes "DKI").
 */
function singkatan(kota: string): string {
  const kata = kota.trim().split(/\s+/);
  if (kata.length > 1) return kata.map((k) => k[0]).join('').toUpperCase().slice(0, 4);
  if (kota.length <= 3) return kota.toUpperCase();
  const tanpaVokal = kota[0] + kota.slice(1).replace(/[aeiou]/gi, '');
  return (tanpaVokal.length >= 3 ? tanpaVokal : kota).toUpperCase().slice(0, 3);
}

/** Rata-rata yang mengabaikan null; null berarti belum ada yang terukur / An average ignoring nulls; null means nothing was measured yet */
function rata(xs: (number | null)[]): number | null {
  const ada = xs.filter((x): x is number => x !== null);
  if (ada.length === 0) return null;
  return Math.round(ada.reduce((a, b) => a + b, 0) / ada.length);
}

function CityLegend({ cities }: { cities: string[] }) {
  return (
    <div className={s.legend}>
      {cities.map((k) => (
        <span key={k}>
          <span className={s.sw} style={{ background: cityColor(cities, k) }} />
          {k}
        </span>
      ))}
    </div>
  );
}

/** Palet sebaran: kategorinya netral, sehingga tidak memakai warna peringatan / The distribution palette: these categories are neutral, so no alert colours */
const SEBARAN = ['var(--color-primary)', 'var(--color-text-main)'];

type ProfileLite = { gender: string; disability: string; entryStatus: string; age: number | null };

function ProfilePanel({ profiles, pending }: { profiles: ProfileLite[]; pending: number }) {
  if (profiles.length === 0) {
    return (
      <section className={s.panel} aria-labelledby="h-profil">
        <div className={s.panelHead}>
          <h2 id="h-profil">Profil peserta</h2>
        </div>
        <div className={s.empty}>
          Belum ada peserta yang melengkapi profilnya
          {pending > 0 ? `. ${pending} peserta akan diminta melengkapi saat membuka aplikasi` : ''}
        </div>
      </section>
    );
  }

  const hitung = (ambil: (p: ProfileLite) => string) => {
    const peta = new Map<string, number>();
    for (const p of profiles) peta.set(ambil(p), (peta.get(ambil(p)) ?? 0) + 1);
    return [...peta.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  };

  const gender = hitung((p) => p.gender);
  const status = hitung((p) => p.entryStatus);
  const disabilitas = hitung((p) => p.disability);
  const usia = profiles.map((p) => p.age).filter((a): a is number => a !== null);

  const terbanyak = gender[0];
  // "Tidak ada" bukan disabilitas: menjumlahkannya ke dalam hitungan peserta
  // disabilitas membuat angkanya menjadi seluruh peserta.
  //
  // "Tidak ada" is not a disability: adding it to the disability count would make
  // the figure the entire cohort.
  const denganDisabilitas = disabilitas.filter((d) => d.label !== 'Tidak ada');
  const jumlahDisabilitas = denganDisabilitas.reduce((t, d) => t + d.count, 0);

  const kelompokUsia: Record<string, number> = { '17-19': 0, '20-22': 0, '23-25': 0, '26 ke atas': 0 };
  for (const a of usia) {
    if (a <= 19) kelompokUsia['17-19'] += 1;
    else if (a <= 22) kelompokUsia['20-22'] += 1;
    else if (a <= 25) kelompokUsia['23-25'] += 1;
    else kelompokUsia['26 ke atas'] += 1;
  }

  return (
    <section className={s.panel} aria-labelledby="h-profil">
      <div className={s.panelHead}>
        <h2 id="h-profil">Profil peserta</h2>
        {/* Pembaginya disebut. Sebaran dari tujuh puluh peserta yang dibaca
            seolah dari seratus menuntun ke kesimpulan yang salah tentang
            angkatannya.

            The denominator is stated. A distribution over seventy participants
            read as if over a hundred leads to the wrong conclusion about the
            cohort. */}
        <p className={s.hint}>
          Dari {profiles.length} peserta yang sudah melengkapi profilnya
          {pending > 0 ? `, ${pending} belum` : ''}
        </p>
      </div>

      <div className={s.profile}>
        <div className={s.kpi}>
          <p className={s.l}>Jenis kelamin</p>
          <p className={s.v}>
            {Math.round((terbanyak.count / profiles.length) * 100)}% <small>{terbanyak.label.toLowerCase()}</small>
          </p>
          <p className={s.s}>{gender.map((g) => `${g.label} ${g.count}`).join(', ')}</p>
        </div>
        <div className={s.kpi}>
          <p className={s.l}>Peserta disabilitas</p>
          <p className={s.v}>
            {jumlahDisabilitas} <small>({Math.round((jumlahDisabilitas / profiles.length) * 100)}%)</small>
          </p>
          <p className={s.s}>
            {denganDisabilitas.length === 0
              ? 'Tidak ada yang melaporkan disabilitas'
              : denganDisabilitas.map((d) => `${d.label} ${d.count}`).join(', ')}
          </p>
        </div>
        <div className={s.kpi}>
          <p className={s.l}>Usia rata-rata</p>
          <p className={s.v}>
            {usia.length === 0 ? '-' : Math.round(usia.reduce((a, b) => a + b, 0) / usia.length)} <small>tahun</small>
          </p>
          <p className={s.s}>
            {usia.length === 0
              ? 'Belum ada tanggal lahir yang terbaca'
              : `Termuda ${Math.min(...usia)}, tertua ${Math.max(...usia)}`}
          </p>
        </div>
      </div>

      <div className={s.two}>
        <div className={s.box}>
          <p className={s.sub}>Sebaran usia</p>
          <ProfileBars
            rows={Object.entries(kelompokUsia).filter(([, v]) => v > 0).map(([label, count]) => ({ label, count }))}
            total={usia.length}
            color={SEBARAN[0]}
          />
        </div>
        <div className={s.box}>
          <p className={s.sub}>Status saat mendaftar</p>
          <ProfileBars rows={status} total={profiles.length} color={SEBARAN[1]} />
        </div>
      </div>
    </section>
  );
}

function RankTable({ rows }: { rows: { studentId: string; studentName: string; score: number }[] }) {
  if (rows.length === 0) return <div className={s.empty}>Belum ada data</div>;
  return (
    <div className={s.scroll}>
      <table className={s.table} style={{ minWidth: '420px' }}>
        <thead>
          <tr>
            <th className={s.ctr} style={{ width: '64px' }}>Peringkat</th>
            <th>Nama siswa</th>
            <th className={s.ctr}>Skor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.studentId}>
              <td className={s.ctr}>
                <span className={`${s.rkn} ${i < 3 ? s.top : ''}`}>{i + 1}</span>
              </td>
              <td>{r.studentName}</td>
              <td className={`${s.ctr} ${s.num}`} style={{ fontWeight: 600 }}>{r.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertTable({
  rows,
  thresholds,
  roster,
}: {
  rows: {
    studentId: string;
    studentName: string;
    className: string;
    city: string;
    attendanceRate: number;
    taskRate: number;
    quizAverage: number;
  }[];
  thresholds: { attendance: number; task: number; quiz: number };
  roster: RosterRow[];
}) {
  if (rows.length === 0) {
    return (
      <div style={{ fontSize: '12px', color: 'var(--color-success)', fontWeight: 600 }}>
        Tidak ada peserta di bawah ambang.
      </div>
    );
  }

  const jurusan = new Map(roster.map((r) => [r.studentId, r.programName]));
  const kelas = (v: number, batas: number) => (v < batas ? s.bd : v < batas + 10 ? s.wr : s.pillOk);

  return (
    <div className={s.scroll}>
      <table className={s.table} style={{ minWidth: '640px' }}>
        <thead>
          <tr>
            <th className={s.ctr} style={{ width: '44px' }}>No</th>
            <th>Nama siswa</th>
            <th>Jurusan</th>
            <th>Daerah</th>
            <th className={s.ctr}>Kehadiran</th>
            <th className={s.ctr}>Tugas</th>
            <th className={s.ctr}>Kuis</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a, i) => (
            <tr key={a.studentId}>
              <td className={`${s.ctr} ${s.num}`}>{i + 1}</td>
              <td>{a.studentName}</td>
              <td style={{ color: 'var(--color-text-muted)' }}>{jurusan.get(a.studentId) || a.className}</td>
              <td>{a.city}</td>
              <td className={s.ctr}><span className={`${s.pill} ${kelas(a.attendanceRate, thresholds.attendance)}`}>{a.attendanceRate}%</span></td>
              <td className={s.ctr}><span className={`${s.pill} ${kelas(a.taskRate, thresholds.task)}`}>{a.taskRate}%</span></td>
              <td className={s.ctr}><span className={`${s.pill} ${kelas(a.quizAverage, thresholds.quiz)}`}>{a.quizAverage}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SurveyHeatmap({ snapshot, cities }: { snapshot: DashboardSnapshot; cities: string[] }) {
  if (snapshot.surveyQuestions.length === 0) {
    return <div className={s.empty}>Belum ada jawaban survei bernilai angka</div>;
  }

  // Lima pertanyaan pertama ditampilkan; dua puluh empat kolom tidak dapat
  // dibaca berdampingan, dan rinciannya ada di halaman survei.
  //
  // The first five questions are shown; twenty-four columns cannot be read side
  // by side, and the detail lives on the survey page.
  const pertanyaan = snapshot.surveyQuestions.slice(0, 5);
  const kelas = (v: number) => (v >= 4.2 ? s.ok : v >= 3.5 ? s.wr : s.bd);
  const f = (v: number) => v.toFixed(1).replace('.', ',');
  const baris = cities.length > 1 ? [...cities, 'Semua'] : cities;

  const rataKota = (kota: string, q: (typeof pertanyaan)[number]): number | null => {
    if (kota !== 'Semua') return q.byCity[kota] ?? null;
    const ada = cities.map((k) => q.byCity[k]).filter((v): v is number => v !== null && v !== undefined);
    return ada.length === 0 ? null : ada.reduce((a, b) => a + b, 0) / ada.length;
  };

  const responsKota = (kota: string): number => {
    const dipakai = kota === 'Semua' ? cities : [kota];
    const nilai = dipakai.flatMap((k) => snapshot.surveys.map((x) => x.byCity[k]?.responseRate ?? 0));
    return nilai.length === 0 ? 0 : Math.round(nilai.reduce((a, b) => a + b, 0) / nilai.length);
  };

  return (
    <>
      <div className={s.scroll}>
        <div
          className={s.hm}
          style={{ gridTemplateColumns: `90px repeat(${pertanyaan.length}, minmax(0, 1fr)) 72px`, minWidth: '560px' }}
        >
          <div />
          {pertanyaan.map((q) => (
            <div key={q.label} className={s.h} title={q.label}>
              {q.label.length > 14 ? `${q.label.slice(0, 13)}…` : q.label}
            </div>
          ))}
          <div className={s.h}>Respons</div>

          {baris.map((kota) => (
            <React.Fragment key={kota}>
              <div className={s.lb} style={kota === 'Semua' ? { fontWeight: 600 } : undefined}>{kota}</div>
              {pertanyaan.map((q) => {
                const v = rataKota(kota, q);
                return v === null ? (
                  <div key={q.label} className={`${s.c} ${s.na}`} title={`${kota}: ${q.label} belum dijawab`}>·</div>
                ) : (
                  <div key={q.label} className={`${s.c} ${kelas(v)}`} title={`${kota}: ${q.label}`}>{f(v)}</div>
                );
              })}
              <div className={`${s.lb} ${s.num}`} style={{ justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                {responsKota(kota)}%
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className={s.legend}>
        <span><span className={`${s.sw} ${s.ok}`} />4,2 ke atas</span>
        <span><span className={`${s.sw} ${s.wr}`} />3,5 sampai 4,1</span>
        <span><span className={`${s.sw} ${s.bd}`} />di bawah 3,5</span>
      </div>
    </>
  );
}
