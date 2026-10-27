/**
 * Perencana impor murni: mengubah daftar berkas folder HASIL menjadi rancangan
 * karya, profil peserta, dan koleksi. Tanpa I/O; skrip yang menulis ke Firestore.
 *
 * Pure import planner: turns the HASIL folder listing into draft works, people
 * and collections. No I/O; the script does the Firestore writes.
 */
import { formatCanonicalClassName } from '../classes/policy';
import type { TrackKey } from './content';
import { cohortOf, nicknameOf, WORK_PRIORITY, type MediaKind } from './model';

export interface SourceFile { rel: string; ext: string; size: number }
export interface SourceTask {
  classFolder: string; personFolder: string; taskFolder: string; files: SourceFile[];
  siteUrl: string | null; screenshot: string | null;
}
export interface ImportInput {
  classes: { id: string; programName: string; city: string }[];
  students: { uid: string; name: string; classId: string; isTest: boolean; active: boolean }[];
  tasks: SourceTask[];
  videoLinks: Record<string, string>;
  existingSourceKeys: Set<string>;
  existingPeople: Set<string>;
}
export interface PlannedWork {
  sourceKey: string; personUid: string; classId: string; cohort: string; track: TrackKey; type: string;
  title: string; collectionKey: string | null; aiAssisted: boolean;
  media: { kind: MediaKind; source: string; slides: string[] }; coverSource: string | null;
}
export interface ImportPlan {
  newPeople: { uid: string; classId: string; cohort: string; track: TrackKey; nickname: string }[];
  works: PlannedWork[];
  mainWork: Record<string, string>;
  collections: { key: string; id: string; title: string; cohort: string; type: string }[];
  unmatchedFolders: string[];
}

type Mode = 'site' | 'pdf' | 'html' | 'ipynb' | 'visual';
interface Rule { cohort: string; re: RegExp; mode: Mode; type?: string; collection?: string }

// Aturan pertama yang cocok menang / The first matching rule wins
export const TASK_RULES: Rule[] = [
  { cohort: 'web-smg', re: /^HP [13]\. /, mode: 'site', type: 'Aplikasi Web', collection: 'dapur-nia' },
  { cohort: 'web-smg', re: /^HP 4\. /, mode: 'site', type: 'Aplikasi Web', collection: 'hris-sedap' },
  { cohort: 'web-smg', re: /^HP 9\. /, mode: 'site', type: 'Landing Page' },
  { cohort: 'web-smg', re: /^PM [12]\. /, mode: 'site', type: 'Aplikasi Web' },
  { cohort: 'web-smg', re: /^CP 1\. /, mode: 'pdf', type: 'Capstone' },
  { cohort: 'da-jkt', re: /^HP 9\. /, mode: 'html', type: 'Dashboard' },
  { cohort: 'da-jkt', re: /^HP 7\. /, mode: 'ipynb', type: 'Analisis Data' },
  { cohort: 'da-jkt', re: /^PM [12]\. /, mode: 'ipynb', type: 'Data Cleaning' },
  { cohort: 'smm-sby', re: /^(HP 6|HP 15|PM 1|PM 2)\. /, mode: 'visual' },
  { cohort: 'smm-sby', re: /^HP 12\. /, mode: 'pdf', type: 'Brand Identity' },
  { cohort: 'smm-sby', re: /^HP 16\. /, mode: 'pdf', type: 'Laporan Campaign' },
  { cohort: 'smm-yk', re: /^(HP 3|HP 16|PM 1|PM 2)\. /, mode: 'visual' },
];

const COLLECTIONS: Record<string, string> = { 'dapur-nia': 'Dapur Nia', 'hris-sedap': 'Portal HRIS Sedap' };
const IMAGE = /^\.(png|jpe?g|jfif|webp)$/i;
const SKIP = /mentah|scene|shot|proses|aset|asset|raw|storyboard/i;
const AI = /gemini_generated|chatgpt image|dall[-_ ]?e|midjourney/i;

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
const base = (rel: string) => rel.slice(rel.lastIndexOf('/') + 1);
const dirOf = (rel: string) => rel.slice(0, rel.lastIndexOf('/'));
const stem = (name: string) => name.replace(/\.[^.]*$/, '').replace(/_/g, ' ');
const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
const extOf = (f: SourceFile) => f.ext.toLowerCase();

