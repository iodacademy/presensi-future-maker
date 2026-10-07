// Layanan sesi kelas, rotasi token QR dan pencatatan presensi siswa
// Session management, QR token rotation, and student attendance recording service
import crypto from 'crypto';
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor, UserDocument } from '../auth/types';
import type { MaterialLink, MaterialCategory } from '../tasks/types';
import { MATERIAL_CATEGORY_LABELS } from '../tasks/types';
import { scopeCovers } from '../survey/policy';
import type { SurveyFormDocument } from '../survey/types';
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
  generateSessionCode,
  verifySessionCode,
  isSessionCodeShaped,
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
  let sessionCode: string | null = null;

  if (isActive) {
    // Kode statis sesi. Tidak ikut berotasi, sehingga QR-nya dapat difoto
    // sekali lalu ditayangkan sepanjang sesi, dan kodenya dapat dibacakan saat
    // onboarding daring.
    //
    // The session's static code. It does not rotate, so its QR can be
    // photographed once and shown for the whole session, and the code can be
    // read out during remote onboarding.
    sessionCode = generateSessionCode(sessionId, session.qrRevision, getQrSecret());
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
    sessionCode,
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
/**
 * Mencari sesi yang kode presensinya cocok.
 *
 * Kode statis tidak memuat sessionId, sehingga sesinya hanya dapat ditemukan
 * dengan menghitung ulang kode tiap sesi yang sedang terbuka lalu
 * membandingkannya. Pencarian dibatasi pada sesi hari ini yang memuat kelas
 * peserta: tanpa batas itu kode satu kelas dapat mencocoki sesi kelas lain
 * yang kebetulan berkode sama, dan seluruh koleksi sesi ikut terbaca setiap
 * kali seseorang memindai.
 *
 * Finds the session a given attendance code belongs to.
 *
 * A static code carries no sessionId, so its session can only be found by
 * recomputing each open session's code and comparing. The search is limited to
 * today's sessions that include the participant's class: without that limit
 * one class's code could match another class's session that happens to share
 * it, and every scan would read the entire sessions collection.
 */
async function findOpenSessionByCode(
  code: string,
  classId: string | null | undefined
): Promise<SessionDocument | null> {
  if (!classId) return null;

  const db = getAdminDb();
  const nowIso = new Date().toISOString();
  const today = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(new Date());

  const snap = await db.collection('sessions').where('date', '==', today).get();
  const secret = getQrSecret();

  for (const doc of snap.docs) {
    const session = doc.data() as SessionDocument;
    if (!sessionIncludesClass(session, classId)) continue;
    if (!isSessionAttendanceActive(session, nowIso)) continue;

    const verification = verifySessionCode(code, session.id, session.qrRevision, secret);
    if (verification.isValid) return session;
  }

  return null;
}

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

  // Token berotasi memuat sessionId di dalam dirinya; kode statis enam
  // karakter tidak. Membongkar kode statis sebagai base64url menghasilkan
  // byte sampah, dan potongan sebelum ':' menjadi id yang tidak pernah ada --
  // seluruh presensi lewat kode ditolak dengan "Sesi presensi tidak
  // ditemukan".
  //
  // A rotating token carries its sessionId inside it; a six-character static
  // code does not. Decoding a static code as base64url yields junk bytes, and
  // the part before ':' becomes an id that never exists -- every code-based
  // check-in was refused with "session not found".
  let session: SessionDocument | null = null;

  if (isSessionCodeShaped(token)) {
    session = await findOpenSessionByCode(token, actor.classId);
    if (!session) {
      throw new Error('Kode presensi tidak cocok dengan sesi mana pun yang sedang dibuka untuk kelas Anda.');
    }
  } else {
    let sessionId = '';
    try {
      const raw = Buffer.from(token, 'base64url').toString('utf-8');
      sessionId = raw.split(':')[0];
    } catch {
      throw new Error('Format token QR tidak valid');
    }

    session = await getSessionById(sessionId);
    if (!session) {
      throw new Error('Sesi presensi tidak ditemukan');
    }
  }

  const sessionId = session.id;

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

  // Sesi harus dibuka admin. Token berotasi sudah memuat jendela waktunya
  // sendiri, tetapi kode statis tidak: tanpa pemeriksaan ini kode yang difoto
  // peserta tetap berlaku berhari-hari setelah sesinya usai.
  //
  // The session must be open. A rotating token carries its own time window but
  // a static code does not: without this check a code a participant
  // photographed would still work days after the session ended.
  if (!isSessionAttendanceActive(session, new Date().toISOString())) {
    throw new Error('Presensi sesi ini sedang ditutup. Hubungi admin kelas Anda.');
  }

  // Kode statis panjangnya tetap dan hurufnya terbatas; token berotasi adalah
  // base64url yang jauh lebih panjang. Bentuknya sendiri yang memilih jalur
  // pemeriksaan, jadi peserta tidak perlu menyatakan memakai yang mana.
  //
  // A static code has a fixed length and a limited alphabet; a rotating token
  // is much longer base64url. The shape itself picks the check, so a
  // participant never has to declare which one they are using.
  const verification = isSessionCodeShaped(token)
    ? verifySessionCode(token, sessionId, session.qrRevision, getQrSecret())
    : verifyQrToken(token, sessionId, session.qrRevision, getQrSecret(), Date.now());
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
  // Working paper diambil bersama sesinya: peserta mencari berdasarkan
  // pertemuan, sehingga rekaman, bahan, dan tugas sesinya perlu tiba bersamaan
  // alih-alih memaksa halaman memanggil dua endpoint.
  //
  // Working papers are fetched alongside the sessions: participants look by
  // meeting, so recordings, materials, and the session's task need to arrive
  // together rather than forcing the page to call two endpoints.
  const [sessions, attendanceSnap, papersSnap, examSnap, attemptsSnap, surveyFormSnap, surveyResponseSnap] = await Promise.all([
    listSessionsForClass(actor.classId),
    db.collection('attendance').where('classId', '==', actor.classId).where('studentId', '==', actor.uid).get(),
    db
      .collection('tasks')
      .where('classId', '==', actor.classId)
      .where('kind', '==', 'working-paper')
      .get(),
    // Kuis ikut diambil bersama sesinya: peserta mencari berdasarkan
    // pertemuan, sehingga rekaman, bahan, tugas, dan kuisnya perlu tiba
    // bersamaan alih-alih memaksa halaman memanggil endpoint kedua.
    //
    // Quizzes are fetched alongside their sessions: participants look by
    // meeting, so recordings, materials, tasks, and the quiz need to arrive
    // together rather than forcing the page to call a second endpoint.
    db
      .collection('exams')
      .where('classId', '==', actor.classId)
      .where('published', '==', true)
      .get(),
    db.collection('examAttempts').where('studentId', '==', actor.uid).get(),
    // Formulir survei dan jawaban peserta ikut dibaca di sini: survei melekat
    // pada pertemuan yang sama dengan rekaman dan kuisnya, dan memanggil
    // endpoint kedua hanya untuk satu baris pada tiap kartu menambah satu
    // perjalanan untuk data yang sudah dalam perjalanan.
    //
    // The survey form and the participant's responses are read here too: the
    // survey belongs to the same meeting as its recordings and quiz, and a
    // second endpoint for one row per card adds a round trip for data already
    // in flight.
    db.collection('surveyForms').get(),
    db.collection('surveyResponses').where('studentId', '==', actor.uid).get(),
  ]);

  // Beberapa survei dapat mengenai satu pertemuan, masing-masing dengan
  // cakupannya sendiri. Yang belum terbit dan yang belum berpertanyaan
  // dilewatkan: keduanya menagih peserta mengisi layar kosong.
  //
  // Several surveys can cover one meeting, each with its own scope. Unpublished
  // ones and ones without questions are skipped: both would ask participants to
  // fill in an empty screen.
  const surveyForms = surveyFormSnap.docs
    .map((d) => d.data() as SurveyFormDocument)
    .filter((f) => f.published && f.questions.length > 0);

  // Dikunci pada formulir dan pertemuannya sekaligus: satu peserta dapat
  // mengisi dua survei berbeda untuk pertemuan yang sama.
  //
  // Keyed on form and meeting together: one participant may fill in two
  // different surveys for the same meeting.
  const surveyDone = new Set(
    surveyResponseSnap.docs.map((d) => {
      const r = d.data() as { formId: string; sessionId: string };
      return `${r.formId}_${r.sessionId}`;
    })
  );

  const bestByExam = new Map<string, { score: number; passed: boolean }>();
  const attemptCount = new Map<string, number>();
  for (const doc of attemptsSnap.docs) {
    const a = doc.data() as { examId: string; status: string; score: number | null; passed: boolean | null };
    attemptCount.set(a.examId, (attemptCount.get(a.examId) ?? 0) + 1);
    if (a.status !== 'selesai') continue;
    const sebelumnya = bestByExam.get(a.examId);
    if (!sebelumnya || (a.score ?? 0) > sebelumnya.score) {
      bestByExam.set(a.examId, { score: a.score ?? 0, passed: a.passed === true });
    }
  }

  const examsBySession = new Map<string, { id: string; title: string; questionCount: number; durationMinutes: number | null; score: number | null; passed: boolean; attemptsLeft: number }[]>();
  for (const doc of examSnap.docs) {
    const e = doc.data() as { id: string; title: string; sessionId: string | null; questionCount: number; durationMinutes: number | null };
    if (!e.sessionId) continue;
    const terbaik = bestByExam.get(e.id);
    if (!examsBySession.has(e.sessionId)) examsBySession.set(e.sessionId, []);
    examsBySession.get(e.sessionId)!.push({
      id: e.id,
      title: e.title,
      questionCount: e.questionCount,
      durationMinutes: e.durationMinutes,
      score: terbaik?.score ?? null,
      passed: terbaik?.passed ?? false,
      attemptsLeft: Math.max(0, 3 - (attemptCount.get(e.id) ?? 0)),
    });
  }

  const papersBySession = new Map<string, { id: string; title: string; dueAt: string | null }[]>();
  for (const doc of papersSnap.docs) {
    const t = doc.data() as { id: string; title: string; dueAt: string | null; sessionId?: string | null; published?: boolean };
    // Tugas yang belum terbit tidak boleh tampil; peserta akan melihat tugas
    // yang belum siap dibuka.
    //
    // Unpublished tasks must not show; participants would see a task that is
    // not ready to open.
    if (!t.sessionId || t.published === false) continue;
    if (!papersBySession.has(t.sessionId)) papersBySession.set(t.sessionId, []);
    papersBySession.get(t.sessionId)!.push({ id: t.id, title: t.title, dueAt: t.dueAt ?? null });
  }

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
    workingPapers: papersBySession.get(s.id) ?? [],
    exams: examsBySession.get(s.id) ?? [],
    // Survei hanya muncul bila kehadirannya tercatat. Peserta yang tidak hadir
    // tidak punya pengalaman pertemuan itu untuk dinilai, dan menagihnya
    // meninggalkan tagihan yang tidak pernah dapat ia selesaikan.
    //
    // The survey appears only once attendance is recorded. Someone who did not
    // attend has no experience of that meeting to rate, and asking them leaves
    // a demand they can never satisfy.
    surveys: attendMap.has(s.id)
      ? surveyForms
          .filter((f) => scopeCovers(f.scope, actor.classId!, s.id))
          .map((f) => ({
            formId: f.id,
            formTitle: f.title,
            questionCount: f.questions.length,
            submitted: surveyDone.has(`${f.id}_${s.id}`),
          }))
      : [],
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

/**
 * Menebak jenis berkas dari tautannya, untuk memilih ikon dan keterangan.
 *
 * Guesses a file's kind from its link, to pick an icon and caption.
 */
function guessMaterialKind(url: string): MaterialLink['kind'] {
  const lower = url.toLowerCase();
  if (lower.includes('/presentation/') || lower.endsWith('.ppt') || lower.endsWith('.pptx')) return 'slide';
  if (lower.includes('/spreadsheets/') || lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv')) return 'sheet';
  if (lower.includes('/document/') || lower.endsWith('.doc') || lower.endsWith('.docx')) return 'doc';
  if (lower.endsWith('.pdf')) return 'pdf';
  return 'other';
}

/**
 * Memeriksa golongan bahan dari masukan admin. Kosong berarti praktik, sama
 * seperti bahan lama; nilai lain ditolak agar tidak ada golongan yang tidak
 * pernah tampil di halaman peserta.
 *
 * Checks a material group from admin input. Empty means practice, the same as
 * old materials; anything else is rejected so no group exists that never shows
 * on the participant page.
 */
export function parseMaterialCategory(raw: unknown): MaterialCategory {
  if (raw === undefined || raw === null || raw === '') return 'praktik';
  if (raw === 'presentasi' || raw === 'tambahan' || raw === 'praktik') return raw;
  throw new Error('Golongan bahan tidak dikenal');
}

/**
 * Admin menambahkan satu bahan praktik pada sebuah pertemuan.
 *
 * Bahan melekat pada sesi, bukan pada tugas: peserta mencari berdasarkan
 * pertemuan, sehingga rekaman dan bahannya perlu berada di satu tempat.
 *
 * Transaksi dipakai, bukan pembaruan larik biasa: dua admin yang menambah bahan
 * hampir bersamaan sama-sama membaca daftar lama, dan yang menulis belakangan
 * menghapus bahan yang baru saja ditambahkan yang lain.
 *
 * An admin adds one practice material to a meeting.
 *
 * Materials hang off the session rather than a task: participants look by
 * meeting, so a recording and its materials belong in one place.
 *
 * A transaction is used rather than a plain array update: two admins adding
 * materials at nearly the same time both read the old list, and whoever writes
 * last erases the material the other just added.
 */
export async function addSessionMaterial(
  actor: Actor,
  input: { sessionId: string; label: string; url: string; kind?: MaterialLink['kind']; category?: string }
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan menambah bahan praktik');
  }

  const category = parseMaterialCategory(input.category);

  const url = (input.url ?? '').trim();
  if (!url) {
    throw new Error('Tautan bahan wajib diisi');
  }

  // HTTPS diwajibkan karena tautan ini dirender sebagai href pada halaman
  // peserta: skema javascript: akan dieksekusi di peramban mereka.
  //
  // HTTPS is required because this link renders as an href on the participant
  // page: a javascript: scheme would execute in their browser.
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error();
  } catch {
    throw new Error('Tautan bahan harus berupa URL HTTPS yang valid');
  }

  const label = (input.label ?? '').trim().slice(0, 80) || MATERIAL_CATEGORY_LABELS[category];
  const db = getAdminDb();
  const sessionRef = db.collection('sessions').doc(input.sessionId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) {
      throw new Error('Sesi tidak ditemukan');
    }

    const existing = ((snap.data() as SessionDocument).materials || []) as MaterialLink[];
    if (existing.some((m) => m.url === url)) {
      throw new Error('Tautan ini sudah ditambahkan pada pertemuan tersebut');
    }

    tx.update(sessionRef, {
      materials: [
        ...existing,
        {
          id: crypto.randomUUID(),
          label,
          url,
          kind: input.kind ?? guessMaterialKind(url),
          category,
          addedAt: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    });
  });
}

