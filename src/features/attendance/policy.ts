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
  if (mode === 'online') {
    if (!zoomUrl) {
      throw new Error('Sesi Online wajib menyertakan Link Zoom HTTPS / Online session requires HTTPS Zoom link');
    }
    try {
      const u = new URL(zoomUrl);
      if (u.protocol !== 'https:') throw new Error();
    } catch {
      throw new Error('Link Zoom harus berupa URL HTTPS yang valid / Zoom link must be valid HTTPS');
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
 * Memeriksa apakah jendela presensi sesi Online aktif:
 * Otomatis buka jam 19:00 WIB dan tutup 22:00 WIB pada tanggal sesi yang sama.
 * [19:00, 22:00) WIB.
 *
 * Checks if online attendance window is active (19:00 - 22:00 WIB on session date).
 */
export function isOnlineWindowActive(sessionDate: string, currentIsoOrWibString: string): boolean {
  const dateObj = new Date(currentIsoOrWibString);
  if (isNaN(dateObj.getTime())) return false;

  // Konversi ke waktu Asia/Jakarta (WIB = UTC+7) / Convert to Asia/Jakarta (WIB)
  const wibTime = new Date(dateObj.getTime() + 7 * 60 * 60 * 1000);
  const wibIso = wibTime.toISOString(); // e.g. "2026-09-10T19:15:00.000Z"
  const currentDateWIB = wibIso.slice(0, 10);
  const currentHourWIB = parseInt(wibIso.slice(11, 13), 10);

  // Periksa kesamaan tanggal / Check date equality
  if (currentDateWIB !== sessionDate) {
    return false;
  }

  // Rentang jam [19:00, 22:00) / Range [19, 22)
  return currentHourWIB >= 19 && currentHourWIB < 22;
}

/**
 * Menentukan apakah QR presensi sesi sedang aktif:
 * - Jika override = 'closed': selalu nonaktif (tutup manual oleh admin)
 * - Jika override = 'open': aktif (buka manual oleh admin untuk offline)
 * - Jika override = 'auto':
 *   - Online: mengikuti jendela 19:00 - 22:00 WIB
 *   - Offline: default tidak aktif sampai dibuka manual oleh admin
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

  if (session.mode === 'online') {
    return isOnlineWindowActive(session.date, currentIsoString);
  }

  // Offline default auto adalah belum buka sebelum dibuka admin
  // Offline default auto is closed until manually opened
  return false;
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
