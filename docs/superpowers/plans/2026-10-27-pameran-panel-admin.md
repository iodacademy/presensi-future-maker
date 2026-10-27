# Panel Admin dan Data Asli Website Pameran Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the exhibition's generated sample data with real participant works stored in Firestore, filled by a local import script and curated in a new admin "Pameran" panel.

**Architecture:** Four Firestore collections (`exhibitionPeople`, `exhibitionWorks`, `exhibitionCollections`, `exhibitionSite`) hold the data. Public pages become server components that read through one cached read module (`unstable_cache`, tag `pameran`, 300 s) and hand plain props to the existing client views. Admin edits go through `/api/pameran/*` routes that check the admin role and call `revalidateTag('pameran')`. A local `tsx` script turns `TUGAS/HASIL` into draft works, uploading media to Storage under `pameran/`.

**Tech Stack:** Next.js 15 App Router, React 19, firebase-admin (Firestore and Storage), sharp, vitest with jsdom and @testing-library/react, tsx scripts, poppler `pdftoppm`, ffmpeg, Playwright (global npm install, as in `TUGAS/_alat/tangkap_layar.cjs`).

**Spec:** `docs/superpowers/specs/2026-10-27-pameran-panel-admin-design.md`

## Global Constraints

- Every code comment is bilingual: Indonesian first, then English (`// indo / english`, or Indonesian block then English block). Tool markers (`eslint-disable`, `TODO:`, `ponytail:`) stay in English.
- Public pages never receive a participant's full name. Only `nickname` leaves the server on public paths.
- Firestore list reads use `.select(...)` with only the fields the caller shows. Long text (`description`, `bio`) and `media` are never in list reads.
- Images go to Storage as WebP: full size max width 1600 px, card thumbnail width 640 px. Every Storage object gets `cacheControl: 'public, max-age=31536000, immutable'` and a content-hashed name.
- HTML files are stored gzip-compressed with `contentEncoding: 'gzip'` and `contentType: 'text/html; charset=utf-8'`.
- Iframes for sites and HTML use exactly `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"` and load only after the visitor presses "Coba langsung".
- Public read cache: `unstable_cache(..., { tags: ['pameran'], revalidate: 300 })`. Every admin write calls `revalidateTag('pameran')`.
- Fixed UI copy: "Dibuat dengan bantuan AI", "Coba langsung", "Buka demo", "Terbitkan semua yang tampil", "Pameran" (sidebar label).
- Work types per track. web: `Landing Page`, `Aplikasi Web`, `Capstone`. da: `Dashboard`, `Data Cleaning`, `Analisis Data`. smm: `Konten Feed`, `Reels`, `Brand Identity`, `Laporan Campaign`.
- Main-work priority: `Capstone`, `Landing Page`, `Aplikasi Web` outside a collection, `Dashboard`, `Konten Feed`, `Reels`, then any other type, then collection members.
- Do not push. Commits stay on local `main` until the owner says the data is complete (memory: pameran-launch-hold). Never commit `TUGAS/`.
- Firestore batches hold at most 500 writes.

## Review Focus

1. A participant whose stored name is one word, or whose `nickname` is empty: the import stores the first word of the name (Task 1 `nicknameOf` test) and public reads show `'Peserta'` for an empty one, never the full name (Task 3 test).
2. A published work whose cover is empty or whose site is dead: the card shows the type placeholder, and the detail page still renders with the "Buka demo" link. Test in Task 11.
3. "Terbitkan semua yang tampil" over more than 500 works: the update is split into batches and every id is updated. Test in Task 4.
4. Re-running the import after the admin edited titles and statuses: no work is duplicated and no admin edit is overwritten. Test in Task 7.
5. A person switched to `visible: false` while their works are published: those works vanish from the gallery, collections, and work pages, and `/peserta/<uid>` returns 404. Test in Task 3.

---

### Task 1: Model, types, and track definitions

**Files:**
- Create: `src/features/exhibition/model.ts`
- Modify: `src/features/exhibition/content.ts` (TRACKS `types`/`outputs`, TYPE map, COHORTS)
- Test: `tests/unit/exhibition-model.test.ts`

**Interfaces:**
- Produces (in `model.ts`):
  - `type WorkStatus = 'draft' | 'published' | 'hidden'`
  - `type MediaKind = 'site' | 'html' | 'carousel' | 'video' | 'pdf'`
  - `interface WorkMedia { kind: MediaKind; url: string; slides: string[] }` (`url` empty for carousel, `slides` empty otherwise)
  - `interface WorkCover { thumb: string; full: string }` (empty strings when none)
  - `interface ExhibitionWork { id: string; personUid: string; classId: string; cohort: string; track: TrackKey; type: string; title: string; description: string; tools: string[]; status: WorkStatus; aiAssisted: boolean; collectionId: string | null; cover: WorkCover; media: WorkMedia; sourceKey: string | null; createdAt: string; updatedAt: string }`
  - `interface ExhibitionPerson { uid: string; classId: string; cohort: string; track: TrackKey; nickname: string; photoUrl: string; bio: string; skills: string[]; linkedinUrl: string; portfolioUrl: string; visible: boolean; mainWorkId: string | null; updatedAt: string }`
  - `interface ExhibitionCollection { id: string; title: string; brief: string; classId: string; cohort: string; type: string; coverUrls: string[] }`
  - `interface SiteContent { photos: Record<string, string>; videos: { afterMovie: string; peserta: Record<string, string>; trainer: Record<TrackKey, string>; plan: string }; testiPeserta: Record<string, string>; testiTrainer: { track: TrackKey; name: string; quote: string }[]; testiPlan: { name: string; role: string; quote: string } }`
  - `interface GalleryCard { id: string; title: string; type: string; cohort: string; track: TrackKey; personUid: string; nickname: string; thumb: string; aiAssisted: boolean; collectionId: string | null }`
  - `interface CollectionCard { id: string; title: string; cohort: string; type: string; coverUrls: string[]; count: number; nicknames: string[] }`
  - `type GalleryItem = { kind: 'work'; card: GalleryCard } | { kind: 'collection'; collection: CollectionCard }`
  - `const WORK_PRIORITY: string[]` (Global Constraints order, without the collection rule)
  - `function cohortOf(cls: { programName: string; city: string }): Cohort | null`
  - `function nicknameOf(fullName: string): string` (first whitespace-separated word, trimmed)
