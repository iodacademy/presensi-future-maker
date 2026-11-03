// Model dan validasi Job Portal: mitra dan lowongan / Job Portal model and validation: partners and jobs
import { safeExternalUrl } from '../exhibition/model';

export type Employment = 'magang-3' | 'magang-6' | 'kontrak' | 'full-time';
export type Category = 'teknologi' | 'desain' | 'pemasaran' | 'administrasi';
export type WorkMode = 'hybrid' | 'wfo' | 'remote';
export type DocRule = 'required' | 'optional' | 'off';
export type QuestionKind = 'long' | 'yes-no' | 'choice';
export type JobStatus = 'draft' | 'published';
export type JobState = 'draft' | 'terjadwal' | 'aktif' | 'ditutup';
/** Skema magang lowongan, mengikuti penempatan siswa di dashboard / The job's internship scheme, matching the student's dashboard placement */
export type Scheme = 'full' | 'project';
export const SCHEME_LABELS: Record<Scheme, string> = { full: 'Full Internship', project: 'Project Based' };

export const EMPLOYMENT_LABELS: Record<Employment, string> = {
  'magang-3': 'Magang 3 bulan', 'magang-6': 'Magang 6 bulan', kontrak: 'Kontrak', 'full-time': 'Full-time',
};
export const CATEGORY_LABELS: Record<Category, string> = {
  teknologi: 'Teknologi', desain: 'Desain', pemasaran: 'Pemasaran', administrasi: 'Administrasi',
};
export const WORK_MODE_LABELS: Record<WorkMode, string> = { hybrid: 'Hybrid', wfo: 'WFO', remote: 'Remote' };
export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = { long: 'Teks panjang', 'yes-no': 'Ya / Tidak', choice: 'Pilihan' };
export const DOC_RULE_LABELS: Record<DocRule, string> = { required: 'Wajib', optional: 'Opsional', off: 'Tidak diminta' };

export interface JobQuestion { id: string; label: string; kind: QuestionKind; options: string[]; required: boolean }
export type Eligibility = { mode: 'all' } | { mode: 'classes'; classIds: string[] } | { mode: 'min-score'; minScore: number };
export interface PartnerPic { name: string; phone: string; email: string }
export interface Socials { instagram: string; linkedin: string; tiktok: string; youtube: string }
export interface Logo { thumb: string; full: string }

export interface PartnerInput {
  name: string; field: string; about: string; logo: Logo | null; website: string; socials: Socials; pics: PartnerPic[];
}
export type Partner = PartnerInput & { id: string; nameKey: string; active: boolean; createdAt: string; updatedAt: string };

export interface JobDocuments { portfolio: DocRule; works: DocRule; coverLetter: DocRule }
export interface JobInput {
  partnerId: string; title: string; employment: Employment; category: Category; scheme: Scheme; location: string; workMode: WorkMode;
  quota: number; description: string; qualifications: string[]; eligibility: Eligibility;
  /** Rupiah per bulan, atau per project untuk skema Project Based; null bila tidak dicantumkan / Rupiah per month, or per project for the Project Based scheme; null when not stated */
  salary: number | null;
  opensAt: string; closesAt: string; documents: JobDocuments; questions: JobQuestion[]; status: JobStatus;
}
export type Job = JobInput & { id: string; partnerName: string; applicantCount: number; createdAt: string; updatedAt: string };

const SOCIAL_KEYS: (keyof Socials)[] = ['instagram', 'linkedin', 'tiktok', 'youtube'];
const DOC_KEYS: (keyof JobDocuments)[] = ['portfolio', 'works', 'coverLetter'];

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
function oneOf<T extends string>(v: unknown, labels: Record<T, string>, msg: string): T {
  if (typeof v !== 'string' || !(v in labels)) throw new Error(msg);
  return v as T;
}
function link(v: unknown): string {
  const s = str(v);
  if (s && !safeExternalUrl(s)) throw new Error('Tautan harus diawali http:// atau https://');
  return s;
}

