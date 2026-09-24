// Layanan sesi kelas, rotasi token QR dan pencatatan presensi siswa
// Session management, QR token rotation, and student attendance recording service
import crypto from 'crypto';
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor, UserDocument } from '../auth/types';
import type {
  SessionDocument,
  AttendanceDocument,
  CreateSessionInput,
  AttendanceOverride,
  QrMonitorData,
  SessionRecording,
  UpdateSessionInput,
  AttendanceStatus,
  SetAttendanceInput,
  AddRecordingInput,
  RemoveRecordingInput,
} from './types';
import type { ClassDocument } from '../classes/types';
import {
  validateSessionInput,
  isSessionAttendanceActive,
  validateRecordingUrl,
  sessionClassIds,
  sessionIncludesClass,
} from './policy';
import {
  generateQrToken,
  verifyQrToken,
  QR_ROTATION_INTERVAL_MS,
} from './qr';

// Secret penanda tangan token QR. Nilai default hanya untuk pengembangan lokal;
// di produksi wajib diisi, sebab siapa pun yang tahu secret-nya bisa membuat
// token presensi untuk sesi mana pun tanpa hadir.
//
// QR token signing secret. The default value is for local development only; it
// is mandatory in production, since anyone who knows it can mint attendance
// tokens for any session without being present.
function getQrSecret(): string {
  const secret = process.env.QR_TOKEN_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('QR_TOKEN_SECRET wajib diisi di lingkungan produksi');
    }
    return 'dev-only-qr-secret';
  }
  return secret;
}

/**
 * Mengonversi tanggal dan jam WIB (UTC+7) ke ISO string UTC.
 *
 * Converts date and WIB time (UTC+7) to UTC ISO string.
 */
function toUtcIso(dateStr: string, timeStr: string): string {
  // e.g. dateStr: "2026-09-10", timeStr: "19:00" -> "2026-09-10T19:00:00+07:00"
  const localWib = `${dateStr}T${timeStr}:00+07:00`;
  return new Date(localWib).toISOString();
}

/**
 * Admin membuat sesi pertemuan baru untuk satu kelas.
 *
 * Admin creates a new class session meeting.
 */
export async function createSession(actor: Actor, input: CreateSessionInput): Promise<{ id: string }> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan membuat jadwal pertemuan');
  }

  const validated = validateSessionInput(input);
  const db = getAdminDb();

  const classRef = db.collection('classes').doc(validated.classId);
  const classDoc = await classRef.get();
  if (!classDoc.exists) {
    throw new Error('Kelas tidak ditemukan');
  }
  const classData = classDoc.data() as ClassDocument;

  const sessionId = crypto.randomUUID();
  const startsAt = toUtcIso(validated.date, validated.startTime);
  const endsAt = toUtcIso(validated.date, validated.endTime);
  const now = new Date().toISOString();

  // Kelas tambahan diperiksa keberadaannya lebih dulu. ID kelas yang tidak ada
  // membuat pesertanya tidak pernah muncul pada daftar hadir, tanpa galat apa
  // pun yang memberi tahu admin.
  //
  // Additional classes are verified to exist first. A class ID that does not
  // exist leaves its participants absent from the attendance list, with no
  // error telling the admin.
  const extraClassIds = Array.from(
    new Set((input.classIds ?? []).map((id) => id.trim()).filter((id) => id && id !== validated.classId))
  );

  if (extraClassIds.length > 0) {
    const extraDocs = await Promise.all(
      extraClassIds.map((id) => db.collection('classes').doc(id).get())
    );
    const missing = extraClassIds.filter((_, i) => !extraDocs[i].exists);
    if (missing.length > 0) {
      throw new Error(`Kelas tambahan tidak ditemukan: ${missing.join(', ')}`);
    }
  }

  const sessionDoc: SessionDocument = {
    id: sessionId,
    classId: validated.classId,
    classIds: [validated.classId, ...extraClassIds],
    className: classData.canonicalName,
    title: validated.title,
    date: validated.date,
    startTime: validated.startTime,
    endTime: validated.endTime,
    startsAt,
    endsAt,
    mode: validated.mode,
    zoomUrl: validated.zoomUrl,
    address: validated.address,
    mapsUrl: validated.mapsUrl,
    attendanceOverride: 'auto',
    qrRevision: 1,
    attendeeCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('sessions').doc(sessionId).set(sessionDoc);

  return { id: sessionId };
}