- `content.ts` keeps `Cohort` but drops `n`; every reader of `Cohort.n` switches to counts from the catalog (Task 11 and 12).

- [ ] **Step 1: Write the failing test** `tests/unit/exhibition-model.test.ts`

```ts
expect(cohortOf({ programName: 'Web Programming', city: 'Semarang' })?.key).toBe('web-smg');
expect(cohortOf({ programName: 'Data Analyst', city: 'DKI Jakarta' })?.key).toBe('da-jkt');
expect(cohortOf({ programName: 'Social Media Marketing', city: 'Yogyakarta' })?.key).toBe('smm-yk');
expect(cohortOf({ programName: 'Social Media Marketing', city: 'Surabaya' })?.key).toBe('smm-sby');
expect(cohortOf({ programName: 'Web Programming', city: 'Bandung' })).toBeNull();
expect(nicknameOf('  Adinda Puan Maharani ')).toBe('Adinda');
expect(nicknameOf('Velssy')).toBe('Velssy');
expect(TRACKS.web.types).toEqual(['Landing Page', 'Aplikasi Web', 'Capstone']);
expect(TRACKS.da.types).toEqual(['Dashboard', 'Data Cleaning', 'Analisis Data']);
expect(TRACKS.smm.types).toEqual(['Konten Feed', 'Reels', 'Brand Identity', 'Laporan Campaign']);
expect(Object.keys(TYPE)).not.toContain('REST API');
expect(TYPE['Dashboard'].tools).toEqual(['Python', 'HTML']);
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/exhibition-model.test.ts`. Expected: FAIL, `model` module not found.

- [ ] **Step 3: Implement** `model.ts` and update `content.ts`. `cohortOf` maps `programName` to track by exact name (`Web Programming`→web, `Data Analyst`→da, `Social Media Marketing`→smm) and matches `city` against `COHORTS[].city` case-insensitively. TYPE entries for new types: `Capstone` (kind `pdf`, thumb `Dokumen capstone`), `Konten Feed` (kind `social`), `Reels` (kind `social`), `Brand Identity` and `Laporan Campaign` (kind `pdf`). Remove `REST API`, `Kalender Konten`. Leave `DATA`/`build()` in place for now; Task 12 removes them.

- [ ] **Step 4: Run** `npx vitest run tests/unit/exhibition-model.test.ts tests/unit/exhibition-content.test.ts`. Expected: model PASS. If `exhibition-content.test.ts` fails only because the sample generator now draws different types, update its expected first three works to the new output; Task 12 deletes that test.

- [ ] **Step 5: Commit** `git commit -m "Pameran: model data asli dan jenis karya sesuai tugas peserta"`

---

### Task 2: Gallery rotation order

**Files:**
- Create: `src/features/exhibition/gallery-order.ts`
- Test: `tests/unit/exhibition-gallery-order.test.ts`

**Interfaces:**
- Consumes: `GalleryCard`, `CollectionCard`, `GalleryItem`, `WORK_PRIORITY` from Task 1.
- Produces: `function orderGallery(input: { people: { uid: string; mainWorkId: string | null }[]; cards: GalleryCard[]; collections: CollectionCard[] }, wibDate: string): GalleryItem[]`

Rules the function implements:
1. Per person, sort that person's cards: main work first (if published, i.e. present in `cards`), then by `WORK_PRIORITY` index, then collection members last, then by id.
2. Collection members never appear as `work` items, except a member that is its person's first card (their main or only work).
3. Round r holds the r-th remaining card of every person. Within a round, shuffle with a PRNG seeded from `wibDate` (mulberry32 over a 32-bit string hash), then reorder greedily: take the next card whose `type` and `cohort` both differ from the previous item; if none, take the next card.
4. All collection items are inserted at the start of round 2, in collection id order.

- [ ] **Step 1: Write the failing tests**

```ts
it('setiap peserta muncul di putaran pertama', () => {
  const items = orderGallery(fixture, '2026-10-27');
  const first = items.slice(0, fixture.people.length).map((i) => i.kind === 'work' && i.card.personUid);
  expect(new Set(first)).toEqual(new Set(fixture.people.map((p) => p.uid)));
});
it('kartu bersebelahan beda jenis dan beda kelas bila memungkinkan', () => { /* fixture with 2 cohorts × 2 types, 8 people: no adjacent pair in round 1 shares type or cohort */ });
it('urutan sama untuk tanggal sama, berbeda untuk tanggal lain', () => {
  expect(orderGallery(fixture, '2026-10-27')).toEqual(orderGallery(fixture, '2026-10-27'));
  expect(orderGallery(fixture, '2026-10-28')).not.toEqual(orderGallery(fixture, '2026-10-27'));
});
it('anggota koleksi hanya tampil sendiri bila jadi karya pertama pesertanya', () => { /* person A: only a dapur-nia member → appears as work in round 1; person B: landing page + dapur-nia member → member absent from work items */ });
it('kartu koleksi muncul tepat setelah putaran pertama', () => { /* index of first collection item === people count */ });
it('karya utama pilihan admin dipakai lebih dulu', () => { /* person with mainWorkId pointing to Reels and also a Capstone → Reels in round 1 */ });
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/exhibition-gallery-order.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `orderGallery` in `gallery-order.ts`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Pameran: urutan galeri bergiliran per peserta, berganti setiap hari"`