/**
 * Kunci keunikan nama mitra. Nama ini menjadi rute lamaran ke PIC, jadi "PT DIPSI"
 * dan " pt  dipsi" harus dianggap perusahaan yang sama.
 *
 * Uniqueness key for a partner name. The name routes applications to the PIC, so
 * "PT DIPSI" and " pt  dipsi" must count as the same company.
 */
export function partnerNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function validatePartnerInput(raw: unknown): PartnerInput {
  const r = obj(raw);
  const name = str(r.name).replace(/\s+/g, ' ');
  if (!name) throw new Error('Nama perusahaan wajib diisi');
  const pics = (Array.isArray(r.pics) ? r.pics : []).map((p) => {
    const o = obj(p);
    const pic = { name: str(o.name), phone: str(o.phone), email: str(o.email).toLowerCase() };
    if (!pic.name) throw new Error('Nama PIC wajib diisi');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pic.email)) throw new Error('Email PIC tidak sah');
    return pic;
  });
  if (pics.length === 0) throw new Error('Minimal satu PIC');
  const lg = r.logo ? obj(r.logo) : null;
  const socials = Object.fromEntries(SOCIAL_KEYS.map((k) => [k, link(obj(r.socials)[k])])) as unknown as Socials;
  return {
    name, field: str(r.field), about: str(r.about), website: link(r.website), socials, pics,
    logo: lg && (lg.thumb || lg.full) ? { thumb: link(lg.thumb), full: link(lg.full) } : null,
  };
}