/**
 * Mengambil daftar sesi untuk sebuah kelas (diurutkan dengan sesi aktif di atas, lalu berdasarkan tanggal).
 *
 * Lists sessions for a class with active session first.
 */
export async function listSessionsForClass(classId: string): Promise<SessionDocument[]> {
  const db = getAdminDb();

  // Dua kueri, bukan satu: Firestore tidak dapat memeriksa kesamaan field dan
  // keanggotaan array sekaligus dengan operator OR, sehingga sesi milik kelas
  // ini dan sesi bersama yang mencantumkannya diambil terpisah lalu digabung.
  // Tanpa kueri kedua, sesi onboarding bersama hilang dari jadwal kelas yang
  // bukan penyelenggaranya.
  //
  // Two queries rather than one: Firestore cannot check a field equality and an
  // array membership together under OR, so sessions owned by this class and
  // shared sessions listing it are fetched separately and merged. Without the
  // second query, a shared onboarding session vanishes from the schedule of
  // every class that does not own it.
  const [ownedSnap, sharedSnap] = await Promise.all([
    db.collection('sessions').where('classId', '==', classId).get(),
    db.collection('sessions').where('classIds', 'array-contains', classId).get(),
  ]);

  const byId = new Map<string, SessionDocument>();
  for (const doc of [...ownedSnap.docs, ...sharedSnap.docs]) {
    byId.set(doc.id, doc.data() as SessionDocument);
  }

  const sessions = Array.from(byId.values());
  const nowIso = new Date().toISOString();

  // Urutkan: Sesi yang sedang aktif ditampilkan paling atas (Frame B1 & B2), lalu berdasarkan tanggal
  // Sort: Active session first, then by date/startsAt
  return sessions.sort((a, b) => {
    const aActive = isSessionAttendanceActive(a, nowIso);
    const bActive = isSessionAttendanceActive(b, nowIso);

    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;

    return a.startsAt.localeCompare(b.startsAt);
  });
}

/**
 * Admin menyimpan atau menghapus tautan rekaman sebuah sesi.
 *
 * Tautan diisi setelah sesi berlangsung, sehingga terpisah dari zoomUrl yang
 * dipakai untuk bergabung. Nilai kosong menghapus rekaman, bukan ditolak.
 *
 * Admin stores or clears a session's recording link.
 *
 * The link is filled in after the session has run, so it is kept separate from
 * zoomUrl, which is used to join. An empty value clears the recording rather
 * than being rejected.
 */