---

### Task 3: Public read module

**Files:**
- Create: `src/features/exhibition/read.ts`
- Test: `tests/unit/exhibition-read.test.ts`

**Interfaces:**
- Consumes: Task 1 types, `getAdminDb` from `src/lib/firebase/admin`.
- Produces (all wrapped in `unstable_cache` with tag `pameran`, `revalidate: 300`):
  - `interface Catalog { people: PublicPerson[]; cards: GalleryCard[]; collections: CollectionCard[] }`
  - `interface PublicPerson { uid: string; nickname: string; cohort: string; track: TrackKey; photoUrl: string; mainWorkId: string | null; workCount: number }`
  - `getCatalog(): Promise<Catalog>`
  - `getWorkDetail(id: string): Promise<(GalleryCard & { description: string; tools: string[]; media: WorkMedia; coverFull: string; collection: { id: string; title: string } | null }) | null>`
  - `getPersonDetail(uid: string): Promise<(PublicPerson & { bio: string; skills: string[]; linkedinUrl: string; portfolioUrl: string; works: GalleryCard[] }) | null>`
  - `getCollectionDetail(id: string): Promise<{ collection: ExhibitionCollection; versions: (GalleryCard & { siteUrl: string })[] } | null>`
  - `getSiteContent(): Promise<SiteContent>` (stored doc merged over defaults built from the current `PHOTOS`, `VIDEOS`, `TESTI_P`, `TESTI_T`, `TESTI_PLAN`)
  - `function todayWib(): string` (`YYYY-MM-DD` via the existing `wibDate` in `src/lib/time`)

`getCatalog` reads `exhibitionPeople` where `visible == true` with select of `nickname, cohort, track, photoUrl, mainWorkId`; `exhibitionWorks` where `status == 'published'` with select of the `GalleryCard` source fields plus `cover.thumb`; `exhibitionCollections` with select of `title, cohort, type, coverUrls`. Cards of people not in the visible set are dropped. The read never touches `users`, so a full name cannot leak. The import (Task 7) and the people form (Task 5) always store a nickname; for an empty one the read falls back to `'Peserta'`. Collections with zero visible published members are dropped.

- [ ] **Step 1: Write the failing tests** with the fake Firestore pattern from `tests/unit/student-detail.test.ts` (extended so `select()` keeps only the listed fields, to prove no extra field leaks) and `vi.mock('next/cache', () => ({ unstable_cache: (fn) => fn, revalidateTag: vi.fn() }))`:

```ts
it('katalog hanya memuat karya terbit milik peserta yang tampil', ...);          // draft, hidden, and invisible-owner works absent
it('tidak ada nama lengkap atau kolom panjang di katalog', async () => {
  const json = JSON.stringify(await getCatalog());
  expect(json).not.toContain('Maharani');            // users.name in the fake db is 'Adinda Puan Maharani'
  expect(json).not.toContain('description');
  expect(json).not.toContain('"bio"');
});
it('peserta disembunyikan: profil dan karyanya tidak dapat dibuka', async () => {
  expect(await getPersonDetail('hidden-uid')).toBeNull();
  expect(await getWorkDetail('work-of-hidden')).toBeNull();
});
it('nickname kosong ditampilkan sebagai Peserta', ...);
it('peserta tanpa karya tetap ada di katalog dengan workCount 0', ...);
it('konten situs memakai default bila dokumen belum ada', async () => {
  expect((await getSiteContent()).testiPlan.role).toBe('Yayasan Plan International Indonesia');
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/exhibition-read.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `read.ts` (add `import 'server-only'` only if the package is already installed; otherwise skip it).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Pameran: modul baca publik ber-cache untuk katalog, karya, peserta, koleksi"`

---

### Task 4: Admin works service and API

**Files:**
- Create: `src/features/exhibition/admin-works.ts`
- Create: `src/app/api/pameran/works/route.ts` (GET list, POST create)
- Create: `src/app/api/pameran/works/[id]/route.ts` (GET one, PATCH)
- Create: `src/app/api/pameran/works/bulk/route.ts` (POST)
- Test: `tests/unit/exhibition-admin-works.test.ts`