// Tanggal dan jam WIB diubah ke ISO UTC; penanda +07:00 karena server Cloud Run berjalan pada UTC
// A WIB date and time becomes ISO UTC; the +07:00 marker because the Cloud Run server runs on UTC
function wibIso(v: unknown, what: string): string {
  if (typeof v === 'string') {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new Error(`Tanggal ${what} tidak dapat dibaca`);
    return d.toISOString();
  }
  const o = obj(v);
  const date = str(o.date);
  const time = str(o.time) || '23:59';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Tanggal ${what} wajib diisi`);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error(`Jam ${what} harus berformat HH:mm`);
  const d = new Date(`${date}T${time}:00+07:00`);
  if (Number.isNaN(d.getTime())) throw new Error(`Tanggal ${what} tidak dapat dibaca`);
  return d.toISOString();
}

const lines = (v: unknown) => (Array.isArray(v) ? v.map(str) : str(v).split(/\r?\n/).map((s) => s.trim())).filter(Boolean);

export function assignQuestionIds(questions: JobQuestion[]): JobQuestion[] {
  // globalThis.crypto tersedia di server dan peramban; model ini juga dipakai kartu lowongan di peramban
  // globalThis.crypto exists on both server and browser; this model is also used by the job card in the browser
  const newId = () => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(8)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
  return questions.map((q) => (q.id ? q : { ...q, id: newId() }));
}

function validateQuestions(raw: unknown): JobQuestion[] {
  const qs = (Array.isArray(raw) ? raw : []).map((q) => {
    const o = obj(q);
    const label = str(o.label);
    if (!label) throw new Error('Teks pertanyaan wajib diisi');
    const kind = oneOf<QuestionKind>(o.kind, QUESTION_KIND_LABELS, 'Jenis pertanyaan tidak dikenal');
    const options = kind === 'choice' ? lines(o.options) : [];
    if (kind === 'choice' && options.length < 2) throw new Error('Pertanyaan pilihan butuh minimal dua opsi');
    return { id: str(o.id), label, kind, options, required: o.required === true };
  });
  return assignQuestionIds(qs);
}

function validateEligibility(raw: unknown): Eligibility {
  const o = obj(raw);
  if (o.mode === 'classes') {
    const classIds = (Array.isArray(o.classIds) ? o.classIds : []).map(str).filter(Boolean);
    if (classIds.length === 0) throw new Error('Pilih minimal satu kelas');
    return { mode: 'classes', classIds };
  }
  if (o.mode === 'min-score') {
    const minScore = Number(o.minScore);
    if (!Number.isFinite(minScore) || minScore < 0 || minScore > 100) throw new Error('Nilai minimal harus antara 0 dan 100');
    return { mode: 'min-score', minScore };
  }
  return { mode: 'all' };
}

function rupiah(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error('Gaji harus berupa angka rupiah');
  return n;
}

/**
 * Label gaji untuk siswa. Project Based dibayar per project, Full Internship per bulan.
 * Lowongan lama tanpa kolom gaji menghasilkan null, jadi label tidak tampil.
 *
 * Salary label for students. Project Based is paid per project, Full Internship per month.
 * Older jobs without salary fields yield null, so no label shows.
 */
export function salaryLabel(salary?: number | null, scheme?: Scheme): string | null {
  return salary ? `Rp ${salary.toLocaleString('id-ID')} / ${salaryUnit(scheme)}` : null;
}

export const salaryUnit = (scheme?: Scheme) => (scheme === 'project' ? 'project' : 'bulan');

export function validateJobInput(raw: unknown): JobInput {
  const r = obj(raw);
  const partnerId = str(r.partnerId);
  if (!partnerId) throw new Error('Pilih perusahaan mitra');
  const title = str(r.title);
  if (!title) throw new Error('Nama posisi wajib diisi');
  const location = str(r.location);
  if (!location) throw new Error('Lokasi wajib diisi');
  const quota = Number(r.quota);
  if (!Number.isInteger(quota) || quota < 1) throw new Error('Kuota minimal 1');
  const opensAt = wibIso(r.opensAt, 'buka');
  const closesAt = wibIso(r.closesAt, 'tutup');
  if (closesAt <= opensAt) throw new Error('Tanggal tutup harus setelah tanggal buka');
  const docs = obj(r.documents);
  return {
    partnerId, title, location, quota, opensAt, closesAt, salary: rupiah(r.salary),
    employment: oneOf<Employment>(r.employment, EMPLOYMENT_LABELS, 'Jenis lowongan tidak dikenal'),
    category: oneOf<Category>(r.category, CATEGORY_LABELS, 'Bidang lowongan tidak dikenal'),
    scheme: oneOf<Scheme>(r.scheme, SCHEME_LABELS, 'Skema lowongan tidak dikenal'),
    workMode: oneOf<WorkMode>(r.workMode, WORK_MODE_LABELS, 'Mode kerja tidak dikenal'),
    description: str(r.description),
    qualifications: lines(r.qualifications),
    eligibility: validateEligibility(r.eligibility),
    documents: Object.fromEntries(DOC_KEYS.map((k) => [k, oneOf<DocRule>(docs[k] ?? 'off', DOC_RULE_LABELS, 'Aturan dokumen tidak dikenal')])) as unknown as JobDocuments,
    questions: validateQuestions(r.questions),
    status: r.status === 'published' ? 'published' : 'draft',
  };
}

export function jobState(job: Pick<Job, 'status' | 'opensAt' | 'closesAt'>, now: Date): JobState {
  if (job.status !== 'published') return 'draft';
  const t = now.toISOString();
  if (t < job.opensAt) return 'terjadwal';
  return t >= job.closesAt ? 'ditutup' : 'aktif';
}

export function countdownParts(closesAt: string, now: Date) {
  const ms = new Date(closesAt).getTime() - now.getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor(s / 3600) % 24, minutes: Math.floor(s / 60) % 60, seconds: s % 60, ended: ms <= 0 };
}

export function formatCountdown(p: ReturnType<typeof countdownParts>): string {
  if (p.ended) return 'Ditutup';
  const two = (n: number) => String(n).padStart(2, '0');
  const clock = `${two(p.hours)}:${two(p.minutes)}:${two(p.seconds)}`;
  return p.days > 0 ? `${p.days} hari ${clock}` : clock;
}

/**
 * Kebalikan dari masukan formulir: ISO UTC menjadi tanggal dan jam WIB untuk diisi ulang.
 *
 * The reverse of the form input: ISO UTC becomes a WIB date and time to refill the form.
 */
export function isoToWib(iso: string): { date: string; time: string } {
  const wib = new Date(new Date(iso).getTime() + 7 * 3600 * 1000).toISOString();
  return { date: wib.slice(0, 10), time: wib.slice(11, 16) };
}

// ---- Lamaran / Applications ----

export type ApplicationStatus = 'baru' | 'ditinjau' | 'shortlist' | 'interview' | 'diterima' | 'tidak-lolos';
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  baru: 'Baru', ditinjau: 'Ditinjau', shortlist: 'Shortlist', interview: 'Interview', diterima: 'Diterima', 'tidak-lolos': 'Tidak lolos',
};
// Shortlist sengaja tampil sama dengan "Dilihat mitra" agar siswa tidak menebak peringkatnya
// Shortlist deliberately reads as "Dilihat mitra" so students do not guess their ranking
const STUDENT_STATUS_LABELS: Record<ApplicationStatus, string> = {
  baru: 'Terkirim', ditinjau: 'Dilihat mitra', shortlist: 'Dilihat mitra', interview: 'Undangan interview', diterima: 'Diterima', 'tidak-lolos': 'Belum lolos',
};
export const REJECT_MESSAGE = 'Terima kasih sudah melamar. Kali ini kamu belum lolos ke tahap berikutnya.';
export const studentStatusLabel = (s: ApplicationStatus): string => STUDENT_STATUS_LABELS[s] ?? s;
export const formatApplicationNumber = (n: number): string => `FM-JOB-${String(n).padStart(4, '0')}`;

export type CvKind = 'cv' | 'surat';
export interface CvFile { id: string; ownerUid: string; kind: CvKind; fileName: string; size: number; storagePath: string; uploadedAt: string; deleted: boolean }
export interface Personal { fullName: string; email: string; phone: string; city: string; school: string; major: string; linkedin: string }
export interface AttachedWork { id: string; title: string; type: string; cover: string }
/** url kosong berarti berkas tersimpan, dibuka lewat rute berkas tugas / An empty url means a stored file, opened through the task file route */
export interface AttachedTask { submissionId: string; title: string; kind: string; url: string }
export interface Application {
  id: string; jobId: string; partnerId: string; studentId: string; classId: string; number: string;
  personal: Personal; cvId: string; cvFileName: string; coverLetterId: string | null; portfolioUrl: string;
  works: AttachedWork[]; tasks: AttachedTask[]; answers: Record<string, string>;
  finalScore: number | null; finalScorePending: boolean; finalScoreAt: string | null;
  status: ApplicationStatus; rejectReason: string; submittedAt: string; updatedAt: string; statusChangedAt: string;
}

export function isOpenToStudents(job: Pick<Job, 'status' | 'opensAt' | 'closesAt'>, now: Date): boolean {
  return jobState(job, now) === 'aktif';
}

/**
 * Penempatan dari dashboard: Full Internship boleh melamar kedua skema (cadangan bila tidak lolos seleksi
 * mitra), Project Based hanya Project Based. Tidak ditempatkan dan menunggu capstone tidak punya akses.
 *
 * Placement from the dashboard: Full Internship may apply to both schemes (a fallback if partner selection
 * fails), Project Based only to Project Based. Not placed and awaiting capstone have no access.
 */
export const hasCareerAccess = (placement: string | null): boolean => placement === 'full' || placement === 'project';
export const canApplyScheme = (placement: string | null, scheme: Scheme): boolean =>
  placement === 'full' || (placement === 'project' && scheme === 'project');

export function isEligible(e: Eligibility, s: { classId: string | null; finalScore: number | null }): boolean {
  if (e.mode === 'classes') return !!s.classId && e.classIds.includes(s.classId);
  if (e.mode === 'min-score') return s.finalScore !== null && s.finalScore >= e.minScore;
  return true;
}

export const PERSONAL_LABELS: [keyof Personal, string][] = [
  ['fullName', 'Nama lengkap'], ['email', 'Email'], ['phone', 'No. WhatsApp'],
  ['city', 'Domisili'], ['school', 'Asal sekolah / kampus'], ['major', 'Jurusan'],
];
const MAX_ANSWER = 3000;

export function validateApplicationInput(
  raw: unknown,
  job: Pick<Job, 'documents' | 'questions'>,
  owned: { cvIds: Set<string>; coverIds: Set<string>; workIds: Set<string>; submissionIds: Set<string> },
) {
  const r = obj(raw);
  const p = obj(r.personal);
  const personal = { fullName: str(p.fullName), email: str(p.email), phone: str(p.phone), city: str(p.city), school: str(p.school), major: str(p.major), linkedin: str(p.linkedin) };
  for (const [k, l] of PERSONAL_LABELS) if (!personal[k]) throw new Error(`Lengkapi data diri: ${l}`);
  // Isian disalin ke setiap baris daftar pelamar dan ekspor, jadi panjangnya dibatasi / Fields are copied into every applicant row and export, so their length is capped
  for (const [k, l] of [...PERSONAL_LABELS, ['linkedin', 'LinkedIn'] as [keyof Personal, string]]) if (personal[k].length > 200) throw new Error(`Isian terlalu panjang: ${l}`);
  if (personal.linkedin && !safeExternalUrl(personal.linkedin)) personal.linkedin = `https://${personal.linkedin.replace(/^\/+/, '')}`;

  const cvId = str(r.cvId);
  if (!owned.cvIds.has(cvId)) throw new Error('CV tidak ditemukan');

  const { documents: d } = job;
  // Lampiran untuk dokumen yang tidak diminta dibuang, bukan ditolak / Attachments for documents not requested are dropped, not rejected
  const portfolioUrl = d.portfolio === 'off' ? '' : link(r.portfolioUrl);
  if (d.portfolio === 'required' && !portfolioUrl) throw new Error('Link portofolio wajib diisi');

  const ids = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).map(str).filter(Boolean))];
  const workIds = d.works === 'off' ? [] : ids(r.workIds);
  const submissionIds = d.works === 'off' ? [] : ids(r.submissionIds);
  if (workIds.some((id) => !owned.workIds.has(id)) || submissionIds.some((id) => !owned.submissionIds.has(id))) throw new Error('Lampiran bukan milikmu');
  if (d.works === 'required' && workIds.length + submissionIds.length === 0) throw new Error('Lampirkan minimal satu karya atau tugas');

  const cover = str(r.coverLetterId);
  const coverLetterId = d.coverLetter === 'off' || !cover ? null : cover;
  if (coverLetterId && !owned.coverIds.has(coverLetterId)) throw new Error('Surat lamaran tidak ditemukan');
  if (d.coverLetter === 'required' && !coverLetterId) throw new Error('Surat lamaran wajib diunggah');

  const given = obj(r.answers);
  const answers: Record<string, string> = {};
  for (const q of job.questions) {
    const a = str(given[q.id]);
    if (!a) {
      if (q.required) throw new Error(`Jawab pertanyaan: ${q.label}`);
      continue;
    }
    if (a.length > MAX_ANSWER) throw new Error(`Jawaban terlalu panjang: ${q.label}`);
    if ((q.kind === 'choice' && !q.options.includes(a)) || (q.kind === 'yes-no' && a !== 'Ya' && a !== 'Tidak')) {
      throw new Error(`Jawaban tidak sah: ${q.label}`);
    }
    answers[q.id] = a;
  }
  return { personal, cvId, coverLetterId, portfolioUrl, workIds, submissionIds, answers };
}

