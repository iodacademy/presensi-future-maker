import { getAdminDb } from '@/lib/firebase/admin';
import { sendBridgeEmails } from '@/features/calendar/client';
import { getSnapshot } from '@/features/dashboard/snapshot-service';
import type { Actor } from '@/features/auth/types';
import {
  CATEGORY_LABELS, DEFAULT_TEMPLATES, emailHtml, emailStatus, planSend, renderTemplate, templateVars, validateTemplateInput,
  type EmailCategory, type EmailRow, type EmailTemplate,
} from './model';

const db = () => getAdminDb();
const templates = () => db().collection('emailTemplates');
const logs = () => db().collection('emailLogs');
const now = () => new Date().toISOString();

// Satu panggilan Apps Script dibatasi 45 detik; 20 email per panggilan aman di bawahnya
// One Apps Script call is capped at 45 seconds; 20 emails per call stays safely under it
const CHUNK = 20;
const MAX_RECIPIENTS = 300;
const URUT = Object.keys(CATEGORY_LABELS);

export async function listTemplates(): Promise<EmailTemplate[]> {
  const snap = await templates().get();
  if (snap.empty) {
    // Template awal dibuat sekali, lalu sepenuhnya milik admin / Starter templates are created once, then fully owned by admins
    const t = now();
    const batch = db().batch();
    for (const d of DEFAULT_TEMPLATES) batch.set(templates().doc(d.id), { ...d, updatedAt: t });
    await batch.commit();
    return DEFAULT_TEMPLATES.map((d) => ({ ...d, updatedAt: t }));
  }
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<EmailTemplate, 'id'>), id: d.id }))
    .sort((a, b) => URUT.indexOf(a.category) - URUT.indexOf(b.category) || a.name.localeCompare(b.name));
}

export async function saveTemplate(id: string | null, raw: unknown): Promise<string> {
  const input = validateTemplateInput(raw);
  if (!id) {
    const ref = templates().doc();
    await ref.set({ ...input, id: ref.id, updatedAt: now() });
    return ref.id;
  }
  const ref = templates().doc(id);
  if (!(await ref.get()).exists) throw new Error('Template tidak ditemukan');
  await ref.update({ ...input, updatedAt: now() });
  return id;
}

export async function deleteTemplate(id: string): Promise<void> {
  await templates().doc(id).delete();
}

export interface Recipient extends EmailRow {
  email: string;
  category: EmailCategory | null;
  label: string;
  /** templateId -> waktu terkirim terakhir / templateId -> last sent time */
  sent: Record<string, string>;
}

/**
 * Peserta aktif dengan status dari ringkasan dashboard, supaya status di email
 * selalu sama dengan yang dilihat admin di dashboard.
 *
 * Active participants with their status from the dashboard snapshot, so the
 * email status always matches what admins see on the dashboard.
 */
export async function listRecipients(actor: Actor): Promise<Recipient[]> {
  const [snapshot, users, terkirim] = await Promise.all([
    getSnapshot(actor),
    db().collection('users').where('role', '==', 'student').select('name', 'email').get(),
    logs().where('status', '==', 'terkirim').select('studentId', 'templateId', 'sentAt').get(),
  ]);
  const email = new Map(users.docs.map((u) => [u.id, String(u.get('email') ?? '')]));
  const sent = new Map<string, Record<string, string>>();
  for (const l of terkirim.docs) {
    const m = sent.get(l.get('studentId')) ?? {};
    const t = String(l.get('sentAt'));
    if (!m[l.get('templateId')] || m[l.get('templateId')] < t) m[l.get('templateId')] = t;
    sent.set(l.get('studentId'), m);
  }
  return snapshot.ranking.map((r) => {
    const row: EmailRow = {
      studentId: r.studentId, studentName: r.studentName, className: r.className, city: r.city,
      score: r.score, placement: r.placement, placementReasons: r.placementReasons ?? [],
    };
    return { ...row, ...emailStatus(row), email: email.get(r.studentId) ?? '', sent: sent.get(r.studentId) ?? {} };
  });
}

export interface SendResult { sent: number; failed: number; skipped: number; quota: number | null }