**Interfaces:**
- Produces:
  - `interface AdminWorkRow { id: string; title: string; type: string; cohort: string; personUid: string; nickname: string; status: WorkStatus; aiAssisted: boolean; collectionId: string | null; thumb: string }`
  - `type WorkInput = Pick<ExhibitionWork, 'personUid' | 'type' | 'title' | 'description' | 'tools' | 'aiAssisted' | 'collectionId' | 'cover' | 'media'>`
  - `type BulkPatch = Partial<Pick<ExhibitionWork, 'status' | 'aiAssisted' | 'collectionId'>>`
  - `listWorks(): Promise<AdminWorkRow[]>` (select only row fields; nickname joined from `exhibitionPeople` read once)
  - `getWork(id: string): Promise<ExhibitionWork | null>`
  - `createWork(input: WorkInput): Promise<string>` (status `draft`; `classId`, `cohort`, `track` copied from the person doc; `sourceKey: null`)
  - `updateWork(id: string, patch: Partial<WorkInput & { status: WorkStatus }>): Promise<void>`
  - `bulkUpdateWorks(ids: string[], patch: BulkPatch): Promise<number>` (chunks of 500 per batch, returns count)
  - Each write sets `updatedAt` and calls `revalidateTag('pameran')`.
- Routes: same 403 check as `src/app/api/uploads/exam-image/route.ts` (`actor.role !== 'admin'`). Errors return `{ error }` with status 400. Bulk body: `{ ids: string[]; patch: BulkPatch }`; reject `ids` longer than 5000 and unknown patch keys.

- [ ] **Step 1: Write the failing tests** (fake Firestore with `batch()` that records `update` calls and `commit` count; `next/cache` mocked):

```ts
it('terbitkan 1.200 karya dipecah menjadi 3 batch dan semua terbarui', async () => {
  const n = await bulkUpdateWorks(ids1200, { status: 'published' });
  expect(n).toBe(1200);
  expect(commits).toBe(3);
  expect(revalidateTag).toHaveBeenCalledWith('pameran');
});
it('karya baru berstatus draf dan mewarisi kelas pesertanya', ...);
it('rute menolak selain admin dengan 403', async () => { /* mock getSessionActor → mentor; POST bulk → 403 */ });
it('rute bulk menolak kunci patch yang tidak dikenal', async () => { /* patch { title: 'x' } → 400 */ });
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/exhibition-admin-works.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the service and three route files.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Pameran: API admin karya, termasuk terbitkan massal"`

---

### Task 5: Admin people, collections, and site content API

**Files:**
- Create: `src/features/exhibition/admin-content.ts`
- Create: `src/app/api/pameran/people/route.ts` (GET), `src/app/api/pameran/people/[uid]/route.ts` (PATCH)
- Create: `src/app/api/pameran/collections/route.ts` (GET, POST), `src/app/api/pameran/collections/[id]/route.ts` (PATCH)
- Create: `src/app/api/pameran/site/route.ts` (GET, PATCH)
- Test: `tests/unit/exhibition-admin-content.test.ts`