/**
 * Admin menghapus satu bahan praktik dari sebuah pertemuan.
 *
 * An admin removes one practice material from a meeting.
 */
export async function removeSessionMaterial(
  actor: Actor,
  sessionId: string,
  materialId: string
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan menghapus bahan praktik');
  }

  const db = getAdminDb();
  const sessionRef = db.collection('sessions').doc(sessionId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) {
      throw new Error('Sesi tidak ditemukan');
    }

    const existing = ((snap.data() as SessionDocument).materials || []) as MaterialLink[];
    tx.update(sessionRef, {
      materials: existing.filter((m) => m.id !== materialId),
      updatedAt: new Date().toISOString(),
    });
  });
}

/**
 * Admin memindahkan satu isi pertemuan ke golongan lain: rekaman, slide
 * presentasi, materi tambahan, atau bahan praktik.
 *
 * Tanpa ini, isi yang terlanjur masuk golongan yang salah -- misalnya slide
 * yang ditambahkan lewat form rekaman -- harus dihapus lalu diketik ulang.
 * Dikerjakan dalam satu transaksi agar isi tidak hilang dari kedua tempat
 * bila salah satu tulisan gagal.
 *
 * An admin moves one meeting item to another group: recording, presentation
 * slides, additional material, or practice material.
 *
 * Without this, an item filed under the wrong group -- say, slides added
 * through the recording form -- must be deleted and retyped. Done in one
 * transaction so the item never vanishes from both places if one write fails.
 */