function normUrl(u: string): string {
  try {
    const x = new URL(u.trim());
    return (x.origin + x.pathname).replace(/\/+$/, '');
  } catch {
    return u.trim().replace(/[?#].*$/, '').replace(/\/+$/, '');
  }
}

function siteTitle(url: string): string {
  let host = url;
  try { host = new URL(url).hostname; } catch { /* pakai apa adanya / use as-is */ }
  return host.split('.')[0].replace(/-/g, ' ').replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function matchPerson(folder: string, cands: ImportInput['students']) {
  const n = norm(folder);
  const exact = cands.filter((s) => norm(s.name) === n);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const part = cands.filter((s) => { const m = norm(s.name); return n && m && (m.includes(n) || n.includes(m)); });
  return part.length === 1 ? part[0] : null;
}

export function planImport(input: ImportInput): ImportPlan {
  const classByFolder = new Map(input.classes.map((c) => [formatCanonicalClassName(c.programName, c.city), c]));
  const plan: ImportPlan = { newPeople: [], works: [], mainWork: {}, collections: [], unmatchedFolders: [] };

  for (const c of input.classes) {
    const cohort = cohortOf(c);
    if (!cohort) continue;
    for (const s of input.students) {
      if (s.classId !== c.id || s.isTest || !s.active || input.existingPeople.has(s.uid)) continue;
      plan.newPeople.push({ uid: s.uid, classId: c.id, cohort: cohort.key, track: cohort.track, nickname: nicknameOf(s.name) });
    }
  }

  const seen = new Set<string>();
  const seenUnmatched = new Set<string>();
  const usedCollections = new Set<string>();
  const seenSites = new Set<string>();

  for (const t of input.tasks) {
    const cls = classByFolder.get(t.classFolder);
    const cohort = cls && cohortOf(cls);
    if (!cls || !cohort) continue;
    const person = matchPerson(t.personFolder, input.students.filter((s) => s.classId === cls.id && s.active && !s.isTest));
    if (!person) {
      const k = `${t.classFolder}/${t.personFolder}`;
      if (!seenUnmatched.has(k)) { seenUnmatched.add(k); plan.unmatchedFolders.push(k); }
      continue;
    }
    const rule = TASK_RULES.find((r) => r.cohort === cohort.key && r.re.test(t.taskFolder));
    if (!rule) continue;

    const prefix = `${t.classFolder}/${t.personFolder}/${t.taskFolder}/`;
    type Draft = Pick<PlannedWork, 'title' | 'aiAssisted' | 'media' | 'coverSource'> & { type?: string };
    const add = (unit: string, w: Draft) => {
      const sourceKey = `${cohort.key}/${t.personFolder}/${t.taskFolder}/${unit}`;
      if (seen.has(sourceKey) || input.existingSourceKeys.has(sourceKey)) return;
      seen.add(sourceKey);
      if (rule.collection) usedCollections.add(rule.collection);
      plan.works.push({
        ...w, sourceKey, personUid: person.uid, classId: cls.id, cohort: cohort.key, track: cohort.track,
        type: w.type ?? rule.type ?? '', collectionKey: rule.collection ?? null,
      });
    };
    const fileWork = (file: SourceFile, kind: MediaKind) => add(file.rel, {
      title: stem(base(file.rel)), aiAssisted: AI.test(base(file.rel)),
      media: { kind, source: file.rel, slides: [] }, coverSource: null,
    });

    if (rule.mode === 'site') {
      if (!t.siteUrl || !t.screenshot || /canva\./i.test(t.siteUrl)) continue;
      const url = normUrl(t.siteUrl);
      // URL sama antar tugas dihitung satu karya / The same URL across tasks counts as one work
      const siteKey = `${person.uid}|${url}`;
      if (seenSites.has(siteKey)) continue;
      seenSites.add(siteKey);
      add(url, {
        title: siteTitle(url), aiAssisted: false, media: { kind: 'site', source: url, slides: [] },
        coverSource: t.screenshot.includes('/') ? t.screenshot : prefix + t.screenshot,
      });
    } else if (rule.mode === 'pdf') {
      t.files.filter((f) => extOf(f) === '.pdf').forEach((f) => fileWork(f, 'pdf'));
    } else if (rule.mode === 'ipynb') {
      t.files.filter((f) => extOf(f) === '.ipynb').forEach((f) => fileWork(f, 'html'));
    } else if (rule.mode === 'html') {
      const big = t.files.filter((f) => extOf(f) === '.html').sort((a, b) => b.size - a.size)[0];
      if (big) fileWork(big, 'html');
    } else {
      const files = t.files.filter((f) => !SKIP.test(f.rel.slice(prefix.length)));
      const dirs = new Map<string, string[]>();
      for (const f of files) {
        if (!IMAGE.test(f.ext) || base(f.rel).startsWith('tampilan-')) continue;
        const d = dirOf(f.rel);
        dirs.set(d, [...(dirs.get(d) ?? []), f.rel]);
      }
      for (const [d, rels] of dirs) {
        const slides = rels.sort((a, b) => natural(base(a), base(b)));
        add(d, {
          title: stem(base(d)), aiAssisted: slides.some((s) => AI.test(base(s))),
          media: { kind: 'carousel', source: slides[0], slides }, coverSource: slides[0], type: 'Konten Feed',
        });
      }
      for (const f of files) {
        const link = input.videoLinks[f.rel];
        if (!link || IMAGE.test(f.ext)) continue;
        add(f.rel, {
          title: stem(base(f.rel)), aiAssisted: AI.test(base(f.rel)),
          media: { kind: 'video', source: link, slides: [] }, coverSource: f.rel, type: 'Reels',
        });
      }
    }
  }

  // Anggota koleksi paling akhir / Collection members rank last
  const rank = (w: PlannedWork) => (w.collectionKey ? 1000 : WORK_PRIORITY.includes(w.type) ? WORK_PRIORITY.indexOf(w.type) : 500);
  const best = new Map<string, PlannedWork>();
  for (const w of plan.works) {
    const cur = best.get(w.personUid);
    if (!cur || rank(w) < rank(cur)) best.set(w.personUid, w);
  }
  for (const [uid, w] of best) plan.mainWork[uid] = w.sourceKey;

  for (const key of usedCollections) {
    plan.collections.push({ key, id: `web-smg-${key}`, title: COLLECTIONS[key], cohort: 'web-smg', type: 'Aplikasi Web' });
  }
  return plan;
}