export async function updateSession(actor: Actor, input: UpdateSessionInput): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan mengubah jadwal pertemuan');
  }

  const db = getAdminDb();
  const sessionRef = db.collection('sessions').doc(input.sessionId);
  const snap = await sessionRef.get();
  if (!snap.exists) {
    throw new Error('Sesi tidak ditemukan');
  }

  const current = snap.data() as SessionDocument;

  const merged = {
    classId: current.classId,
    title: input.title ?? current.title,
    date: input.date ?? current.date,
    startTime: input.startTime ?? current.startTime,
    endTime: input.endTime ?? current.endTime,
    mode: input.mode ?? current.mode,
    zoomUrl: input.zoomUrl !== undefined ? input.zoomUrl : current.zoomUrl,
    address: input.address !== undefined ? input.address : current.address,
    mapsUrl: input.mapsUrl !== undefined ? input.mapsUrl : current.mapsUrl,
  };

  const validated = validateSessionInput(merged);

  const timeChanged =
    validated.date !== current.date ||
    validated.startTime !== current.startTime ||
    validated.endTime !== current.endTime;

  // Waktu sesi terkunci begitu ada yang hadir. Tiap catatan kehadiran menyimpan
  // salinan sessionEndsAt saat pencatatan; menggeser waktu membuat salinan itu
  // tidak lagi cocok dengan sesinya, sehingga jendela presensi dan rekap
  // kehadiran ikut salah. Judul, tautan, dan alamat tetap boleh diperbaiki.
  //
  // Session times lock once anyone has attended. Each attendance record holds a
  // copy of sessionEndsAt from the moment it was taken; shifting the time makes
  // that copy disagree with its session, so the attendance window and the
  // attendance report both go wrong. Title, links, and address stay editable.
  if (timeChanged) {
    const attended = await db
      .collection('attendance')
      .where('sessionId', '==', input.sessionId)
      .limit(1)
      .get();

    if (!attended.empty) {
      throw new Error(
        'Waktu pertemuan tidak dapat diubah karena sudah ada peserta yang tercatat hadir. Judul, tautan, dan alamat masih dapat diperbaiki.'
      );
    }
  }

  const startsAt = toUtcIso(validated.date, validated.startTime);
  const endsAt = toUtcIso(validated.date, validated.endTime);

  // Daftar kelas peserta dapat diubah, misalnya ketika satu kelas ternyata
  // tidak jadi bergabung. Kelas penyelenggara selalu tercantum.
  //
  // The attending class list can be changed, for instance when one class turns
  // out not to join after all. The owning class is always listed.
  const nextClassIds =
    input.classIds !== undefined
      ? Array.from(new Set([current.classId, ...input.classIds.filter(Boolean)]))
      : undefined;

  await sessionRef.update({
    title: validated.title,
    date: validated.date,
    ...(nextClassIds ? { classIds: nextClassIds } : {}),
    startTime: validated.startTime,
    endTime: validated.endTime,
    startsAt,
    endsAt,
    mode: validated.mode,
    zoomUrl: validated.zoomUrl,
    address: validated.address,
    mapsUrl: validated.mapsUrl,
    // Nomor revisi dinaikkan agar token QR yang sudah terbit untuk jadwal lama
    // langsung hangus; token terikat pada revisi.
    //
    // The revision number is bumped so QR tokens already issued for the old
    // schedule expire at once; tokens are bound to the revision.
    ...(timeChanged ? { qrRevision: (current.qrRevision || 1) + 1 } : {}),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Admin menambah satu rekaman pada sebuah sesi.
 *
 * Admin adds one recording to a session.
 */
export async function addSessionRecording(actor: Actor, input: AddRecordingInput): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan mengisi rekaman sesi');
  }

  const url = validateRecordingUrl(input.url);
  if (!url) {
    throw new Error('Tautan rekaman wajib diisi');
  }

  const label = input.label.trim().slice(0, 60) || 'Kelas Utama';

  const db = getAdminDb();
  const sessionRef = db.collection('sessions').doc(input.sessionId);

  // Transaksi, bukan update array biasa: dua admin yang menambah rekaman
  // hampir bersamaan sama-sama membaca daftar lama, dan yang menulis belakangan
  // menghapus rekaman yang baru saja ditambahkan yang lain.
  //
  // A transaction rather than a plain array update: two admins adding
  // recordings at nearly the same time both read the old list, and whoever
  // writes last erases the recording the other just added.
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) {
      throw new Error('Sesi tidak ditemukan');
    }

    const existing = ((snap.data() as SessionDocument).recordings || []) as SessionRecording[];
    if (existing.some((r) => r.url === url)) {
      throw new Error('Tautan rekaman ini sudah ditambahkan pada sesi tersebut');
    }

    tx.update(sessionRef, {
      recordings: [
        ...existing,
        { id: crypto.randomUUID(), label, url, addedAt: new Date().toISOString() },
      ],
      updatedAt: new Date().toISOString(),
    });
  });
}

/**
 * Admin menghapus satu rekaman dari sebuah sesi.
 *
 * Admin removes a single recording from a session.
 */
