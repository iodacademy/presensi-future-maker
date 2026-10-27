import { describe, expect, it } from 'vitest';
import { planImport, type ImportInput, type SourceTask } from '../../src/features/exhibition/import-plan';

const classes = [
  { id: 'c-web', programName: 'Web Programming', city: 'Semarang' },
  { id: 'c-smm', programName: 'Social Media Marketing', city: 'Yogyakarta' },
];
const student = (uid: string, name: string, classId: string, extra = {}) =>
  ({ uid, name, classId, isTest: false, active: true, ...extra });
const f = (rel: string, ext = rel.split('.').pop() ?? '') => ({ rel, ext: ext ? '.' + ext : '', size: 1 });

const WEB = 'Web Programming - Semarang';
const SMM = 'Social Media Marketing - Yogyakarta';
const site = (taskFolder: string, url: string, person = 'Budi Santoso'): SourceTask => ({
  classFolder: WEB, personFolder: person, taskFolder, files: [], siteUrl: url, screenshot: 'tampilan-layar.png',
});
const visual = (files: string[], taskFolder = 'HP 3. Konten', person = 'Sari Dewi'): SourceTask => ({
  classFolder: SMM, personFolder: person, taskFolder, files: files.map((n) => f(`${SMM}/${person}/${taskFolder}/${n}`)),
  siteUrl: null, screenshot: null,
});

const base = (): ImportInput => ({
  classes,
  students: [student('u1', 'Budi Santoso', 'c-web'), student('u2', 'Sari Dewi', 'c-smm')],
  tasks: [], videoLinks: {}, existingSourceKeys: new Set(), existingPeople: new Set(),
});