// ---- Interview ----

export type InterviewConfirmation = 'pending' | 'hadir' | 'jadwal-ulang';
export interface InterviewInput {
  date: string; start: string; durationMin: 30 | 45 | 60; mode: 'online' | 'offline'; linkSource: 'meet-auto' | 'manual';
  url: string; address: string; interviewer: string; note: string;
}
export interface Interview extends InterviewInput {
  confirmation: InterviewConfirmation; rescheduleNote: string; calendarEventId: string | null; invitedAt: string;
}

export function validateInterviewInput(raw: unknown): InterviewInput {
  const r = obj(raw);
  const date = str(r.date);
  const start = str(r.start);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Tanggal interview wajib diisi');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) throw new Error('Jam mulai harus berformat HH:mm');
  // 2026-13-01 lolos pola tetapi merusak tampilan jadwal / 2026-13-01 passes the pattern but breaks the schedule display
  if (Number.isNaN(new Date(`${date}T${start}:00+07:00`).getTime())) throw new Error('Tanggal interview tidak sah');
  const durationMin = Number(r.durationMin);
  if (![30, 45, 60].includes(durationMin)) throw new Error('Durasi interview tidak dikenal');
  const mode = r.mode === 'offline' ? 'offline' : r.mode === 'online' ? 'online' : null;
  if (!mode) throw new Error('Mode interview tidak dikenal');
  const linkSource = mode === 'online' && r.linkSource === 'meet-auto' ? 'meet-auto' : 'manual';
  const url = mode === 'online' && linkSource === 'manual' ? link(r.url) : '';
  if (mode === 'online' && linkSource === 'manual' && !url) throw new Error('Tempel link meeting');
  const address = mode === 'offline' ? str(r.address) : '';
  if (mode === 'offline' && !address) throw new Error('Alamat kantor wajib diisi');
  const interviewer = str(r.interviewer);
  if (!interviewer) throw new Error('Nama pewawancara wajib diisi');
  const note = str(r.note);
  if (note.length > 500) throw new Error('Catatan maksimal 500 karakter');
  return { date, start, durationMin: durationMin as 30 | 45 | 60, mode, linkSource, url, address, interviewer, note };
}