export async function removeSessionRecording(actor: Actor, input: RemoveRecordingInput): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan menghapus rekaman sesi');
  }

  const db = getAdminDb();
  const sessionRef = db.collection('sessions').doc(input.sessionId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) {
      throw new Error('Sesi tidak ditemukan');
    }

    const existing = ((snap.data() as SessionDocument).recordings || []) as SessionRecording[];
    tx.update(sessionRef, {
      recordings: existing.filter((r) => r.id !== input.recordingId),
      updatedAt: new Date().toISOString(),
    });
  });
}

/**
 * Mengambil detail satu sesi berdasarkan ID.
 *
 * Retrieves detail of a single session by ID.
 */
export async function getSessionById(sessionId: string): Promise<SessionDocument | null> {
  const db = getAdminDb();
  const doc = await db.collection('sessions').doc(sessionId).get();
  if (!doc.exists) return null;
  return doc.data() as SessionDocument;
}

/**
 * Admin mengubah override presensi (Buka Manual / Tutup Manual).
 * Setiap penutupan atau pembukaan akan menaikkan qrRevision agar token lama hangus.
 *
 * Admin updates attendance override (open / closed / auto).
 * Increments qrRevision so existing issued tokens are immediately invalidated.
 */
export async function setSessionAttendanceOverride(
  actor: Actor,
  sessionId: string,
  override: AttendanceOverride
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan mengubah status presensi');
  }

  const db = getAdminDb();
  const sessionRef = db.collection('sessions').doc(sessionId);
  const doc = await sessionRef.get();
  if (!doc.exists) {
    throw new Error('Sesi tidak ditemukan');
  }

  const currentRevision = (doc.data()?.qrRevision || 1) + 1;
  const now = new Date().toISOString();

  await sessionRef.update({
    attendanceOverride: override,
    qrRevision: currentRevision,
    updatedAt: now,
  });
}

/**
 * Mengambil data live QR monitor untuk admin (Frame B3).
 * Menghasilkan token saat ini dan satu token berikutnya untuk transisi halus 30 detik.
 *
 * Retrieves live QR monitor data for admin.
 */
export async function getQrMonitorData(actor: Actor, sessionId: string): Promise<QrMonitorData> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan memantau monitor QR');
  }

  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Sesi tidak ditemukan');
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const isActive = isSessionAttendanceActive(session, nowIso);

  let currentToken: string | null = null;
  let nextToken: string | null = null;
  let currentExpiresAt: string | null = null;

  if (isActive) {
    currentToken = generateQrToken(sessionId, session.qrRevision, getQrSecret(), nowMs);
    nextToken = generateQrToken(sessionId, session.qrRevision, getQrSecret(), nowMs + QR_ROTATION_INTERVAL_MS);
    const windowStart = Math.floor(nowMs / QR_ROTATION_INTERVAL_MS) * QR_ROTATION_INTERVAL_MS;
    currentExpiresAt = new Date(windowStart + QR_ROTATION_INTERVAL_MS).toISOString();
  }

  // Ambil daftar hadir terkini / Fetch recent attendees
  const db = getAdminDb();
  const attendeesSnap = await db.collection('attendance')
    .where('sessionId', '==', sessionId)
    .limit(20)
    .get();

  const recentAttendees = attendeesSnap.docs.map((d) => {
    const data = d.data() as AttendanceDocument;
    return {
      studentName: data.studentName,
      recordedAt: data.recordedAt,
      source: data.source,
    };
  });

  return {
    session,
    serverNow: nowIso,
    isActive,
    currentToken,
    nextToken,
    currentExpiresAt,
    attendeeCount: session.attendeeCount || 0,
    recentAttendees,
  };
}

/**
 * Siswa melakukan scan QR untuk mencatat kehadiran.
 * Idempoten: Scan ulang mengembalikan presensi awal tanpa membuat duplikasi.
 *
 * Student scans QR code to record attendance idempotently.
 */
