import { getAdminDb } from '@/lib/firebase/admin';
import { wibDate } from '@/lib/time';

/**
 * Mencatat bahwa seorang peserta membuka aplikasi hari ini.
 *
 * Satu dokumen per peserta per tanggal WIB, bukan satu per pembukaan: seratus
 * peserta membuka aplikasi sekitar lima belas kali sehari, dan mencatat tiap
 * pembukaan berarti seribu lima ratus tulis sehari -- hampir sepersepuluh
 * kuota gratis untuk satu grafik. Yang dijawab grafiknya adalah "berapa peserta
 * aktif tiap hari", dan itu tidak menuntut tahu berapa kali tiap orang membuka.
 *
 * Records that a participant opened the app today.
 *
 * One document per participant per WIB date rather than one per open: a hundred
 * participants open the app around fifteen times a day, and recording each open
 * would mean fifteen hundred writes a day -- nearly a tenth of the free quota
 * for one chart. What the chart answers is "how many participants were active
 * each day", which does not require knowing how often each person opened it.
 */

// Apa yang sudah ditulis proses ini diingat, sehingga pembukaan kedua pada hari
// yang sama tidak menulis lagi. Cloud Run menjalankan beberapa contoh, jadi
// ini mengurangi penulisan, bukan menghapusnya -- dan itu cukup: tulis kedua
// atas dokumen yang sama hanya menimpa nilai yang identik.
//
// What this process has written is remembered, so a second open on the same day
// writes nothing. Cloud Run runs several instances, so this reduces writes
// rather than eliminating them -- which is enough: a second write to the same
// document merely overwrites an identical value.
const sudahDitulis = new Set<string>();

export async function recordDailyLogin(uid: string): Promise<void> {
  const tanggal = wibDate();
  const id = `${uid}_${tanggal}`;
  if (sudahDitulis.has(id)) return;

  // Ditandai lebih dulu, bukan setelah berhasil: kegagalan menulis pada
  // pembukaan ini tidak layak dicoba ulang pada tiap pembukaan berikutnya hari
  // ini, dan catatan kehadiran di LMS bukan data yang hilangnya merugikan.
  //
  // Marked before the write rather than after: a failure here does not deserve
  // retrying on every later open today, and an LMS presence record is not data
  // whose loss costs anything.
  sudahDitulis.add(id);

  try {
    await getAdminDb().collection('lmsLogins').doc(id).set({ uid, date: tanggal });
  } catch {
    // Catatan ini tidak boleh menghalangi halamannya terbuka. Peserta yang
    // gagal membuka aplikasi karena grafik admin adalah pertukaran yang salah
    // arah.
    //
    // This record must never stop the page from opening. A participant unable to
    // use the app because of an admin's chart is the wrong trade.
  }
}

/** Dipakai pengujian untuk melupakan apa yang sudah ditulis / Used by tests to forget what was written */
export function resetDailyLoginCache(): void {
  sudahDitulis.clear();
}
