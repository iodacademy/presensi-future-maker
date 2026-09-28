// Layanan agregat data beranda siswa / Student home dashboard aggregation service
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import type { StudentHomeData, StudentHomeSession, StudentHomeMentoring, StudentHomeTask } from './types';
import type { ClassDocument } from '../classes/types';
import type { SessionDocument, AttendanceDocument } from '../attendance/types';
import type { MentoringBookingDocument } from '../mentoring/types';
import type { TaskDocument } from '../tasks/types';
import type { SubmissionDocument } from '../tasks/submission-types';
import { isSessionAttendanceActive } from '../attendance/policy';
import { isDeadlineUrgent, formatDeadlineLabel, formatProgressRatio } from './policy';

/**
 * Mengambil ringkasan beranda siswa: sesi aktif/berikutnya, mentoring terdekat,
 * tugas terdekat, dan progres bootcamp (Frame 01 & Frame 05).
 *
 * Retrieves student home summary: active/next session, next mentoring,
 * nearest task, and bootcamp progress ratios.
 */
export async function getStudentHomeDashboard(actor: Actor): Promise<StudentHomeData> {
  const db = getAdminDb();
  const defaultData: StudentHomeData = {
    studentName: actor.name || 'Peserta',
    className: 'Future Innovators Bootcamp',
    activeSession: null,
    nextSession: null,
    nearestMentoring: null,
    remainingMentoringQuota: 2,
    nearestTask: null,
    nearestWorkingPaper: null,
    progress: {
      attendanceRatio: '0/0',
      dailyTasksRatio: '0/0',
      mentoringRatio: '0/2',
    },
  };

  if (!actor.classId) {
    return defaultData;
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // Semua query di bawah independen satu sama lain (beda koleksi, tidak saling
  // bergantung) -- jalankan paralel, bukan berurutan, supaya latensi total = query
  // terlambat, bukan jumlah semua query. Ini penyebab utama halaman Home lambat.
  //
  // All queries below are independent of each other (different collections, no
  // interdependency) -- run in parallel, not sequentially, so total latency =
  // slowest query, not the sum of all queries. This was the main cause of slow
  // Home page loads.
  const [classDoc, sessionsSnap, attendSnap, bookingsSnap, quotaSnap, tasksSnap, subsSnap] = await Promise.all([
    db.collection('classes').doc(actor.classId).get(),
    db.collection('sessions').where('classId', '==', actor.classId).get(),
    db.collection('attendance').where('classId', '==', actor.classId).where('studentId', '==', actor.uid).get(),
    db.collection('bookings').where('studentId', '==', actor.uid).where('status', '==', 'confirmed').get(),
    db.collection('mentoringQuotas').doc(`${actor.uid}_bootcamp`).get(),
    db.collection('tasks').where('classId', '==', actor.classId).where('published', '==', true).get(),
    db.collection('submissions').where('studentId', '==', actor.uid).get(),
  ]);

  if (!classDoc.exists) return defaultData;
  const classData = classDoc.data() as ClassDocument;

  const sessions = sessionsSnap.docs.map((d) => d.data() as SessionDocument);
  // Hanya catatan berstatus hadir yang dihitung. Izin dan sakit tersimpan pada
  // koleksi yang sama, sehingga menghitung seluruh dokumen akan menampilkan
  // peserta yang berhalangan sebagai hadir. Dokumen lama tidak memuat status
  // dan seluruhnya berasal dari pemindaian, sehingga ketiadaannya berarti hadir.
  //
  // Only records marked present are counted. Excused and sick live in the same
  // collection, so counting every document would show someone who was excused
  // as present. Older documents carry no status and all came from a scan, so
  // its absence means present.
  const attendedSessionIds = new Set(
    attendSnap.docs
      .map((d) => d.data() as AttendanceDocument)
      .filter((a) => (a.status ?? 'present') === 'present')
      .map((a) => a.sessionId)
  );

  let activeSession: StudentHomeSession | null = null;
  let nextSession: StudentHomeSession | null = null;

  // Cari sesi yang aktif saat ini / Find currently active session
  for (const s of sessions) {
    if (isSessionAttendanceActive(s, nowIso)) {
      activeSession = {
        id: s.id,
        title: s.title,
        timeStr: `${s.date} • ${s.startTime} - ${s.endTime} WIB`,
        mode: s.mode,
        zoomUrl: s.zoomUrl,
        address: s.address,
        isAttended: attendedSessionIds.has(s.id),
      };
      break;
    }
  }

  // Jika tidak ada sesi aktif, cari sesi berikutnya di masa depan / Find next upcoming session
  if (!activeSession) {
    const upcoming = sessions
      .filter((s) => s.endsAt > nowIso)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    if (upcoming.length > 0) {
      const s = upcoming[0];
      nextSession = {
        id: s.id,
        title: s.title,
        timeStr: `${s.date} • ${s.startTime} - ${s.endTime} WIB`,
        mode: s.mode,
        zoomUrl: s.zoomUrl,
        address: s.address,
        isAttended: attendedSessionIds.has(s.id),
      };
    }
  }

  // Mentoring Terdekat & Sisa Kuota / Nearest Mentoring Booking & Remaining Quota
  const bookings = bookingsSnap.docs.map((d) => d.data() as MentoringBookingDocument);

  const upcomingBookings = bookings
    .filter((b) => b.endsAt > nowIso)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  let nearestMentoring: StudentHomeMentoring | null = null;
  if (upcomingBookings.length > 0) {
    const b = upcomingBookings[0];
    nearestMentoring = {
      id: b.id,
      mentorName: b.mentorName,
      date: b.date,
      timeStr: `${b.startTime} - ${b.endTime} WIB`,
      meetUrl: b.meetUrl,
    };
  }

  // Sisa kuota mentoring (fase bootcamp default) / Remaining mentoring quota
  const quotaCount = quotaSnap.exists ? (quotaSnap.data()?.count || 0) : 0;
  const remainingMentoringQuota = Math.max(0, 2 - quotaCount);

  // Tugas Terdekat (belum dikumpulkan) / Nearest Unsubmitted Task
  const tasks = tasksSnap.docs.map((d) => d.data() as TaskDocument);
  const submittedTaskIds = new Set(subsSnap.docs.map((d) => (d.data() as SubmissionDocument).taskId));

  const unsubmittedTasks = tasks
    .filter((t) => !submittedTaskIds.has(t.id))
    .sort((a, b) => {
      if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      return a.order - b.order;
    });

  function toHomeTask(t: TaskDocument): StudentHomeTask {
    const isUrgent = isDeadlineUrgent(t.dueAt, nowMs);
    return {
      id: t.id,
      title: t.title,
      kind: t.kind,
      dueAt: t.dueAt,
      isUrgent,
      deadlineLabel: formatDeadlineLabel(isUrgent, t.dueAt),
    };
  }

  const nearestTask: StudentHomeTask | null =
    unsubmittedTasks.length > 0 ? toHomeTask(unsubmittedTasks[0]) : null;

  // Hasil praktik di kelas ditonjolkan terpisah. Batasnya jatuh beberapa jam
  // setelah pertemuannya, jauh lebih cepat daripada tugas mandiri, sehingga
  // satu kartu "tugas terdekat" yang sudah terisi tugas lain menyembunyikan
  // justru yang paling mendesak.
  //
  // Class practice results get their own highlight. Their deadline falls hours
  // after the meeting, far sooner than a self-study task, so a single "nearest
  // task" card already holding another task hides the most urgent one.
  const nearestWorkingPaper: StudentHomeTask | null =
    unsubmittedTasks.find((t) => t.kind === 'working-paper')
      ? toHomeTask(unsubmittedTasks.find((t) => t.kind === 'working-paper')!)
      : null;

  // Hitungan Rasio Progres Bootcamp (Frame 05) / Progress Ratios
  // Presensi: jumlah sesi yang dihadiri / total sesi yang sudah selesai
  const pastSessions = sessions.filter((s) => s.endsAt <= nowIso);
  const attendanceRatio = formatProgressRatio(attendedSessionIds.size, pastSessions.length || sessions.length);

  // Tugas Harian: jumlah tugas harian yang terkumpul / total tugas harian wajib
  const totalRequiredDaily = classData.requiredDailyTaskIds?.length || tasks.filter((t) => t.kind === 'daily').length || 0;
  const submittedDailyCount = tasks.filter((t) => t.kind === 'daily' && submittedTaskIds.has(t.id)).length;
  const dailyTasksRatio = formatProgressRatio(submittedDailyCount, totalRequiredDaily);

  // Mentoring: jumlah booking / 2
  const mentoringRatio = `${quotaCount}/2`;

  return {
    studentName: actor.name || 'Peserta',
    className: classData.canonicalName,
    activeSession,
    nextSession,
    nearestMentoring,
    remainingMentoringQuota,
    nearestTask,
    nearestWorkingPaper,
    progress: {
      attendanceRatio,
      dailyTasksRatio,
      mentoringRatio,
    },
  };
}