export async function recordStudentAttendance(
  actor: Actor,
  token: string,
  source: 'scan' | 'camera' = 'scan'
): Promise<{ recordedAt: string; sessionTitle: string; alreadyRecorded: boolean }> {
  if (actor.role !== 'student') {
    throw new Error('Hanya siswa yang dapat mencatat kehadiran');
  }

  if (!token) {
    throw new Error('Token QR presensi wajib disertakan');
  }

  // Ekstrak sessionId dari token / Extract sessionId from token
  let sessionId = '';
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf-8');
    sessionId = raw.split(':')[0];
  } catch {
    throw new Error('Format token QR tidak valid');
  }

  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Sesi presensi tidak ditemukan');
  }

  // Sesi onboarding dihadiri beberapa kelas dalam satu ruang Zoom, sehingga
  // keanggotaan diperiksa terhadap seluruh kelas yang terdaftar pada sesi itu,
  // bukan hanya kelas penyelenggaranya.
  //
  // An onboarding session is attended by several classes in one Zoom room, so
  // membership is checked against every class listed on that session, not just
  // the owning one.
  if (!sessionIncludesClass(session, actor.classId)) {
    throw new Error('Sesi presensi ini bukan untuk kelas Anda');
  }

  // Verifikasi keabsahan token QR / Verify token validity
  const verification = verifyQrToken(token, sessionId, session.qrRevision, getQrSecret(), Date.now());
  if (!verification.isValid) {
    throw new Error(verification.reason || 'Token QR tidak valid');
  }

  const attendanceId = `${sessionId}_${actor.uid}`;
  const db = getAdminDb();
  const attendanceRef = db.collection('attendance').doc(attendanceId);
  const now = new Date().toISOString();

  let alreadyRecorded = false;
  let recordedTime = now;

  const sessionRef = db.collection('sessions').doc(sessionId);
  const progressRef = db.collection('studentProgress').doc(actor.uid);

  await db.runTransaction(async (transaction) => {
    // Firestore mewajibkan seluruh pembacaan selesai sebelum penulisan pertama;
    // satu transaction.get setelah transaction.set membatalkan seluruh
    // transaksi. Ketiganya dibaca sekaligus di sini, bukan berselang-seling
    // dengan penulisan di bawah.
    //
    // Firestore requires every read to complete before the first write; a
    // single transaction.get after a transaction.set aborts the whole
    // transaction. All three are read together here rather than interleaved
    // with the writes below.
    const [doc, sessionSnapshot, progressSnap] = await Promise.all([
      transaction.get(attendanceRef),
      transaction.get(sessionRef),
      transaction.get(progressRef),
    ]);

    if (doc.exists) {
      alreadyRecorded = true;
      recordedTime = doc.data()?.recordedAt || now;
      return; // Sudah tercatat hadir sebelumnya / Already recorded earlier
    }

    const attendanceDoc: AttendanceDocument = {
      id: attendanceId,
      sessionId,
      sessionTitle: session.title,
      // Kelas peserta, bukan kelas penyelenggara sesi. Rekap kehadiran dan
      // ekspor disaring menurut kelas peserta; menyimpan kelas penyelenggara
      // akan menyembunyikan kehadiran peserta dari rekap kelasnya sendiri.
      //
      // The participant's class, not the session's owning class. Attendance
      // reports and exports filter by the participant's class; storing the
      // owning class would hide their attendance from their own class report.
      classId: actor.classId!,
      studentId: actor.uid,
      studentName: actor.name,
      sessionEndsAt: session.endsAt,
      recordedAt: now,
      source,
      status: 'present',
    };

    transaction.set(attendanceRef, attendanceDoc);

    // Perbarui counter hadir di sesi / Update attendee count in session
    transaction.update(sessionRef, {
      attendeeCount: (sessionSnapshot.data()?.attendeeCount || 0) + 1,
      updatedAt: now,
    });

    // Perbarui counter hadir di profil siswa / Update student progress
    transaction.set(
      progressRef,
      {
        attendanceCount: (progressSnap.exists ? progressSnap.data()?.attendanceCount || 0 : 0) + 1,
        updatedAt: now,
      },
      { merge: true }
    );
  });

  return {
    recordedAt: recordedTime,
    sessionTitle: session.title,
    alreadyRecorded,
  };
}

/**
 * Siswa mengambil jadwal pertemuan kelasnya beserta status kehadiran masing-masing.
 *
 * Student retrieves class meetings list along with their attendance status.
 */
