import type { CreateSessionInput, SessionMode, SessionDocument } from './types';

/**
 * Memvalidasi masukan form pembuatan sesi pertemuan.
 *
 * Validates session creation form input.
 */
export function validateSessionInput(input: CreateSessionInput): {
  classId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  mode: SessionMode;
  zoomUrl: string | null;
  address: string | null;
  mapsUrl: string | null;
} {
  const classId = input.classId ? input.classId.trim() : '';
  const title = input.title ? input.title.trim() : '';
  const date = input.date ? input.date.trim() : '';
  const startTime = input.startTime ? input.startTime.trim() : '';
  const endTime = input.endTime ? input.endTime.trim() : '';
  const mode = input.mode;
  let zoomUrl = input.zoomUrl ? input.zoomUrl.trim() : null;
  let address = input.address ? input.address.trim() : null;
  let mapsUrl = input.mapsUrl ? input.mapsUrl.trim() : null;

  if (!classId || !title || !date || !startTime || !endTime) {
    throw new Error('Semua field wajib (Judul, Tanggal, Jam) harus diisi / All required fields must be provided');
  }

  // Validasi format jam HH:mm / Validate time format
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    throw new Error('Format jam harus HH:mm (contoh 19:00) / Time format must be HH:mm');
  }

  if (endTime <= startTime) {
    throw new Error('Jam selesai harus lebih akhir dari jam mulai / End time must be after start time');
  }

  // Pola validasi HTTPS ini dipakai di beberapa tempat; lihat validateRecordingUrl
  // di bawah untuk bentuk yang dapat dipanggil ulang.
  //
  // This HTTPS validation shape recurs in several places; see
  // validateRecordingUrl below for the reusable form.
  // Tautan Zoom bersifat opsional: jadwal umumnya disusun jauh sebelum tautan
  // rapatnya terbit, dan mewajibkannya memaksa admin mengisi nilai karangan
  // yang kemudian harus dibersihkan. Bila diisi, tetap wajib HTTPS.
  //
  // The Zoom link is optional: schedules are usually drawn up well before the
  // meeting link exists, and requiring it forces admins to enter a made-up
  // value they must clean up later. When present, HTTPS is still required.
  if (mode === 'online') {
    if (zoomUrl) {
      try {
        const u = new URL(zoomUrl);
        if (u.protocol !== 'https:') throw new Error();
      } catch {
        throw new Error('Link Zoom harus berupa URL HTTPS yang valid / Zoom link must be valid HTTPS');
      }
    }
    address = null;
    mapsUrl = null;
  } else if (mode === 'offline') {
    if (!address) {
      throw new Error('Sesi Offline wajib menyertakan Alamat dan Link Maps / Offline session requires Address and Maps link');
    }
    if (mapsUrl) {
      try {
        const u = new URL(mapsUrl);
        if (u.protocol !== 'https:') throw new Error();
      } catch {
        throw new Error('Link Maps harus berupa URL HTTPS yang valid / Maps link must be valid HTTPS');
      }
    }
    zoomUrl = null;
  } else {
    throw new Error('Moda harus online atau offline / Mode must be online or offline');
  }

  return {
    classId,
    title,
    date,
    startTime,
    endTime,
    mode,
    zoomUrl,
    address,
    mapsUrl,
  };
}

/**
 * Menit presensi dibuka sebelum jam sesinya dimulai.
 *
 * Acara dimulai tepat pada jamnya, sehingga peserta sudah berdatangan setengah
 * jam sebelumnya. Tanpa jeda ini mereka menunggu di depan QR yang belum
 * berlaku, lalu memindai berbarengan tepat saat acaranya mulai.
 *
 * Minutes attendance opens before the session's start time.
 *
 * Events begin exactly on the hour, so participants arrive half an hour early.
 * Without this lead they wait in front of a QR that does not work yet, then all
 * scan at once just as the event starts.
 */
export const EARLY_OPEN_MINUTES = 30;

/**
 * Mengurangi sebuah jam "HH:mm" sebanyak sekian menit.
 *
 * Dibatasi pada 00:00: sesi pukul 00.15 dikurangi tiga puluh menit jatuh ke
 * hari sebelumnya, dan perbandingannya di bawah memakai tanggal sesi itu
 * sendiri -- jam negatif akan membuat jendelanya tidak pernah terbuka.
 *
 * Subtracts a number of minutes from an "HH:mm" time.
 *
 * Clamped at 00:00: a 00:15 session minus thirty minutes falls on the previous
 * day, and the comparison below uses that session's own date -- a negative time
 * would leave the window never opening.
 */