export async function sendEmails(actor: Actor, raw: unknown): Promise<SendResult> {
  const r = (raw ?? {}) as { templateId?: unknown; studentIds?: unknown; resend?: unknown };
  const ids = Array.isArray(r.studentIds) ? r.studentIds.filter((x): x is string => typeof x === 'string' && x !== '') : [];
  if (ids.length === 0) throw new Error('Pilih minimal satu peserta');
  if (ids.length > MAX_RECIPIENTS) throw new Error(`Maksimal ${MAX_RECIPIENTS} penerima sekali kirim`);
  const tsnap = await templates().doc(String(r.templateId ?? '')).get();
  if (!r.templateId || !tsnap.exists) throw new Error('Template tidak ditemukan');
  const template = { ...(tsnap.data() as EmailTemplate), id: tsnap.id };

  const daftar = new Map((await listRecipients(actor)).map((x) => [x.studentId, x]));
  const asing = ids.filter((id) => !daftar.has(id));
  if (asing.length) throw new Error(`Peserta tidak ditemukan: ${asing.length} akun`);
  const sudah = new Set([...daftar.values()].filter((x) => x.sent[template.id]).map((x) => x.studentId));
  const plan = planSend(ids, sudah, r.resend === true);

  let sent = 0;
  let failed = 0;
  let quota: number | null = null;
  for (let i = 0; i < plan.send.length; i += CHUNK) {
    const kelompok = plan.send.slice(i, i + CHUNK).map((id) => {
      const p = daftar.get(id)!;
      const vars = templateVars(p);
      const body = renderTemplate(template.body, vars);
      return { p, msg: { to: p.email, subject: renderTemplate(template.subject, vars), body, htmlBody: emailHtml(body) } };
    });
    const bisa = kelompok.filter((k) => k.msg.to);
    const hasil = new Map<string, { ok: boolean; error?: string }>();
    if (bisa.length) {
      try {
        const out = await sendBridgeEmails(bisa.map((k) => k.msg));
        quota = out.quota ?? quota;
        out.results.forEach((x, j) => hasil.set(bisa[j].p.studentId, x));
      } catch (e) {
        // Kegagalan satu kelompok dicatat per penerima, kelompok berikutnya tetap dicoba
        // A failed batch is logged per recipient; later batches are still attempted
        for (const k of bisa) hasil.set(k.p.studentId, { ok: false, error: (e as Error).message });
      }
    }
    const t = now();
    const batch = db().batch();
    for (const { p, msg } of kelompok) {
      const h = msg.to ? hasil.get(p.studentId) ?? { ok: false, error: 'Tidak ada balasan dari Apps Script' } : { ok: false, error: 'Akun tidak punya email' };
      if (h.ok) sent++; else failed++;
      batch.set(logs().doc(), {
        templateId: template.id, templateName: template.name, studentId: p.studentId, studentName: p.studentName,
        email: msg.to, className: p.className, subject: msg.subject, body: msg.body,
        status: h.ok ? 'terkirim' : 'gagal', error: h.ok ? '' : h.error ?? 'Gagal terkirim', sentAt: t, sentBy: actor.name || actor.uid,
      });
    }
    await batch.commit();
  }
  return { sent, failed, skipped: plan.skipped.length, quota };
}

/**
 * Kirim uji: template diisi dengan data satu peserta tetapi dikirim ke alamat
 * uji. Tidak dicatat di riwayat supaya peserta itu tidak dianggap sudah menerima.
 *
 * Test send: the template is filled with one participant's data but sent to a
 * test address. It is not logged, so that participant is not treated as having
 * received it.
 */
export async function sendTestEmail(actor: Actor, raw: unknown): Promise<{ quota: number | null }> {
  const r = (raw ?? {}) as { templateId?: unknown; studentId?: unknown; to?: unknown };
  const to = String(r.to ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('Alamat email uji tidak valid');
  const tsnap = await templates().doc(String(r.templateId ?? '')).get();
  if (!r.templateId || !tsnap.exists) throw new Error('Template tidak ditemukan');
  const template = tsnap.data() as EmailTemplate;
  const p = (await listRecipients(actor)).find((x) => x.studentId === r.studentId);
  if (!p) throw new Error('Peserta contoh tidak ditemukan');
  const vars = templateVars(p);
  const body = renderTemplate(template.body, vars);
  const out = await sendBridgeEmails([{ to, subject: `[UJI] ${renderTemplate(template.subject, vars)}`, body, htmlBody: emailHtml(body) }]);
  if (!out.results[0]?.ok) throw new Error(out.results[0]?.error || 'Email uji gagal terkirim');
  return { quota: out.quota };
}

export interface LogRow {
  id: string; templateId: string; templateName: string; studentId: string; studentName: string; email: string;
  className: string; subject: string; status: 'terkirim' | 'gagal'; error: string; sentAt: string; sentBy: string;
}

const LOG_FIELDS = ['templateId', 'templateName', 'studentId', 'studentName', 'email', 'className', 'subject', 'status', 'error', 'sentAt', 'sentBy'];

// Isi email tidak ikut di daftar; diambil satu per satu saat dibuka / Email bodies stay out of the list; fetched one at a time when opened
export async function listLogs(): Promise<LogRow[]> {
  const snap = await logs().orderBy('sentAt', 'desc').limit(1000).select(...LOG_FIELDS).get();
  return snap.docs.map((d) => ({ ...(Object.fromEntries(LOG_FIELDS.map((f) => [f, d.get(f) ?? ''])) as Omit<LogRow, 'id'>), id: d.id }));
}

export async function getLogBody(id: string): Promise<string> {
  const d = await logs().doc(id).get();
  if (!d.exists) throw new Error('Riwayat email tidak ditemukan');
  return String(d.get('body') ?? '');
}