export async function listStudentSessionsWithAttendance(actor: Actor): Promise<{
  session: SessionDocument;
  attendance: AttendanceDocument | null;
  isActive: boolean;
}[]> {
  if (!actor.classId) return [];

  const db = getAdminDb();

  // Daftar sesi dan presensi siswa independen satu sama lain -- jalankan paralel.
  // Session list and student attendance are independent -- run in parallel.
  const [sessions, attendanceSnap] = await Promise.all([
    listSessionsForClass(actor.classId),
    db.collection('attendance').where('classId', '==', actor.classId).where('studentId', '==', actor.uid).get(),
  ]);

  const attendMap = new Map<string, AttendanceDocument>();
  for (const doc of attendanceSnap.docs) {
    const att = doc.data() as AttendanceDocument;
    attendMap.set(att.sessionId, att);
  }

  const nowIso = new Date().toISOString();

  return sessions.map((s) => ({
    session: s,
    attendance: attendMap.get(s.id) || null,
    isActive: isSessionAttendanceActive(s, nowIso),
  }));
}

/**
 * Admin menetapkan status kehadiran seorang peserta pada satu pertemuan.
 *
 * Dipakai untuk mencatat izin dan sakit, serta memperbaiki presensi yang gagal
 * terpindai. Status 'absent' menghapus catatannya, sebab ketidakhadiran tanpa
 * keterangan memang berarti tidak ada catatan -- menyimpan dokumen bernilai
 * 'absent' akan membuat dua bentuk data untuk keadaan yang sama.
 *
 * Penghitung attendeeCount dan attendanceCount hanya menghitung yang hadir.
 * Izin dan sakit tidak dihitung, sehingga rasio kehadiran tetap menggambarkan
 * kehadiran yang sebenarnya.
 *
 * An admin sets a participant's attendance status for one meeting.
 *
 * Used to record excused and sick, and to repair a scan that failed. The
 * 'absent' status deletes the record, since an unexplained absence is precisely
 * the lack of a record -- storing an 'absent' document would give one situation
 * two shapes.
 *
 * The attendeeCount and attendanceCount counters track only those present.
 * Excused and sick are not counted, so the attendance ratio keeps describing
 * actual attendance.
 */
export async function setAttendanceStatus(actor: Actor, input: SetAttendanceInput): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan mengubah status kehadiran');
  }

  const db = getAdminDb();
  const session = await getSessionById(input.sessionId);
  if (!session) {
    throw new Error('Sesi tidak ditemukan');
  }

  const studentDoc = await db.collection('users').doc(input.studentId).get();
  if (!studentDoc.exists) {
    throw new Error('Peserta tidak ditemukan');
  }
  const student = studentDoc.data() as UserDocument;

  if (!sessionIncludesClass(session, student.classId)) {
    throw new Error('Peserta ini bukan anggota kelas pada pertemuan tersebut');
  }

  const attendanceRef = db.collection('attendance').doc(`${input.sessionId}_${input.studentId}`);
  const sessionRef = db.collection('sessions').doc(input.sessionId);
  const progressRef = db.collection('studentProgress').doc(input.studentId);
  const now = new Date().toISOString();
  const note = (input.note ?? '').trim().slice(0, 200) || null;

  await db.runTransaction(async (tx) => {
    const [existing, sessionSnap, progressSnap] = await Promise.all([
      tx.get(attendanceRef),
      tx.get(sessionRef),
      tx.get(progressRef),
    ]);

    const before = existing.exists ? (existing.data() as AttendanceDocument) : null;
    // Dokumen lama tidak memuat status dan seluruhnya berasal dari pemindaian.
    // Older documents carry no status and all came from a scan.
    const wasPresent = before ? (before.status ?? 'present') === 'present' : false;
    const isPresent = input.status === 'present';

    // Selisih dihitung dari perubahan keadaan, bukan ditambah atau dikurangi
    // begitu saja: menetapkan status yang sama dua kali tidak boleh menggeser
    // penghitungnya.
    //
    // The delta comes from the change of state rather than a plain increment or
    // decrement: setting the same status twice must not move the counters.
    const delta = (isPresent ? 1 : 0) - (wasPresent ? 1 : 0);

    if (input.status === 'absent') {
      if (existing.exists) tx.delete(attendanceRef);
    } else {
      const doc: AttendanceDocument = {
        id: attendanceRef.id,
        sessionId: input.sessionId,
        sessionTitle: session.title,
        // Kelas peserta, bukan kelas penyelenggara: rekap dan ekspor disaring
        // menurut kelas peserta.
        //
        // The participant's class, not the session's owner: reports and
        // exports filter by the participant's class.
        classId: student.classId!,
        studentId: input.studentId,
        studentName: student.name,
        sessionEndsAt: session.endsAt,
        // Waktu pemindaian asli dipertahankan bila ada; admin yang menambahkan
        // keterangan tidak seharusnya menggeser jam kehadiran yang tercatat.
        //
        // The original scan time is kept when present; an admin adding a note
        // should not shift the recorded arrival time.
        recordedAt: before?.recordedAt ?? now,
        source: before?.source ?? 'manual',
        status: input.status,
        note,
        recordedBy: actor.name,
      };
      tx.set(attendanceRef, doc);
    }

    if (delta !== 0) {
      tx.update(sessionRef, {
        attendeeCount: Math.max(0, (sessionSnap.data()?.attendeeCount || 0) + delta),
        updatedAt: now,
      });
      tx.set(
        progressRef,
        {
          attendanceCount: Math.max(0, (progressSnap.exists ? progressSnap.data()?.attendanceCount || 0 : 0) + delta),
          updatedAt: now,
        },
        { merge: true }
      );
    }
  });
}