// Jam WIB menjadi ISO UTC; penanda +07:00 karena server berjalan pada UTC / WIB time becomes ISO UTC; +07:00 because the server runs on UTC
export function interviewWindow(i: Pick<InterviewInput, 'date' | 'start' | 'durationMin'>): { startsAt: string; endsAt: string } {
  const startMs = new Date(`${i.date}T${i.start}:00+07:00`).getTime();
  return { startsAt: new Date(startMs).toISOString(), endsAt: new Date(startMs + i.durationMin * 60_000).toISOString() };
}

export function interviewTimeLabel(i: Pick<InterviewInput, 'date' | 'start' | 'durationMin'>): { day: string; time: string } {
  const { startsAt, endsAt } = interviewWindow(i);
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace(':', '.');
  const day = new Date(startsAt).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
  return { day, time: `${fmt(startsAt)}–${fmt(endsAt)} WIB` };
}

export function interviewMessage(x: { studentName: string; jobTitle: string; partnerName: string; interview: InterviewInput }): string {
  const { day, time } = interviewTimeLabel(x.interview);
  const where = x.interview.mode === 'offline' ? `Lokasi: ${x.interview.address}` : `Link meeting: ${x.interview.url}`;
  return [
    `Halo ${x.studentName}, terima kasih sudah melamar posisi ${x.jobTitle} di ${x.partnerName}.`,
    `Kamu diundang interview pada ${day}, pukul ${time} (${x.interview.mode === 'offline' ? 'tatap muka' : 'online'}).`,
    where,
    `Pewawancara: ${x.interview.interviewer}`,
    x.interview.note ? `Catatan: ${x.interview.note}` : '',
    'Mohon konfirmasi kehadiran lewat menu Karier di aplikasi Future Makers. Terima kasih.',
  ].filter(Boolean).join('\n');
}