describe('planImport', () => {
  it('Dapur Nia HP 1 dan HP 3 dengan URL sama menjadi satu karya di koleksi dapur-nia', () => {
    const p = planImport({ ...base(), tasks: [
      site('HP 1. Aplikasi', 'https://dapur-nia.vercel.app/?x=1'),
      site('HP 3. Aplikasi', 'https://dapur-nia.vercel.app'),
    ] });
    expect(p.works).toHaveLength(1);
    expect(p.works[0]).toMatchObject({
      type: 'Aplikasi Web', collectionKey: 'dapur-nia', title: 'Dapur Nia', cohort: 'web-smg',
      media: { kind: 'site', source: 'https://dapur-nia.vercel.app', slides: [] },
    });
    expect(p.collections).toEqual([{ key: 'dapur-nia', id: 'web-smg-dapur-nia', title: 'Dapur Nia', cohort: 'web-smg', type: 'Aplikasi Web' }]);
  });

  it('situs Canva dan tugas tanpa screenshot dilewati', () => {
    const noShot = { ...site('HP 9. Landing', 'https://a.com'), screenshot: null };
    const p = planImport({ ...base(), tasks: [site('HP 9. Landing', 'https://www.canva.com/design/x'), noShot] });
    expect(p.works).toEqual([]);
  });

  it('folder bahan mentah dilewati', () => {
    const t = visual(['03_Mentah_Video/a.mp4'], 'PM 2. X');
    const p = planImport({ ...base(), tasks: [t], videoLinks: { [t.files[0].rel]: 'https://drive.google.com/x' } });
    expect(p.works).toEqual([]);
  });

  it('satu folder gambar menjadi satu carousel berurutan', () => {
    const p = planImport({ ...base(), tasks: [visual(['k/a/10.png', 'k/a/2.png', 'k/a/1.png', 'k/a/tampilan-layar.png'])] });
    const d = `${SMM}/Sari Dewi/HP 3. Konten/k/a`;
    expect(p.works).toHaveLength(1);
    expect(p.works[0].media.slides).toEqual([`${d}/1.png`, `${d}/2.png`, `${d}/10.png`]);
    expect(p.works[0].coverSource).toBe(`${d}/1.png`);
    expect(p.works[0].sourceKey).toBe(`smm-yk/Sari Dewi/HP 3. Konten/${d}`);
    expect(p.works[0].type).toBe('Konten Feed');
  });

  it('video dengan tautan menjadi Reels', () => {
    const t = visual(['v1']);
    const p = planImport({ ...base(), tasks: [t], videoLinks: { [t.files[0].rel]: 'https://drive/1' } });
    expect(p.works[0]).toMatchObject({ type: 'Reels', media: { kind: 'video', source: 'https://drive/1' }, coverSource: t.files[0].rel });
  });

  it('nama berkas Gemini memberi label AI', () => {
    const p = planImport({ ...base(), tasks: [visual(['Gemini_Generated_Image_1.png', 'b.png'])] });
    expect(p.works[0].aiAssisted).toBe(true);
    expect(planImport({ ...base(), tasks: [visual(['b.png'])] }).works[0].aiAssisted).toBe(false);
  });

  it('impor ulang tidak menggandakan dan tidak menimpa', () => {
    const input = { ...base(), tasks: [site('HP 9. Landing', 'https://a.com'), visual(['a.png'])] };
    const first = planImport(input);
    expect(first.works.length).toBe(2);
    const again = planImport({ ...input, existingSourceKeys: new Set(first.works.map((w) => w.sourceKey)), existingPeople: new Set(first.newPeople.map((p) => p.uid)) });
    expect(again.works).toEqual([]);
    expect(again.newPeople).toEqual([]);
  });

  it('peserta tanpa folder tetap dibuatkan profil, peserta uji dilewati', () => {
    const input = { ...base(), students: [...base().students, student('u3', 'Tes Uji', 'c-web', { isTest: true }), student('u4', 'Off', 'c-web', { active: false })] };
    const p = planImport(input);
    expect(p.newPeople.map((x) => x.uid)).toEqual(['u1', 'u2']);
    expect(p.newPeople[0]).toMatchObject({ classId: 'c-web', cohort: 'web-smg', track: 'web', nickname: 'Budi' });
  });

  it('folder yang namanya tidak cocok dilaporkan, cocok sebagian diterima', () => {
    const p = planImport({ ...base(), tasks: [
      site('HP 9. L', 'https://a.com', 'Orang Asing'),
      site('HP 9. L', 'https://b.com', 'Budi'),
    ] });
    expect(p.unmatchedFolders).toEqual([`${WEB}/Orang Asing`]);
    expect(p.works).toHaveLength(1);
    expect(p.works[0].personUid).toBe('u1');
  });

  it('karya utama: capstone mengalahkan landing page, anggota koleksi paling akhir', () => {
    const cap: SourceTask = { classFolder: WEB, personFolder: 'Budi Santoso', taskFolder: 'CP 1. Capstone Project', files: [f(`${WEB}/Budi Santoso/CP 1. Capstone Project/laporan.pdf`)], siteUrl: null, screenshot: null };
    const p = planImport({ ...base(), tasks: [site('HP 1. A', 'https://dapur-nia.app'), site('HP 9. L', 'https://lp.app'), cap] });
    expect(p.mainWork.u1).toBe(p.works.find((w) => w.type === 'Capstone')!.sourceKey);
    const q = planImport({ ...base(), tasks: [site('HP 1. A', 'https://dapur-nia.app'), site('HP 9. L', 'https://lp.app')] });
    expect(q.mainWork.u1).toBe(q.works.find((w) => w.type === 'Landing Page')!.sourceKey);
    const r = planImport({ ...base(), tasks: [site('HP 1. A', 'https://dapur-nia.app')] });
    expect(r.mainWork.u1).toBe(r.works[0].sourceKey);
  });
  it('karya utama tetap dihitung untuk peserta yang sudah punya profil', () => {
    const p = planImport({ ...base(), existingPeople: new Set(['u1']), tasks: [site('HP 9. L', 'https://lp.app')] });
    expect(p.newPeople.map((x) => x.uid)).toEqual(['u2']);
    expect(p.mainWork.u1).toBe(p.works[0].sourceKey);
  });
});