**Interfaces:**
- Produces:
  - `interface AdminPersonRow { uid: string; fullName: string; nickname: string; cohort: string; visible: boolean; photoUrl: string; mainWorkId: string | null; workCount: number }` (admin only; `fullName` from `users.name`)
  - `listPeople(): Promise<AdminPersonRow[]>`
  - `type PersonPatch = Partial<Pick<ExhibitionPerson, 'nickname' | 'photoUrl' | 'bio' | 'skills' | 'linkedinUrl' | 'portfolioUrl' | 'visible' | 'mainWorkId'>>`
  - `updatePerson(uid: string, patch: PersonPatch): Promise<void>` (rejects an empty `nickname`; rejects a `mainWorkId` that is not this person's work; a nickname with a space, such as "Nur Aini", is allowed)
  - `listCollections(): Promise<(ExhibitionCollection & { count: number })[]>`, `createCollection(input: Omit<ExhibitionCollection, 'id'>): Promise<string>`, `updateCollection(id: string, patch: Partial<Pick<ExhibitionCollection, 'title' | 'brief' | 'coverUrls'>>): Promise<void>`
  - `updateSiteContent(patch: Partial<SiteContent>): Promise<void>` (merge write to `exhibitionSite/content`)
  - Every write calls `revalidateTag('pameran')`. Routes use the Task 4 403 check.

- [ ] **Step 1: Write the failing tests**

```ts
it('nama panggilan kosong ditolak', async () => { await expect(updatePerson('s1', { nickname: ' ' })).rejects.toThrow(/nama panggilan/i); });
it('karya utama harus milik peserta itu', async () => { await expect(updatePerson('s1', { mainWorkId: 'work-of-s2' })).rejects.toThrow(); });
it('daftar peserta admin memuat nama lengkap, hanya untuk admin', ...);  // GET people as student → 403
it('konten situs disimpan dengan merge', ...);
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/exhibition-admin-content.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Pameran: API admin peserta, koleksi, dan konten situs"`

---

### Task 6: Media upload (images, PDF, HTML) and Storage rules

**Files:**
- Create: `src/features/exhibition/media.ts`
- Create: `src/app/api/pameran/upload/route.ts`
- Modify: `package.json` (move `sharp` from `devDependencies` to `dependencies`, same version `^0.35.4`)
- Test: `tests/unit/exhibition-media.test.ts`

**Interfaces:**
- Produces:
  - `storeImage(buffer: Buffer, folder: string): Promise<WorkCover>` (two WebP objects: width 640 thumbnail and width ≤1600 full, quality 82; returns public URLs)
  - `storePdf(buffer: Buffer, folder: string): Promise<string>`
  - `storeHtml(buffer: Buffer, folder: string): Promise<string>` (gzip, `contentEncoding: 'gzip'`)
  - `publicUrl(objectPath: string): string` (same format as `scripts/upload-pameran-photos.ts`: `https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encoded>?alt=media`)
  - Object path: `pameran/<folder>/<sha1-10>.<ext>`; `folder` is `karya/<workId>`, `peserta/<uid>`, or `situs`.
  - Route: multipart `file`, `kind` (`image` | `pdf` | `html`), `folder`. Limits: image 15 MB, pdf 30 MB, html 15 MB, checked from `file.size` before reading. Type allowlist reuses the contentType + extension check style of `validateImage` in `src/features/uploads/service.ts`. Returns `WorkCover` for images, `{ url }` otherwise.
- `scripts/upload-pameran-photos.ts` keeps working; do not refactor it.

- [ ] **Step 1: Write the failing tests** (mock `getAdminStorage` to capture `file(path).save(buffer, options)`):

```ts
it('gambar disimpan dua ukuran WebP dengan cache immutable', async () => {
  const cover = await storeImage(pngBuffer2400x1200, 'karya/w1');
  expect(saved.map((s) => s.options.contentType)).toEqual(['image/webp', 'image/webp']);
  expect(saved.every((s) => s.options.metadata.cacheControl === 'public, max-age=31536000, immutable')).toBe(true);
  expect(await widthOf(saved[0].buffer)).toBe(640);
  expect(await widthOf(saved[1].buffer)).toBe(1600);
  expect(cover.thumb).toMatch(/pameran%2Fkarya%2Fw1%2F[0-9a-f]{10}\.webp/);
});
it('HTML disimpan gzip', async () => { await storeHtml(Buffer.from('<html></html>'), 'karya/w1'); expect(saved[0].options.metadata.contentEncoding).toBe('gzip'); });
it('rute menolak PDF lebih dari 30 MB sebelum membaca isinya', ...);
it('rute menolak selain admin', ...);
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/exhibition-media.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `media.ts` and the route; move `sharp`; run `npm install` so the lockfile updates.
- [ ] **Step 4: Run** the same command plus `npx vitest run tests/unit/dockerignore.test.ts tests/unit/build-boundary.test.ts`. Expected: PASS.
- [ ] **Step 5: Ask the owner in chat** to approve `firebase deploy --only storage` (adds public read on `pameran/` only). Without it no `pameran/` URL loads, including in local dev. Run it only after a clear yes.
- [ ] **Step 6: Verify HTML in an iframe.** Upload one dashboard from `TUGAS/HASIL/Data Analyst - DKI Jakarta/*/HP 9*/**/*.html` with a throwaway `tsx` call to `storeHtml`, open its URL inside an iframe with the sandbox string on a scratch page, and screenshot it with Playwright. Expected: charts render. If the browser downloads the file or shows source, stop and report to the owner (spec risk 1: fall back to Netlify).
- [ ] **Step 7: Commit** `git commit -m "Pameran: unggah gambar, PDF, dan HTML ke Storage"`

---

### Task 7: Import planner (pure)

**Files:**
- Create: `src/features/exhibition/import-plan.ts`
- Test: `tests/unit/exhibition-import-plan.test.ts`

**Interfaces:**
- Produces:
  - `interface SourceFile { rel: string; ext: string; size: number }` (`rel` relative to `TUGAS/HASIL`, `/` separators)
  - `interface SourceTask { classFolder: string; personFolder: string; taskFolder: string; files: SourceFile[]; siteUrl: string | null; screenshot: string | null }` (`siteUrl` from `link.url`, `screenshot` = `tampilan-layar.png` when present)
  - `interface ImportInput { classes: { id: string; programName: string; city: string }[]; students: { uid: string; name: string; classId: string; isTest: boolean; active: boolean }[]; tasks: SourceTask[]; videoLinks: Record<string, string>; existingSourceKeys: Set<string>; existingPeople: Set<string> }`
  - `interface PlannedWork { sourceKey: string; personUid: string; classId: string; cohort: string; track: TrackKey; type: string; title: string; collectionKey: string | null; aiAssisted: boolean; media: { kind: MediaKind; source: string; slides: string[] }; coverSource: string | null }` (`source` is a `rel` path, a site URL, or a Drive link)
  - `interface ImportPlan { newPeople: { uid: string; classId: string; cohort: string; track: TrackKey; nickname: string }[]; works: PlannedWork[]; mainWork: Record<string, string>; collections: { key: string; id: string; title: string; cohort: string; type: string }[]; unmatchedFolders: string[] }` (`mainWork` maps uid → sourceKey, only for people without a `mainWorkId`)
  - `planImport(input: ImportInput): ImportPlan`
  - `const TASK_RULES` (exported for the test)

Rules (from spec section 10):

| Cohort | Task folder regex | Produces |
|---|---|---|
| web-smg | `^HP [13]\. ` | site → `Aplikasi Web`, collection `dapur-nia` |
| web-smg | `^HP 4\. ` | site → `Aplikasi Web`, collection `hris-sedap` |
| web-smg | `^HP 9\. ` | site → `Landing Page` |
| web-smg | `^PM [12]\. ` | site → `Aplikasi Web` |
| web-smg | `^CP 1\. ` | each `.pdf` → `Capstone` |
| da-jkt | `^HP 9\. ` | largest `.html` → `Dashboard` |
| da-jkt | `^HP 7\. ` | each `.ipynb` → `Analisis Data` (media `html`, source = notebook rel) |
| da-jkt | `^PM [12]\. ` | each `.ipynb` → `Data Cleaning` (media `html`) |
| smm-sby | `^(HP 6\|HP 15\|PM 1\|PM 2)\. ` | visual (below) |
| smm-sby | `^HP 12\. ` | each `.pdf` → `Brand Identity` |
| smm-sby | `^HP 16\. ` | each `.pdf` → `Laporan Campaign` |
| smm-yk | `^(HP 3\|HP 16\|PM 1\|PM 2)\. ` | visual (below) |

Visual tasks: images (`.png .jpg .jpeg .jfif .webp`) grouped by containing directory → one `Konten Feed` carousel per directory, slides in natural filename order, cover = first slide; each file with a `videoLinks` entry → one `Reels` work, media `video`, source = the Drive link, cover = that file's `rel` (the script extracts a frame). Skip any file whose path below the task folder matches `/mentah|scene|shot|proses|aset|asset|raw|storyboard/i`. Sites: skip Canva URLs and tasks without `screenshot`; dedupe per person by URL with trailing slash and query removed. `aiAssisted` = any slide or file name matching `/gemini_generated|chatgpt image|dall[-_ ]?e|midjourney/i`. Title drafts: site → hostname's first label with `-` replaced by spaces, title-cased; files → file or directory name without extension, `_` replaced by spaces. Collections: id `<cohort>-<key>`, titles `Dapur Nia` and `Portal HRIS Sedap`, type `Aplikasi Web`. `sourceKey` = `<cohort>/<personFolder>/<taskFolder>/<site URL or rel of the unit>`; works whose key is in `existingSourceKeys` are left out. Person matching: normalize both names (lowercase, letters and spaces only, single spaces); exact match among active non-test students of that class first, then a unique contains-match either way; otherwise the folder goes to `unmatchedFolders`. `newPeople` = every active non-test student of the four classes not in `existingPeople`, with `nicknameOf(name)`. `mainWork` uses `WORK_PRIORITY` with collection members last.

- [ ] **Step 1: Write the failing tests** with a small in-memory `ImportInput`:

```ts
it('Dapur Nia HP 1 dan HP 3 dengan URL sama menjadi satu karya di koleksi dapur-nia', ...);
it('folder bahan mentah dilewati', () => { /* rel '.../PM 2. X/03_Mentah_Video/a.mp4' with a video link → no work */ });
it('satu folder gambar menjadi satu carousel berurutan', () => { expect(work.media.slides).toEqual(['k/a/1.png', 'k/a/2.png', 'k/a/10.png']); });
it('nama berkas Gemini memberi label AI', ...);
it('impor ulang tidak menggandakan dan tidak menimpa', () => {
  const first = planImport(input);
  const again = planImport({ ...input, existingSourceKeys: new Set(first.works.map((w) => w.sourceKey)), existingPeople: new Set(first.newPeople.map((p) => p.uid)) });
  expect(again.works).toEqual([]);
  expect(again.newPeople).toEqual([]);
});
it('peserta tanpa folder tetap dibuatkan profil, peserta uji dilewati', ...);
it('folder yang namanya tidak cocok dilaporkan', ...);
it('karya utama: capstone mengalahkan landing page, anggota koleksi paling akhir', ...);
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/exhibition-import-plan.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `planImport`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Pameran: perencana impor karya dari folder HASIL"`