export async function moveSessionContent(
  actor: Actor,
  input: { sessionId: string; itemId: string; to: string }
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan memindahkan isi pertemuan');
  }
  const to = input.to === 'rekaman' ? 'rekaman' : parseMaterialCategory(input.to);

  const db = getAdminDb();
  const sessionRef = db.collection('sessions').doc(input.sessionId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) {
      throw new Error('Sesi tidak ditemukan');
    }
    const session = snap.data() as SessionDocument;
    const recordings = session.recordings ?? [];
    const materials = (session.materials ?? []) as MaterialLink[];

    const recording = recordings.find((r) => r.id === input.itemId);
    const material = materials.find((m) => m.id === input.itemId);
    const item = recording ?? material;
    if (!item) {
      throw new Error('Isi pertemuan tidak ditemukan');
    }

    const nextRecordings = recordings.filter((r) => r.id !== input.itemId);
    const nextMaterials = materials.filter((m) => m.id !== input.itemId);
    if (to === 'rekaman') {
      nextRecordings.push({ id: item.id, label: item.label, url: item.url, addedAt: item.addedAt });
    } else {
      nextMaterials.push({
        id: item.id,
        label: item.label,
        url: item.url,
        kind: material?.kind ?? guessMaterialKind(item.url),
        category: to,
        addedAt: item.addedAt,
      });
    }

    tx.update(sessionRef, { recordings: nextRecordings, materials: nextMaterials, updatedAt: new Date().toISOString() });
  });
}