/**
 * Admin mengambil daftar peserta sebuah pertemuan beserta status kehadirannya.
 *
 * Seluruh peserta kelas ditampilkan, termasuk yang belum punya catatan, sebab
 * yang dicari admin justru siapa yang belum tercatat.
 *
 * An admin fetches a meeting's participant list with their attendance status.
 *
 * Every participant in the class is listed, including those without a record,
 * since what an admin looks for is precisely who is still unaccounted for.
 */
export async function listSessionAttendance(
  actor: Actor,
  sessionId: string
): Promise<{
  session: SessionDocument;
  entries: {
    studentId: string;
    studentName: string;
    status: AttendanceStatus;
    note: string | null;
    recordedAt: string | null;
    source: string | null;
  }[];
}> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan melihat rekap kehadiran');
  }

  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Sesi tidak ditemukan');
  }

  const db = getAdminDb();
  // Sesi yang dihadiri beberapa kelas menampilkan peserta seluruhnya. Firestore
  // membatasi klausa 'in' pada 30 nilai; jumlah kelas dalam satu sesi jauh di
  // bawah itu.
  //
  // A session attended by several classes lists every participant. Firestore
  // caps an 'in' clause at 30 values; the number of classes in one session is
  // far below that.
  const attendingClassIds = sessionClassIds(session);
  const [studentsSnap, attendanceSnap] = await Promise.all([
    db
      .collection('users')
      .where('classId', 'in', attendingClassIds)
      .where('role', '==', 'student')
      .select('uid', 'name', 'classId')
      .get(),
    db.collection('attendance').where('sessionId', '==', sessionId).get(),
  ]);

  const records = new Map<string, AttendanceDocument>();
  for (const doc of attendanceSnap.docs) {
    const att = doc.data() as AttendanceDocument;
    records.set(att.studentId, att);
  }

  const entries = studentsSnap.docs
    .map((doc) => {
      const data = doc.data() as { uid?: string; name?: string };
      const uid = data.uid ?? doc.id;
      const att = records.get(uid);
      return {
        studentId: uid,
        studentName: data.name ?? '(tanpa nama)',
        status: (att ? (att.status ?? 'present') : 'absent') as AttendanceStatus,
        note: att?.note ?? null,
        recordedAt: att?.recordedAt ?? null,
        source: att?.source ?? null,
      };
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName, 'id'));

  return { session, entries };
}
