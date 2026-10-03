import type { PhasePoint } from './snapshot-types';

/**
 * Fase program setelah bootcamp, beserta tanggalnya.
 *
 * Ditulis di sini karena belum ada tempat untuk mengisinya. Tanggalnya diubah
 * dengan menyunting berkas ini lalu menerbitkan ulang -- bila jadwalnya mulai
 * sering bergeser, pindahkan ke Pengaturan agar admin dapat mengubahnya sendiri.
 *
 * ponytail: tanggal tetap di kode, pindahkan ke Pengaturan bila jadwalnya mulai
 * sering bergeser
 *
 * The programme phases after the bootcamp, with their dates.
 *
 * Written here because there is nowhere to enter them yet. Changing a date means
 * editing this file and redeploying -- if the schedule starts shifting often,
 * move this into Settings so an admin can change it themselves.
 */
export const PHASES_AFTER_BOOTCAMP: { name: string; start: string; end: string | null; range: string }[] = [
  { name: 'Capstone', start: '2026-10-06', end: '2026-10-12', range: '6 sampai 12 Okt' },
  { name: 'Showcase', start: '2026-10-14', end: '2026-10-14', range: '14 Okt' },
  { name: 'Magang', start: '2026-10-19', end: '2027-01-31', range: '19 Okt sampai Jan 2027' },
  { name: 'Pendampingan kerja', start: '2027-02-01', end: null, range: 'Setelah magang' },
];

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_PANJANG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** "2026-09-14" menjadi "14 Sep" / "2026-09-14" becomes "14 Sep" */
export function tanggalSingkat(iso: string): string {
  const [, b, h] = iso.split('-');
  return `${Number(h)} ${BULAN[Number(b) - 1] ?? ''}`;
}

/**
 * Menyusun fase program dari jadwal sesi yang sudah ada.
 *
 * Onboarding dan bootcamp diturunkan dari sesinya, bukan ditulis: tanggal yang
 * ditulis terpisah akan menyimpang dari jadwal sebenarnya begitu satu pertemuan
 * digeser, dan panel ini akan menyebut minggu yang berbeda dari yang dilihat
 * peserta di jadwalnya.
 *
 * Builds the programme phases from the existing session schedule.
 *
 * Onboarding and the bootcamp derive from the sessions rather than being written
 * down: separately written dates would drift from the real schedule the moment
 * one meeting moves, and this panel would name a different week from the one
 * participants see in their own schedule.
 */
/**
 * Keterangan di sebelah judul fase.
 *
 * Minggunya dihitung dari pertemuan pertama bootcamp, bukan dari tanggal
 * kalender: bootcamp yang mulai hari Senin dan bootcamp yang mulai hari Kamis
 * akan menghitung minggu yang berbeda bila diukur dari pergantian pekan.
 *
 * The caption beside the phase heading.
 *
 * The week counts from the bootcamp's first meeting rather than the calendar: a
 * bootcamp starting on a Monday and one starting on a Thursday would count
 * different weeks if measured from week boundaries.
 */
export function keteranganFase(sessions: { date: string }[], nowIso: string): string {
  const hariIni = nowIso.slice(0, 10);
  const per = `Per ${tanggalPanjang(hariIni)}`;
  if (sessions.length < 2) return per;

  const tanggal = sessions.map((s) => s.date).sort();
  const mulai = tanggal[1];
  const akhir = tanggal[tanggal.length - 1];

  const minggu = (dari: string, sampai: string) =>
    Math.floor((Date.parse(`${sampai}T00:00:00Z`) - Date.parse(`${dari}T00:00:00Z`)) / (7 * 86400000)) + 1;

  if (hariIni < mulai) return `${per}: bootcamp mulai ${tanggalSingkat(mulai)}`;
  if (hariIni > akhir) return `${per}: bootcamp selesai ${tanggalSingkat(akhir)}`;

  // Tanpa pembatas: cabang ini hanya berjalan saat hari ini berada di dalam
  // rentangnya, sehingga minggunya tidak pernah dapat melampaui totalnya.
  // Pembatas di sini akan menjadi kode yang tidak pernah berjalan, dan kode
  // semacam itu menyesatkan pembaca berikutnya tentang keadaan yang mungkin.
  //
  // No cap: this branch runs only while today sits inside the range, so the week
  // can never exceed the total. A cap here would be code that never runs, and such
  // code misleads the next reader about what states are possible.
  return `${per}: bootcamp minggu ke-${minggu(mulai, hariIni)} dari ${minggu(mulai, akhir)}`;
}