---

### Task 8: Import script

**Files:**
- Create: `src/features/exhibition/notebook-html.ts`
- Create: `scripts/import-pameran.ts`
- Modify: `package.json` scripts: `"import-pameran": "tsx --env-file=.env.local scripts/import-pameran.ts"`
- Test: `tests/unit/exhibition-notebook-html.test.ts`

**Interfaces:**
- Consumes: `planImport` (Task 7), `storeImage`/`storePdf`/`storeHtml` (Task 6), `getAdminDb`.
- Produces: `notebookToHtml(ipynbJson: string, title: string): string`. Markdown cells: HTML-escaped text, lines starting with `#` become `<h2>`/`<h3>`, blank-line-separated blocks become `<p>`. Code cells: escaped source in `<pre>`. Outputs: `image/png` → `<img src="data:image/png;base64,...">`, `text/html` → inserted as-is, `text/plain` and `stream` → escaped `<pre>`. One inline `<style>` for readable width and fonts.

Script flow (`npm run import-pameran` previews; `-- --apply` writes):
1. Walk `TUGAS/HASIL` into `SourceTask[]` (skip `node_modules`, `.git`, files starting `~$`). Read `TUGAS/_alat/video_drive.json`: map `paths[rel]` → `videos[sha].link`, converting `\` to `/`.
2. Read classes (`programName`, `city`), students (`uid`, `name`, `classId`, `isTest`, `active`) with `.select`, existing `exhibitionWorks.sourceKey`, and existing `exhibitionPeople` ids. Call `planImport`.
3. Preview prints counts per cohort and type, `unmatchedFolders`, and the first 20 planned works. Stop here without `--apply`.
4. With `--apply`, per work: allocate a doc id, then build media. site → `media.url` = URL, cover from `screenshot`. html → `storeHtml` (notebook through `notebookToHtml` first); cover = Playwright screenshot of the local file at 1440×900, as `tangkap_layar.cjs` does. pdf → `storePdf`; cover from `pdftoppm -f 1 -l 1 -r 80 -png`. carousel → `storeImage` per slide; `slides` = full URLs; cover = first slide's cover. video → `media.url` = Drive link; cover from `ffmpeg -ss 1 -i <file> -frames:v 1` then `storeImage`.
5. Write in batches of ≤500: new people (`ExhibitionPerson` fields, `visible: true`, empty bio, skills, and links, `mainWorkId: null`), collections (skip ids that exist), works (`status: 'draft'`), then `mainWorkId` for people in `plan.mainWork`. A work whose media step throws is logged and skipped; the run continues.
6. Print a summary and call nothing on the Next cache (the dev server picks changes up within 300 s; say so in the output).

- [ ] **Step 1: Write the failing test** for `notebookToHtml`: a fixture notebook with a `# Judul` markdown cell, a code cell `print(1)` with a stream output `1`, and a `image/png` output; assert `<h2>Judul</h2>`, `<pre>print(1)</pre>`, a `data:image/png;base64,` img, and that `<script>` inside a markdown cell comes out escaped.
- [ ] **Step 2: Run** `npx vitest run tests/unit/exhibition-notebook-html.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `notebook-html.ts` and the script.
- [ ] **Step 4: Run** the test. Expected: PASS. Then run `npm run import-pameran` (preview only). Expected: counts for all four cohorts, `Konten Feed`, `Reels`, `Dashboard`, `Landing Page` all non-zero, and an `unmatchedFolders` list. Paste the preview into chat for the owner.
- [ ] **Step 5: Commit** `git commit -m "Pameran: skrip impor karya ke Firestore dan Storage"`

The `--apply` run belongs to Task 13.

---

### Task 9: Admin panel shell and Karya tab

**Files:**
- Create: `src/app/(admin)/admin/pameran/page.tsx` (tabs Karya, Peserta, Koleksi, Konten Situs via `?tab=`; default Karya)
- Create: `src/app/(admin)/admin/pameran/works-tab.tsx`
- Create: `src/app/(admin)/admin/pameran/work-form.tsx`
- Modify: `src/components/app-shell.tsx:48-55` (add `{ label: 'Pameran', href: '/admin/pameran', icon: Image }` after "Tugas Siswa")
- Test: `tests/unit/exhibition-admin-panel.test.tsx`

**Interfaces:**
- Consumes: `/api/pameran/works`, `/api/pameran/works/[id]`, `/api/pameran/works/bulk`, `/api/pameran/people`, `/api/pameran/collections`, `/api/pameran/upload`.
- Works tab: filters kelas, jenis, status, koleksi, and a name/title search, all client-side over `listWorks` rows. Row checkbox plus a header checkbox for all shown rows. Bulk buttons: Terbitkan, Sembunyikan, Jadikan draf, Nyalakan label AI, Matikan label AI, Masukkan ke koleksi (select). "Terbitkan semua yang tampil" sends every currently filtered id with `{ status: 'published' }` after a `confirm()` that states the count. Thumbnails use `thumb` with `loading="lazy"`.
- Work form (edit and "Tambah karya"): person search over `/api/pameran/people` (nickname and full name), type select limited to the person's track, title, description, tools (comma list), AI toggle, collection select, cover upload, and media editor by kind: site URL, video URL, PDF upload, HTML upload, carousel slide upload with move-up/move-down and remove.
- Follow the look of `src/app/(admin)/admin/tugas/page.tsx` (same AppShell, buttons, table styles).

- [ ] **Step 1: Write the failing tests** (render with mocked `fetch`, `next/navigation`, and AppShell as in `tests/unit/task-export-all.test.tsx`):

```ts
it('Terbitkan semua yang tampil mengirim id hasil saringan saja', async () => {
  // rows: 3 web drafts, 2 smm drafts; filter kelas = web-smg; confirm → true
  expect(bulkBody).toEqual({ ids: ['w1', 'w2', 'w3'], patch: { status: 'published' } });
});
it('aksi massal label AI memakai baris yang dicentang', ...);
it('menu Pameran ada di sidebar admin', ...);
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/exhibition-admin-panel.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Pameran: panel admin tab Karya dengan aksi massal"`

