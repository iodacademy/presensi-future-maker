// Model dan validasi Job Portal: mitra dan lowongan / Job Portal model and validation: partners and jobs
import { safeExternalUrl } from '../exhibition/model';

export type Employment = 'magang-3' | 'magang-6' | 'kontrak' | 'full-time';
export type Category = 'teknologi' | 'desain' | 'pemasaran' | 'administrasi';
export type WorkMode = 'hybrid' | 'wfo' | 'remote';
export type DocRule = 'required' | 'optional' | 'off';
export type QuestionKind = 'long' | 'yes-no' | 'choice';
export type JobStatus = 'draft' | 'published';
export type JobState = 'draft' | 'terjadwal' | 'aktif' | 'ditutup';

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
  partnerId: string; title: string; employment: Employment; category: Category; location: string; workMode: WorkMode;
  quota: number; description: string; qualifications: string[]; eligibility: Eligibility;
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
    partnerId, title, location, quota, opensAt, closesAt,
    employment: oneOf<Employment>(r.employment, EMPLOYMENT_LABELS, 'Jenis lowongan tidak dikenal'),
    category: oneOf<Category>(r.category, CATEGORY_LABELS, 'Bidang lowongan tidak dikenal'),
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
