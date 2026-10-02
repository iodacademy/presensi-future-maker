// Penyajian waktu dalam zona WIB / Time presentation in the WIB zone

/**
 * Seluruh stempel waktu disimpan sebagai ISO UTC, sedangkan program berjalan
 * di WIB. Memotong string ISO dengan slice(11, 16) menampilkan jam UTC apa
 * adanya -- tujuh jam meleset dari jam yang dilihat peserta saat memindai.
 *
 * Every timestamp is stored as ISO UTC while the programme runs in WIB.
 * Slicing an ISO string with slice(11, 16) shows the raw UTC hour -- seven
 * hours off from the clock a participant read while scanning.
 */
const WIB = 'Asia/Jakarta';

/**
 * Mengembalikan jam dan menit dalam WIB, misalnya "21:05".
 *
 * Mengembalikan '-' untuk nilai kosong atau tidak terbaca, sebab stempel waktu
 * yang rusak tidak seharusnya menggagalkan seluruh baris pada daftar hadir.
 *
 * Returns hour and minute in WIB, e.g. "21:05".
 *
 * Returns '-' for an empty or unreadable value, since one broken timestamp
 * should not take down an entire attendance row.
 */
export function formatTimeWib(isoString: string | null | undefined): string {
  if (!isoString) return '-';

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';

  // hourCycle h23 memaksa 00-23; tanpa itu Intl dapat menghasilkan "24:05"
  // pada tengah malam untuk sebagian lokal.
  //
  // hourCycle h23 forces 00-23; without it Intl can produce "24:05" at
  // midnight in some locales.
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: WIB,
  }).format(date);
}

/**
 * Mengembalikan tanggal dan jam dalam WIB, misalnya "24 Sep 2026, 21:05".
 *
 * Returns date and time in WIB, e.g. "24 Sep 2026, 21:05".
 */
export function formatDateTimeWib(isoString: string | null | undefined): string {
  if (!isoString) return '-';

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: WIB,
  }).format(date);
}

/**
 * Mengembalikan tanggal dalam WIB, misalnya "3 Okt 2026".
 *
 * Memotong string ISO dengan slice(0, 10) menampilkan tanggal UTC: pengumpulan
 * pukul 06.30 WIB tersimpan sebagai 23.30 UTC hari sebelumnya, sehingga
 * tanggalnya mundur satu hari dan dapat mengubah penilaian terlambat.
 *
 * Returns the date in WIB, e.g. "3 Okt 2026".
 *
 * Slicing an ISO string with slice(0, 10) shows the UTC date: a submission at
 * 06:30 WIB is stored as 23:30 UTC on the previous day, so the date slips back
 * one and can flip a late/on-time judgement.
 */
export function formatDateWib(isoString: string | null | undefined): string {
  if (!isoString) return '-';

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: WIB,
  }).format(date);
}

/**
 * Tanggal WIB hari ini dalam bentuk "YYYY-MM-DD".
 *
 * Dipakai sebagai id dokumen harian, sehingga batas harinya mengikuti hari
 * peserta, bukan UTC: tanpa ini, pembukaan aplikasi pukul tujuh pagi WIB
 * tercatat pada tanggal sebelumnya.
 *
 * Today's WIB date as "YYYY-MM-DD".
 *
 * Used as a daily document id, so the day boundary follows the participant's day
 * rather than UTC: without this, opening the app at seven in the morning WIB
 * would be recorded under the previous date.
 */
export function wibDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(now);
}