export function subtractMinutes(time: string, minutes: number): string {
  // Number.isNaN(undefined) bernilai false, sehingga "09" tanpa menit lolos
  // pemeriksaan dan menghasilkan "NaN:NaN". Bentuknya diperiksa lebih dulu.
  //
  // Number.isNaN(undefined) is false, so "09" with no minutes passes the check
  // and yields "NaN:NaN". The shape is checked first.
  if (!/^\d{1,2}:\d{2}$/.test(time)) return time;

  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;

  const total = Math.max(0, h * 60 + m - minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Memeriksa apakah jendela presensi sebuah sesi sedang aktif.
 *
 * Jendelanya terbuka sejak setengah jam sebelum sesinya mulai dan tertutup
 * pada jam berakhirnya. Berlaku bagi sesi luring maupun daring: keduanya
 * sama-sama dihadiri pada jam yang sama, dan membedakannya hanya membuat satu
 * di antaranya bergantung pada ingatan admin.
 *
 * Checks whether a session's attendance window is active.
 *
 * The window opens half an hour before the session starts and closes at its
 * end time. It applies to offline and online sessions alike: both are attended
 * at the same hours, and treating them differently only makes one of them
 * depend on an admin remembering.
 */
export function isAttendanceWindowActive(
  sessionDate: string,
  currentIsoOrWibString: string,
  startTime = '19:00',
  endTime = '22:00'
): boolean {
  const dateObj = new Date(currentIsoOrWibString);
  if (isNaN(dateObj.getTime())) return false;

  // Konversi ke waktu Asia/Jakarta (WIB = UTC+7) / Convert to Asia/Jakarta (WIB)
  const wibTime = new Date(dateObj.getTime() + 7 * 60 * 60 * 1000);
  const wibIso = wibTime.toISOString(); // e.g. "2026-09-10T19:15:00.000Z"
  const currentDateWIB = wibIso.slice(0, 10);
  const currentTimeWIB = wibIso.slice(11, 16); // "19:15"

  // Periksa kesamaan tanggal / Check date equality
  if (currentDateWIB !== sessionDate) {
    return false;
  }

  // Jendela mengikuti jam sesi, bukan 19.00-22.00 yang dipaku. Sesi gabungan
  // dan sesi pagi memiliki jam sendiri; rentang tetap membuat presensinya tidak
  // pernah terbuka secara otomatis, sehingga admin harus membukanya manual
  // setiap kali.
  //
  // Dibuka lebih awal karena acaranya mulai tepat pada jamnya: peserta sudah
  // berdatangan setengah jam sebelumnya dan tidak perlu menunggu di depan QR
  // yang belum berlaku.
  //
  // Perbandingan dilakukan sebagai string "HH:mm", yang urut secara leksikal
  // sama dengan urutan waktunya.
  //
  // The window follows the session's own hours rather than a fixed 19:00-22:00.
  // A merged or morning session has its own times; a fixed range would leave
  // its attendance never opening on its own, forcing an admin to open it by
  // hand every time.
  //
  // It opens early because the event starts exactly on the hour: participants
  // are already arriving half an hour before and should not wait in front of a
  // QR that does not work yet.
  //
  // The comparison runs on "HH:mm" strings, whose lexical order matches their
  // chronological order.
  const openTime = subtractMinutes(startTime, EARLY_OPEN_MINUTES);
  return currentTimeWIB >= openTime && currentTimeWIB < endTime;
}

/**
 * Menentukan apakah QR presensi sesi sedang aktif:
 * - Jika override = 'closed': selalu nonaktif (tutup manual oleh admin)
 * - Jika override = 'open': aktif (buka manual oleh admin untuk offline)
 * - Jika override = 'auto':
 *   - Terbuka 30 menit sebelum jam mulai sampai jam berakhirnya, luring maupun daring
 *
 * Determines whether session attendance QR is currently active.
 */
export function isSessionAttendanceActive(session: SessionDocument, currentIsoString: string): boolean {
  if (session.attendanceOverride === 'closed') {
    return false;
  }

  if (session.attendanceOverride === 'open') {
    return true;
  }

  // Luring dan daring memakai jendela yang sama. Sebelumnya luring tidak
  // pernah terbuka sendiri, sehingga admin yang lupa membukanya meninggalkan
  // satu kelas penuh tanpa cara mencatat kehadirannya -- dan kelalaian itu
  // baru ketahuan dari keluhan peserta di ruangan.
  //
  // Both offline and online use the same window. Offline previously never
  // opened on its own, so an admin who forgot left a whole class with no way
  // to record attendance -- and the lapse only surfaced through complaints
  // from the room.
  return isAttendanceWindowActive(session.date, currentIsoString, session.startTime, session.endTime);
}

/**
 * Memvalidasi tautan rekaman sesi. Nilai kosong berarti rekaman dihapus,
 * sehingga dikembalikan sebagai null alih-alih ditolak.
 *
 * HTTPS diwajibkan karena tautan ini dibuka peserta dari halaman aplikasi:
 * tautan http membuat peramban memperingatkan konten tidak aman, dan tautan
 * javascript: akan dieksekusi di peramban mereka.
 *
 * Validates a session recording link. An empty value means the recording is
 * being cleared, so it returns null rather than being rejected.
 *
 * HTTPS is required because participants open this link from inside the app: an
 * http link makes the browser warn about insecure content, and a javascript:
 * link would execute in their browser.
 */
export function validateRecordingUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') throw new Error();
    return value;
  } catch {
    throw new Error('Tautan rekaman harus berupa URL HTTPS yang valid / Recording link must be a valid HTTPS URL');
  }
}

/**
 * Mengembalikan seluruh kelas yang mengikuti sebuah sesi.
 *
 * Sesi onboarding dihadiri beberapa kelas dalam satu ruang Zoom, sehingga
 * keanggotaan tidak dapat diperiksa hanya terhadap classId. Sesi lama tidak
 * memuat classIds; ketiadaannya berarti hanya kelas penyelenggara yang ikut.
 *
 * Returns every class attending a session.
 *
 * An onboarding session is attended by several classes in one Zoom room, so
 * membership cannot be checked against classId alone. Older sessions carry no
 * classIds; its absence means only the owning class attends.
 */
export function sessionClassIds(session: Pick<SessionDocument, 'classId' | 'classIds'>): string[] {
  const extra = session.classIds ?? [];
  return Array.from(new Set([session.classId, ...extra].filter(Boolean)));
}

/**
 * Menentukan apakah sebuah kelas mengikuti sesi tersebut.
 *
 * Determines whether a class attends that session.
 */
export function sessionIncludesClass(
  session: Pick<SessionDocument, 'classId' | 'classIds'>,
  classId: string | null | undefined
): boolean {
  if (!classId) return false;
  return sessionClassIds(session).includes(classId);
}