/** "2026-09-30" menjadi "30 September 2026" / "2026-09-30" becomes "30 September 2026" */
export function tanggalPanjang(iso: string): string {
  const [th, bl, hr] = iso.split('-');
  return `${Number(hr)} ${BULAN_PANJANG[Number(bl) - 1] ?? ''} ${th}`;
}

export function hitungFase(sessions: { date: string }[], nowIso: string): PhasePoint[] {
  const hariIni = nowIso.slice(0, 10);

  if (sessions.length === 0) {
    return PHASES_AFTER_BOOTCAMP.map((f) => ({
      name: f.name,
      range: f.range,
      status: statusDari(f.start, f.end, hariIni),
      progress: null,
    }));
  }

  const tanggal = sessions.map((s) => s.date).sort();
  // Pertemuan pertama adalah onboarding, sisanya bootcamp. Ini tebakan dari
  // bentuk jadwalnya, bukan penandaan tersimpan -- bila kelak sesi punya kolom
  // fase, bacalah dari situ.
  //
  // The first meeting is onboarding, the rest the bootcamp. This infers from the
  // schedule's shape rather than a stored marker -- if sessions later carry a
  // phase field, read it from there instead.
  const onboarding = tanggal[0];
  const mulaiBootcamp = tanggal[1] ?? tanggal[0];
  const akhirBootcamp = tanggal[tanggal.length - 1];

  const sudahBerjalan = tanggal.filter((t) => t <= hariIni && t >= mulaiBootcamp).length;
  const totalBootcamp = tanggal.filter((t) => t >= mulaiBootcamp).length;

  return [
    {
      name: 'Onboarding',
      range: tanggalSingkat(onboarding),
      status: statusDari(onboarding, onboarding, hariIni),
      progress: null,
    },
    {
      name: 'Bootcamp',
      range: `${tanggalSingkat(mulaiBootcamp)} sampai ${tanggalSingkat(akhirBootcamp)}`,
      status: statusDari(mulaiBootcamp, akhirBootcamp, hariIni),
      // Kemajuannya dihitung dari pertemuan yang sudah berjalan, bukan dari
      // hari yang sudah lewat: bootcamp tidak berjalan tiap hari, dan hitungan
      // kalender akan menunjukkan kemajuan pada hari tanpa pertemuan.
      //
      // Progress counts meetings held rather than days elapsed: the bootcamp does
      // not run daily, and a calendar count would show progress on days with no
      // meeting.
      progress: totalBootcamp === 0 ? null : Math.round((sudahBerjalan / totalBootcamp) * 100),
    },
    ...PHASES_AFTER_BOOTCAMP.map((f) => ({
      name: f.name,
      range: f.range,
      status: statusDari(f.start, f.end, hariIni),
      progress: null,
    })),
  ];
}

function statusDari(mulai: string, akhir: string | null, hariIni: string): PhasePoint['status'] {
  if (hariIni < mulai) return 'akan-datang';
  // Fase tanpa tanggal akhir tidak pernah selesai: pendampingan kerja berjalan
  // sampai ada yang menyatakannya berakhir.
  //
  // A phase with no end date never completes: job support runs until someone says
  // it has ended.
  if (akhir === null) return 'berjalan';
  return hariIni > akhir ? 'selesai' : 'berjalan';
}
