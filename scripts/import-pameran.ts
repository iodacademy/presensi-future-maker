/**
 * Mengimpor karya peserta dari TUGAS/HASIL ke Firestore (status draft) dan
 * Storage. Tanpa --apply hanya mencetak pratinjau dan tidak menulis apa pun.
 *
 * Imports participant works from TUGAS/HASIL into Firestore (draft status) and
 * Storage. Without --apply it only prints a preview and writes nothing.
 *
 * Pemakaian / Usage:
 *   npm run import-pameran              (pratinjau / preview)
 *   npm run import-pameran -- --apply   (tulis / write)
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';
import type { Firestore, WriteBatch } from 'firebase-admin/firestore';
import { getAdminDb } from '../src/lib/firebase/admin';
import { formatCanonicalClassName } from '../src/features/classes/policy';
import { planImport, rankWork, type PlannedWork, type SourceFile, type SourceTask } from '../src/features/exhibition/import-plan';
import { storeHtml, storeImage, storePdf } from '../src/features/exhibition/media';
import { notebookToHtml } from '../src/features/exhibition/notebook-html';
import { cohortOf, type WorkCover, type WorkMedia } from '../src/features/exhibition/model';

const ROOT = path.resolve('TUGAS/HASIL');
const SKIP_DIR = new Set(['node_modules', '.git']);
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const subdirs = (d: string) => fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
type Op = (b: WriteBatch) => void;

function listFiles(dir: string, relDir: string, out: SourceFile[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('~$') || SKIP_DIR.has(e.name)) continue;
    const full = path.join(dir, e.name);
    const rel = `${relDir}/${e.name}`;
    if (e.isDirectory()) listFiles(full, rel, out);
    else out.push({ rel, ext: path.extname(e.name), size: fs.statSync(full).size });
  }
}

function readTasks(): SourceTask[] {
  const tasks: SourceTask[] = [];
  for (const classFolder of subdirs(ROOT)) {
    for (const personFolder of subdirs(path.join(ROOT, classFolder))) {
      for (const taskFolder of subdirs(path.join(ROOT, classFolder, personFolder))) {
        const dir = path.join(ROOT, classFolder, personFolder, taskFolder);
        const files: SourceFile[] = [];
        listFiles(dir, `${classFolder}/${personFolder}/${taskFolder}`, files);
        const linkFile = path.join(dir, 'link.url');
        const siteUrl = fs.existsSync(linkFile) ? (/URL=(.+)/.exec(fs.readFileSync(linkFile, 'utf8'))?.[1]?.trim() ?? null) : null;
        const screenshot = fs.existsSync(path.join(dir, 'tampilan-layar.png')) ? 'tampilan-layar.png' : null;
        tasks.push({ classFolder, personFolder, taskFolder, files, siteUrl, screenshot });
      }
    }
  }
  // Urutan tetap agar sourceKey URL bersama stabil antar-jalankan / Fixed order keeps shared-URL sourceKeys stable across runs
  return tasks.sort((a, b) => cmp(a.classFolder, b.classFolder) || cmp(a.personFolder, b.personFolder) || cmp(a.taskFolder, b.taskFolder));
}

function readVideoLinks(): Record<string, string> {
  const j = JSON.parse(fs.readFileSync(path.resolve('TUGAS/_alat/video_drive.json'), 'utf8')) as {
    videos: Record<string, { link: string }>; paths: Record<string, string>;
  };
  const out: Record<string, string> = {};
  for (const [rel, sha] of Object.entries(j.paths)) if (j.videos[sha]) out[rel.replace(/\\/g, '/')] = j.videos[sha].link;
  return out;
}

// ---- Media (hanya saat --apply / only on --apply) ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pameran-'));
const local = (rel: string) => path.join(ROOT, rel);
interface Page { goto(u: string, o: object): Promise<unknown>; waitForTimeout(n: number): Promise<void>; screenshot(): Promise<Buffer>; close(): Promise<void> }
let browser: { newPage(o: object): Promise<Page>; close(): Promise<void> } | null = null;

async function shotOfFile(file: string): Promise<Buffer> {
  if (!browser) {
    // Playwright dipasang global, seperti tangkap_layar.cjs / Playwright is installed globally, as in tangkap_layar.cjs
    const { chromium } = createRequire(import.meta.url)(path.join(process.env.APPDATA ?? '', 'npm/node_modules/playwright'));
    browser = await chromium.launch();
  }
  const page = await browser!.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1500);
    return await page.screenshot();
  } finally { await page.close(); }
}

function run(cmd: string, args: string[]) {
  if (spawnSync(cmd, args, { stdio: 'ignore' }).status !== 0) throw new Error(`${cmd} gagal / failed`);
}

async function buildMedia(w: PlannedWork, id: string): Promise<{ media: WorkMedia; cover: WorkCover }> {
  const folder = `karya/${id}`;
  const m = w.media;
  if (m.kind === 'site') {
    const cover = w.coverSource ? await storeImage(fs.readFileSync(local(w.coverSource)), folder) : { thumb: '', full: '' };
    return { media: { kind: 'site', url: m.source, slides: [] }, cover };
  }
  if (m.kind === 'html') {
    const file = local(m.source);
    let buf = fs.readFileSync(file);
    let shotFile = file;
    if (/\.ipynb$/i.test(file)) {
      buf = Buffer.from(notebookToHtml(buf.toString('utf8'), w.title));
      shotFile = path.join(tmp, `${id}.html`);
      fs.writeFileSync(shotFile, buf);
    }
    const url = await storeHtml(buf, folder);
    return { media: { kind: 'html', url, slides: [] }, cover: await storeImage(await shotOfFile(shotFile), folder) };
  }
  if (m.kind === 'pdf') {
    const url = await storePdf(fs.readFileSync(local(m.source)), folder);
    run('pdftoppm', ['-f', '1', '-l', '1', '-r', '80', '-png', local(m.source), path.join(tmp, id)]);
    const png = fs.readdirSync(tmp).find((n) => n.startsWith(`${id}-`) && n.endsWith('.png'));
    if (!png) throw new Error('pdftoppm tidak menghasilkan gambar / produced no image');
    return { media: { kind: 'pdf', url, slides: [] }, cover: await storeImage(fs.readFileSync(path.join(tmp, png)), folder) };
  }
  if (m.kind === 'carousel') {
    if (!m.slides.length) throw new Error('carousel tanpa slide / carousel has no slides');
    const covers: WorkCover[] = [];
    for (const s of m.slides) covers.push(await storeImage(fs.readFileSync(local(s)), folder));
    return { media: { kind: 'carousel', url: '', slides: covers.map((c) => c.full) }, cover: covers[0] };
  }
  if (!w.coverSource) throw new Error('video tanpa berkas sumber / video has no source file');
  const out = path.join(tmp, `${id}.png`);
  run('ffmpeg', ['-y', '-ss', '1', '-i', local(w.coverSource), '-frames:v', '1', out]);
  return { media: { kind: 'video', url: m.source, slides: [] }, cover: await storeImage(fs.readFileSync(out), folder) };
}

async function commitChunks(db: Firestore, ops: Op[]) {
  for (let i = 0; i < ops.length; i += 500) {
    const b = db.batch();
    ops.slice(i, i + 500).forEach((op) => op(b));
    await b.commit();
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const db = getAdminDb();
  const tasks = readTasks();
  const videoLinks = readVideoLinks();

  const [classSnap, userSnap, workSnap, peopleSnap] = await Promise.all([
    db.collection('classes').select('programName', 'city').get(),
    db.collection('users').where('role', '==', 'student').select('name', 'classId', 'isTest', 'active').get(),
    db.collection('exhibitionWorks').select('sourceKey').get(),
    db.collection('exhibitionPeople').select('mainWorkId').get(),
  ]);
  const classes = classSnap.docs.map((d) => ({ id: d.id, programName: String(d.get('programName') ?? ''), city: String(d.get('city') ?? '') }));
  const students = userSnap.docs.map((d) => ({
    uid: d.id, name: String(d.get('name') ?? ''), classId: String(d.get('classId') ?? ''), isTest: d.get('isTest') === true, active: d.get('active') !== false,
  }));
  const existingMain = new Map(peopleSnap.docs.map((d) => [d.id, d.get('mainWorkId') ?? null]));
  const plan = planImport({
    classes, students, tasks, videoLinks,
    existingSourceKeys: new Set(workSnap.docs.map((d) => d.get('sourceKey')).filter((k): k is string => typeof k === 'string')),
    existingPeople: new Set(existingMain.keys()),
  });

  const knownFolders = new Set(classes.map((c) => formatCanonicalClassName(c.programName, c.city)));
  const unmatchedClassFolders = subdirs(ROOT).filter((f) => !knownFolders.has(f));

  console.log(`Mode: ${apply ? 'APPLY (menulis / writing)' : 'PRATINJAU / PREVIEW (tidak menulis / no writes)'}`);
  console.log(`Tugas dibaca: ${tasks.length}; peserta baru: ${plan.newPeople.length}; karya baru: ${plan.works.length}; koleksi: ${plan.collections.length}`);
  const tally = (keys: string[]) => {
    const m = new Map<string, number>();
    keys.forEach((k) => m.set(k, (m.get(k) ?? 0) + 1));
    [...m].sort((a, b) => cmp(a[0], b[0])).forEach(([k, n]) => console.log(`  ${k}: ${n}`));
  };
  console.log('\nKarya per angkatan dan jenis:');
  tally(plan.works.map((w) => `${w.cohort} / ${w.type}`));
  console.log('\nPeserta baru per angkatan:');
  tally(plan.newPeople.map((p) => p.cohort));
  console.log(`\nunmatchedFolders (${plan.unmatchedFolders.length}):`);
  plan.unmatchedFolders.forEach((f) => console.log(`  ${f}`));
  console.log(`\nFolder kelas tanpa kelas cocok (${unmatchedClassFolders.length}):`);
  unmatchedClassFolders.forEach((f) => console.log(`  ${f}`));
  console.log('\n20 karya pertama:');
  plan.works.slice(0, 20).forEach((w) => console.log(`  [${w.cohort}] ${w.type} | ${w.title} | ${w.media.kind} | ${w.sourceKey}`));

  if (!apply) {
    console.log('\nIni pratinjau -- tidak ada yang ditulis. Jalankan ulang dengan --apply untuk menulis.');
    return;
  }

  const now = new Date().toISOString();
  // Orang dan koleksi dulu, agar karya yang masuk selalu punya induk / People and collections first so every work has a parent
  const peopleOps: Op[] = plan.newPeople.map((p) => (b) => b.set(db.collection('exhibitionPeople').doc(p.uid), {
    classId: p.classId, cohort: p.cohort, track: p.track, nickname: p.nickname, photoUrl: '', bio: '', skills: [],
    linkedinUrl: '', portfolioUrl: '', visible: true, mainWorkId: null, updatedAt: now,
  }));
  // Koleksi yang sudah ada tidak ditimpa / Existing collections are never overwritten
  const colRefs = plan.collections.map((c) => db.collection('exhibitionCollections').doc(c.id));
  const colExists = colRefs.length ? await db.getAll(...colRefs) : [];
  const colOps: Op[] = plan.collections.filter((_, i) => !colExists[i].exists).map((c) => (b) => b.set(db.collection('exhibitionCollections').doc(c.id), {
    title: c.title, brief: '', classId: classes.find((k) => cohortOf(k)?.key === c.cohort)?.id ?? '', cohort: c.cohort, type: c.type, coverUrls: [],
  }));
  await commitChunks(db, [...peopleOps, ...colOps]);

  // Tiap karya langsung ditulis setelah medianya jadi; id dari sourceKey, jadi jalan ulang menimpa objek yang sama
  // Each work is written right after its media is built; the id derives from sourceKey, so a re-run overwrites the same objects
  let written = 0;
  let failed = 0;
  for (const w of plan.works) {
    const id = crypto.createHash('sha1').update(w.sourceKey).digest('hex').slice(0, 20);
    try {
      const { media, cover } = await buildMedia(w, id);
      await db.collection('exhibitionWorks').doc(id).set({
        personUid: w.personUid, classId: w.classId, cohort: w.cohort, track: w.track, type: w.type, title: w.title,
        description: '', tools: [], status: 'draft', aiAssisted: w.aiAssisted,
        collectionId: w.collectionKey ? `${w.cohort}-${w.collectionKey}` : null,
        cover, media, sourceKey: w.sourceKey, createdAt: now, updatedAt: now,
      });
      written += 1;
      console.log(`ok   ${w.sourceKey}`);
    } catch (err) {
      failed += 1;
      console.error(`GAGAL ${w.sourceKey}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Karya utama dihitung dari semua karya yang tersimpan, hanya untuk peserta yang belum punya
  // Main work is computed from every stored work, only for people who have none yet
  const needsMain = new Set([...existingMain].filter(([, v]) => v === null).map(([k]) => k));
  plan.newPeople.forEach((p) => needsMain.add(p.uid));
  const all = await db.collection('exhibitionWorks').select('personUid', 'type', 'collectionId', 'sourceKey').get();
  const best = new Map<string, { id: string; rank: number; key: string }>();
  for (const d of all.docs) {
    const uid = String(d.get('personUid'));
    if (!needsMain.has(uid)) continue;
    const cand = { id: d.id, rank: rankWork({ type: String(d.get('type') ?? ''), collectionId: (d.get('collectionId') as string | null) ?? null }), key: String(d.get('sourceKey') ?? '') };
    const cur = best.get(uid);
    if (!cur || cand.rank < cur.rank || (cand.rank === cur.rank && cand.key < cur.key)) best.set(uid, cand);
  }
  const mainOps: Op[] = [...best].map(([uid, w]) => (b) => b.set(db.collection('exhibitionPeople').doc(uid), { mainWorkId: w.id, updatedAt: now }, { merge: true }));
  await commitChunks(db, mainOps);

  console.log(`\nSelesai: ${written} karya, ${peopleOps.length} peserta, ${colOps.length} koleksi, ${mainOps.length} karya utama; ${failed} gagal.`);
}

main()
  .then(async () => { await browser?.close(); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(0); })
  .catch((err) => { console.error('Gagal:', err instanceof Error ? err.message : err); process.exit(1); });
