// Layanan sesi kelas, rotasi token QR dan pencatatan presensi siswa
// Session management, QR token rotation, and student attendance recording service
import crypto from 'crypto';
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import type {
  SessionDocument,
  AttendanceDocument,
  CreateSessionInput,
  AttendanceOverride,
  QrMonitorData,
} from './types';
import type { ClassDocument } from '../classes/types';
import {
  validateSessionInput,
  isSessionAttendanceActive,
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

  const sessionDoc: SessionDocument = {
    id: sessionId,
    classId: validated.classId,
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
  const snapshot = await db.collection('sessions')
    .where('classId', '==', classId)
    .get();

  const sessions = snapshot.docs.map((d) => d.data() as SessionDocument);
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

  // Validasi keanggotaan kelas siswa / Validate student class membership
  if (session.classId !== actor.classId) {
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
      classId: session.classId,
      studentId: actor.uid,
      studentName: actor.name,
      sessionEndsAt: session.endsAt,
      recordedAt: now,
      source,
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