---

### Task 10: Peserta, Koleksi, and Konten Situs tabs

**Files:**
- Create: `src/app/(admin)/admin/pameran/people-tab.tsx`, `collections-tab.tsx`, `site-tab.tsx`
- Modify: `src/app/(admin)/admin/pameran/page.tsx` (wire the tabs)
- Test: `tests/unit/exhibition-admin-panel.test.tsx` (extend)

**Interfaces:**
- People tab: list grouped by cohort with full name, nickname, visible toggle, work count. Form: nickname, photo upload (`folder: peserta/<uid>`, stores `cover.full` as `photoUrl`), bio, skills (comma list), LinkedIn, portfolio, main work select (that person's works).
- Collections tab: list with count; create (title, brief, cohort, type); edit title and brief.
- Site tab: one upload per photo slot id used in `home-page.tsx` and `dokumentasi/page.tsx` (`doc-*`, `best-*`, `testi-*`, `trainer-*`, `testi-plan`, `doc-<kelas>-*`), video link fields for `afterMovie`, per-cohort, per-track trainer, and `plan`, and text fields for the testimonials.

- [ ] **Step 1: Write the failing tests**

```ts
it('form peserta mengirim patch nama panggilan dan tampil', async () => { expect(patchBody).toEqual({ nickname: 'Dinda', visible: false }); });
it('karya utama hanya menawarkan karya milik peserta itu', ...);
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/exhibition-admin-panel.test.tsx`. Expected: new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Pameran: panel admin tab Peserta, Koleksi, dan Konten Situs"`

---

### Task 11: Gallery and collection pages on real data

**Files:**
- Modify: `src/app/(public)/galeri/page.tsx` (server: `getCatalog`, `orderGallery(catalog, todayWib())`, render `GalleryView`)
- Create: `src/app/(public)/galeri/gallery-view.tsx` (the current client `Gallery`, taking `items: GalleryItem[]` and counts per cohort as props; filters apply to items; when any filter or search is active, collection items are expanded into their member cards so search by nickname still finds them)
- Create: `src/app/(public)/koleksi/[id]/page.tsx` (server, `getCollectionDetail`, `notFound()` when null) and `koleksi/[id]/collection-view.tsx` (layout from `src/app/(public)/contoh-koleksi/page.tsx`)
- Modify: `src/features/exhibition/ui.tsx` (`WorkCard` shows `thumb` image when present, else the current placeholder; shows the AI chip "Dibuat dengan bantuan AI"; new `CollectionCard` component taken from the spike)
- Delete: `src/app/(public)/contoh-koleksi/`, `public/_spike-koleksi/`
- Test: `tests/unit/exhibition-gallery-page.test.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
it('galeri menampilkan item sesuai urutan dari server', ...);             // render GalleryView with 3 items, assert card titles order
it('kartu tanpa sampul memakai placeholder jenis karya', ...);           // thumb '' → thumb label text visible, no <img>
it('label AI tampil di kartu', ...);
it('mencari nama panggilan menemukan anggota koleksi', ...);
it('halaman koleksi: Coba langsung memuat iframe dengan sandbox yang ditentukan', async () => {
  // before click: no iframe; after click: iframe sandbox === 'allow-scripts allow-same-origin allow-forms allow-popups'
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/exhibition-gallery-page.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Pameran: galeri bergiliran dan halaman koleksi dari data asli"`

---

### Task 12: Work, people, home, documentation, and about pages on real data

**Files:**
- Modify: `src/app/(public)/karya/[id]/page.tsx` → server wrapper + `karya/[id]/work-view.tsx`
- Modify: `src/app/(public)/peserta/page.tsx` → server + `peserta/people-view.tsx`; `peserta/[id]/page.tsx` → server + `peserta/[id]/person-view.tsx`
- Modify: `src/app/(public)/page.tsx` and `home-page.tsx` (props from `getCatalog`, `getSiteContent`), `dokumentasi/page.tsx` (photos from `getSiteContent`), `tentang/page.tsx` (counts from catalog)
- Modify: `src/features/exhibition/content.ts` (delete `build`, `DATA`, `descFor`, `card`, `personCard`, `chromeSort`, `BIO`, sample name lists, and `photos.json` import; keep design text constants)
- Modify: `src/features/exhibition/ui.tsx` (`Photo` takes `src` from props instead of `PHOTOS`)
- Delete: `tests/unit/exhibition-content.test.ts`, `src/features/exhibition/photos.json`
- Modify: `scripts/upload-pameran-photos.ts` to write into `exhibitionSite/content.photos` instead of `photos.json`
- Test: `tests/unit/exhibition-work-page.test.tsx`

**Interfaces:**
- Work view by `media.kind`: `site`/`html` → cover image with "Coba langsung" (loads the iframe, sandbox string from Global Constraints) and "Buka demo" (`target="_blank" rel="noreferrer"`, site URL or HTML URL); `carousel` → slides advance every `SLIDE_INTERVAL_SECONDS` seconds, pause on hover, prev/next buttons and swipe; `video` → `media(url)` from `ui.tsx` (Drive and YouTube embeds); `pdf` → `<iframe src={url}>` with a "Buka PDF" link. AI chip shown when `aiAssisted`. Link to the collection when `collection` is set.
- Person view: works grid when `works.length > 0`; otherwise the profile renders without a works section.
- Home: best-per-cohort uses the first gallery item per cohort; stats count visible people and published works.

- [ ] **Step 1: Write the failing tests**

```ts
it('carousel bergeser otomatis', async () => { vi.useFakeTimers(); /* advance SLIDE_INTERVAL_SECONDS*1000 → second slide aria-current */ });
it('situs mati tetap menampilkan tautan Buka demo', ...);                   // media.url set, cover ''
it('profil tanpa karya tidak menampilkan bagian karya', ...);
it('tidak ada impor DATA tersisa', () => {
  // every .ts/.tsx file under src/app/(public) and src/features/exhibition, read as text, contains no 'DATA.'
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/exhibition-work-page.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run test:unit` and `npm run typecheck`. Expected: all PASS, no type errors.
- [ ] **Step 5: Commit** `git commit -m "Pameran: halaman karya, peserta, beranda, dan dokumentasi memakai data asli"`

---

### Task 13: Real import and owner walkthrough

**Files:** none (data and verification only)

- [ ] **Step 1:** Run `npm run import-pameran`, paste the preview (counts and `unmatchedFolders`) into chat, and ask the owner to confirm the `--apply` run, which writes drafts to production Firestore `bootcamp-future-makers-id`. Wait for a clear yes.
- [ ] **Step 2:** Run `npm run import-pameran -- --apply`. Expected: summary with zero failed works, or a listed failure reason for each.
- [ ] **Step 3:** Run it again with `--apply`. Expected: "0 karya baru, 0 peserta baru".
- [ ] **Step 4:** With the owner's dev server on port 3000 restarted (`npm run dev`), open `/admin/pameran`, publish the web cohort with "Terbitkan semua yang tampil", and screenshot `/galeri`, one `/karya/<id>` per media kind, one `/koleksi/<id>`, and one `/peserta/<uid>` without works at 1280 px and 390 px with Playwright.
- [ ] **Step 5:** Report to the owner: what was imported, the unmatched folders, the screenshots, and the remaining launch steps (Drive folder to Pelihat, curation, then push on their word).
