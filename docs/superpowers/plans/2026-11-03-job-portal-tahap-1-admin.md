# Job Portal Tahap 1 (Admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin dapat mengelola mitra (profil, logo, PIC) dan memasang lowongan di `/admin/job-portal`.

**Architecture:** Mengikuti pola panel Pameran.
- **Data:** logika murni (validasi, status, hitung mundur) di `src/features/careers/model.ts`; akses Firestore di `src/features/careers/admin-service.ts`.
- **API:** rute admin di `src/app/api/karier/*`.
- **Tampilan:** halaman klien bertab di `src/app/(admin)/admin/job-portal/`.
- **Logo:** diunggah lewat rute `/api/pameran/upload` yang sudah ada, dengan folder `mitra/<id>`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Firebase Admin (Firestore), vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-job-portal-design.md` (bagian 8 dan 9, Tahap 1)

## Global Constraints

- **Bahasa komentar:** komentar kode dua bahasa, Indonesia lalu Inggris (` / ` untuk satu baris). Komentar hanya menjelaskan *kenapa*.
- **Kueri daftar:** pakai `.select(...)` dengan kolom yang disebutkan. `description`, `qualifications`, dan `questions` tidak ikut kueri daftar lowongan.
- **Waktu:** masukan admin dalam WIB. Disimpan sebagai ISO UTC lewat penanda `+07:00`, sama seperti `parseDueAt` di `src/features/tasks/policy.ts`, karena Cloud Run berjalan pada UTC.
- **Akses:** semua rute `/api/karier/*` di tahap ini hanya untuk admin. Selain admin mendapat `403 { error: 'Hanya admin yang diizinkan' }`.
- **Tautan:** tautan yang disimpan (situs, media sosial, logo) harus kosong atau `http(s)://`, dicek dengan `safeExternalUrl` dari `src/features/exhibition/model.ts`.
- **Nilai tetap:**
  - `employment`: `magang-3`, `magang-6`, `kontrak`, `full-time`. Label: Magang 3 bulan, Magang 6 bulan, Kontrak, Full-time.
  - `category`: `teknologi`, `desain`, `pemasaran`, `administrasi`. Label: Teknologi, Desain, Pemasaran, Administrasi.
  - `workMode`: `hybrid`, `wfo`, `remote`. Label: Hybrid, WFO, Remote.
  - Dokumen: `portfolio`, `works`, `coverLetter`, masing-masing `required`, `optional`, atau `off`.
  - Pertanyaan `kind`: `long`, `yes-no`, `choice`.

## Review Focus

1. **Tanggal tutup lebih awal dari tanggal buka:** ditolak dengan pesan yang jelas (test di Task 1).
2. **Nama mitra kembar beda huruf atau spasi** ("PT DIPSI" vs " pt dipsi "): ditolak (test di Task 2).
3. **Siswa atau mentor memanggil API karier:** mendapat 403 (test di Task 2).
4. **Lowongan yang sudah punya pelamar:**
   - tidak bisa dihapus;
   - mitranya tidak bisa diganti, karena lamaran sudah dirutekan ke `partnerId` lama.

   Keduanya ditolak (test di Task 2).
5. **Pertanyaan pilihan dengan kurang dari dua opsi, atau label kosong:** ditolak. Id pertanyaan lama tetap sama saat lowongan diubah, supaya jawaban lamaran tidak lepas dari pertanyaannya (test di Task 1).

---

### Task 1: Model dan validasi karier

**Files:**
- Create: `src/features/careers/model.ts`
- Test: `tests/unit/careers-model.test.ts`

**Interfaces:**
- Produces:
  - **Tipe:**
    - `Employment`, `Category`, `WorkMode`, `DocRule = 'required' | 'optional' | 'off'`
    - `QuestionKind`, `JobQuestion { id: string; label: string; kind: QuestionKind; options: string[]; required: boolean }`
    - `Eligibility = { mode: 'all' } | { mode: 'classes'; classIds: string[] } | { mode: 'min-score'; minScore: number }`
    - `PartnerPic { name: string; phone: string; email: string }`
    - `Socials { instagram: string; linkedin: string; tiktok: string; youtube: string }`
    - `PartnerInput { name; field; about; logo: { thumb: string; full: string } | null; website; socials: Socials; pics: PartnerPic[] }`
    - `Partner = PartnerInput & { id; nameKey: string; active: boolean; createdAt; updatedAt }`
    - `JobInput { partnerId; title; employment; category; location; workMode; quota: number; description; qualifications: string[]; eligibility: Eligibility; opensAt: string; closesAt: string; documents: { portfolio: DocRule; works: DocRule; coverLetter: DocRule }; questions: JobQuestion[]; status: 'draft' | 'published' }`
    - `Job = JobInput & { id; partnerName; applicantCount: number; createdAt; updatedAt }`
  - **Label:** `EMPLOYMENT_LABELS`, `CATEGORY_LABELS`, `WORK_MODE_LABELS` (`Record<…, string>`).
  - **Fungsi:**
    - `partnerNameKey(name: string): string`: trim, huruf kecil, spasi beruntun jadi satu.
    - `validatePartnerInput(raw: unknown): PartnerInput`: melempar `Error` berpesan Indonesia.
    - `validateJobInput(raw: unknown): JobInput`: melempar `Error`. `opensAt` dan `closesAt` diterima sebagai `{ date: 'YYYY-MM-DD', time: 'HH:mm' }` WIB, atau sebagai ISO yang sudah jadi. Keduanya dikembalikan sebagai ISO UTC.
    - `assignQuestionIds(questions: JobQuestion[]): JobQuestion[]`: pertanyaan tanpa id mendapat id acak 8 karakter; id yang ada dipertahankan.
    - `jobState(job: Pick<Job, 'status' | 'opensAt' | 'closesAt'>, now: Date): 'draft' | 'terjadwal' | 'aktif' | 'ditutup'`.
    - `countdownParts(closesAt: string, now: Date): { days: number; hours: number; minutes: number; seconds: number; ended: boolean }`.
    - `formatCountdown(parts): string`: `"2 hari 05:20:31"`, atau `"11:14:02"` bila sisa kurang dari 1 hari; `"Ditutup"` bila sudah lewat.

- [ ] **Step 1: Write the failing tests** di `tests/unit/careers-model.test.ts`:

```ts
it('nama mitra dibandingkan tanpa beda huruf dan spasi', () => {
  expect(partnerNameKey('  PT   DIPSI ')).toBe(partnerNameKey('pt dipsi'));
});
it('lowongan menolak tanggal tutup sebelum tanggal buka', () => {
  expect(() => validateJobInput({ ...baseJob, opensAt: { date: '2026-11-05', time: '08:00' }, closesAt: { date: '2026-11-04', time: '23:59' } }))
    .toThrow('Tanggal tutup harus setelah tanggal buka');
});
it('tanggal WIB disimpan sebagai UTC', () => {
  expect(validateJobInput(baseJob).closesAt).toBe('2026-11-12T16:59:00.000Z'); // baseJob.closesAt = 2026-11-12 23:59 WIB
});
it('pertanyaan pilihan butuh minimal dua opsi', () => {
  expect(() => validateJobInput({ ...baseJob, questions: [{ label: 'Durasi', kind: 'choice', options: ['3 bulan'], required: true }] }))
    .toThrow('Pertanyaan pilihan butuh minimal dua opsi');
});
it('pertanyaan berlabel kosong ditolak', () => {
  expect(() => validateJobInput({ ...baseJob, questions: [{ label: ' ', kind: 'long', options: [], required: false }] }))
    .toThrow('Teks pertanyaan wajib diisi');
});
it('id pertanyaan lama dipertahankan, yang baru diberi id', () => {
  const qs = assignQuestionIds([{ id: 'q1', label: 'A', kind: 'long', options: [], required: true }, { id: '', label: 'B', kind: 'yes-no', options: [], required: false }]);
  expect(qs[0].id).toBe('q1');
  expect(qs[1].id).toMatch(/^[a-z0-9]{8}$/);
});
it('kualifikasi diisi satu per baris, baris kosong dibuang', () => {
  expect(validateJobInput({ ...baseJob, qualifications: 'Menguasai Figma\n\n Punya portofolio ' }).qualifications)
    .toEqual(['Menguasai Figma', 'Punya portofolio']);
});
it('status lowongan mengikuti waktu', () => {
  const j = { status: 'published' as const, opensAt: '2026-11-03T01:00:00.000Z', closesAt: '2026-11-10T16:59:00.000Z' };
  expect(jobState(j, new Date('2026-11-02T00:00:00Z'))).toBe('terjadwal');
  expect(jobState(j, new Date('2026-11-05T00:00:00Z'))).toBe('aktif');
  expect(jobState(j, new Date('2026-11-11T00:00:00Z'))).toBe('ditutup');
  expect(jobState({ ...j, status: 'draft' }, new Date('2026-11-05T00:00:00Z'))).toBe('draft');
});
it('hitung mundur diformat seperti contoh', () => {
  const now = new Date('2026-11-03T00:00:00Z');
  expect(formatCountdown(countdownParts('2026-11-05T05:20:31Z', now))).toBe('2 hari 05:20:31');
  expect(formatCountdown(countdownParts('2026-11-03T11:14:02Z', now))).toBe('11:14:02');
  expect(formatCountdown(countdownParts('2026-11-02T00:00:00Z', now))).toBe('Ditutup');
});
it('tautan mitra selain http(s) ditolak', () => {
  expect(() => validatePartnerInput({ ...basePartner, website: 'javascript:alert(1)' })).toThrow('Tautan harus diawali http:// atau https://');
});
it('mitra wajib punya nama dan minimal satu PIC dengan email sah', () => {
  expect(() => validatePartnerInput({ ...basePartner, pics: [] })).toThrow('Minimal satu PIC');
  expect(() => validatePartnerInput({ ...basePartner, pics: [{ name: 'Rina', phone: '', email: 'bukan-email' }] })).toThrow('Email PIC tidak sah');
});
```

`baseJob` dan `basePartner` didefinisikan di atas test sebagai masukan sah: lowongan "UI/UX Designer Intern", buka 2026-11-03 08:00, tutup 2026-11-12 23:59, `qualifications` berupa string bebas; mitra "PT DIPSI" dengan satu PIC Rina Kusuma `rina@dipsi.co.id`. Pesan error di atas adalah teks yang harus dipakai persis.

- [ ] **Step 2:** Run `npx vitest run tests/unit/careers-model.test.ts`. Expected: FAIL (modul belum ada).
- [ ] **Step 3: Implement `src/features/careers/model.ts`** sesuai Interfaces. Aturan validasi tambahan:
  - **Lowongan:** `title`, `location`, `partnerId` wajib diisi; `quota` bilangan bulat ≥ 1.
  - **Syarat pelamar:** `eligibility.classIds` tidak boleh kosong bila mode `classes`; `minScore` antara 0 dan 100.
  - **Pertanyaan:** `options` dikosongkan untuk jenis selain `choice`.
  - **Mitra:** semua string di-trim; media sosial kosong boleh.
  - **Bentuk masukan:** `qualifications` diterima sebagai string (dipecah per baris) atau sebagai array.
- [ ] **Step 4:** Run `npx vitest run tests/unit/careers-model.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit**, dengan pesan `Job Portal: model dan validasi mitra serta lowongan`.

### Task 2: Layanan admin dan rute API

**Files:**
- Create:
  - `src/features/careers/admin-service.ts`
  - `src/app/api/karier/partners/route.ts` (GET, POST)
  - `src/app/api/karier/partners/[id]/route.ts` (PATCH)
  - `src/app/api/karier/jobs/route.ts` (GET, POST)
  - `src/app/api/karier/jobs/[id]/route.ts` (GET, PATCH, DELETE)
- Modify: `src/features/exhibition/media.ts` (`isValidFolder` juga menerima `mitra/<id>`)
- Test:
  - `tests/unit/careers-admin.test.ts`
  - `tests/unit/exhibition-media.test.ts` (tambah satu kasus)

**Interfaces:**
- Consumes: semua dari Task 1.
- Produces:
  - **Baris daftar:**
    - `PartnerRow { id; name; field; logoThumb: string; picNames: string[]; jobCount: number }`
    - `JobRow { id; title; employment; category; location; workMode; quota; partnerId; partnerName; picName: string; opensAt; closesAt; status; applicantCount }`
  - **Mitra:**
    - `listPartners(): Promise<PartnerRow[]>`
    - `getPartner(id): Promise<Partner | null>`
    - `createPartner(raw): Promise<string>`
    - `updatePartner(id, raw): Promise<void>`
  - **Lowongan:**
    - `listJobs(): Promise<JobRow[]>`
    - `getJob(id): Promise<Job | null>`
    - `createJob(raw): Promise<string>`
    - `updateJob(id, raw): Promise<void>`
    - `deleteJob(id): Promise<void>`
  - **Ringkasan:** `portalStats(now: Date): Promise<{ activeJobs: number; applicants: number; partners: number; interviews: number }>`
  - **Format respons API:**
    - `GET /api/karier/partners` → `{ partners }`
    - `GET /api/karier/jobs` → `{ jobs, stats }`
    - `GET /api/karier/jobs/[id]` → `{ job }`
    - `POST` → `{ id }`
    - `PATCH` dan `DELETE` → `{ ok: true }`
    - Galat → `{ error }` dengan status 400, 403, atau 404.

- [ ] **Step 1: Write failing tests** di `tests/unit/careers-admin.test.ts`. Firestore palsu dibuat dengan pola `tests/unit/exhibition-admin-works.test.ts`: `collection().select().get()`, `.where().count().get()`, `.doc().get/set/update/delete`, `.add`. Kasus:
  - `createPartner` menolak nama yang `nameKey`-nya sudah dipakai mitra lain → `'Nama perusahaan sudah terdaftar'`. `updatePartner` pada mitra itu sendiri dengan nama sama tetap boleh.
  - `createJob` menyalin `partnerName` dari mitra, dan mengisi `applicantCount: 0`. `partnerId` tak dikenal → `'Mitra tidak ditemukan'`.
  - `updatePartner` yang mengganti nama juga memperbarui `partnerName` di lowongan milik mitra itu.
  - `deleteJob` pada lowongan dengan `applicantCount > 0` → `'Lowongan yang sudah punya pelamar tidak bisa dihapus'`.
  - `updateJob` yang mengganti `partnerId` pada lowongan dengan `applicantCount > 0` → `'Mitra lowongan yang sudah punya pelamar tidak bisa diganti'`.
  - `listJobs` memanggil `select` tanpa `description`, `qualifications`, dan `questions` (rekam argumen `select` di Firestore palsu).
  - `portalStats` menghitung lowongan `aktif` lewat `jobState`, menjumlahkan `applicantCount`, dan memakai `count()` untuk mitra dan `jobApplications` berstatus `interview`.
  - `GET` dan `POST /api/karier/jobs` dengan `getSessionActor` → `{ role: 'student' }` → status 403.
- [ ] **Step 2:** Tambah kasus di `exhibition-media.test.ts`: `isValidFolder('mitra/abc')` true, `isValidFolder('mitra/../x')` false.
- [ ] **Step 3:** Run `npx vitest run tests/unit/careers-admin.test.ts tests/unit/exhibition-media.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement** layanan dan rute, mengikuti bentuk `src/app/api/pameran/works/route.ts` (pemeriksaan `isAdmin`, galat sebagai 400).
  - Koleksi Firestore: `partners`, `jobs`.
  - `picName` di `JobRow` adalah nama PIC pertama mitra.
  - Pembaruan `partnerName` saat mitra berganti nama memakai batch.
- [ ] **Step 5:** Run kedua berkas test. Expected: PASS. Lalu run `npx vitest run tests/unit`. Expected: semua PASS.
- [ ] **Step 6: Commit**, dengan pesan `Job Portal: layanan dan API admin mitra serta lowongan`.

### Task 3: Halaman admin Job Portal

**Files:**
- Create:
  - `src/app/(admin)/admin/job-portal/page.tsx`
  - `src/app/(admin)/admin/job-portal/jobs-tab.tsx`
  - `src/app/(admin)/admin/job-portal/partners-tab.tsx`
  - `src/app/(admin)/admin/job-portal/partner-form.tsx`
  - `src/app/(admin)/admin/job-portal/job-form.tsx`
  - `src/features/careers/job-card.tsx` (kartu lowongan, dipakai pratinjau admin sekarang dan daftar siswa di Tahap 2)
- Modify: `src/components/app-shell.tsx` (menu `{ label: 'Job Portal', href: '/admin/job-portal', icon: Briefcase }` setelah Pameran)
- Test: `tests/unit/careers-job-card.test.tsx`

**Interfaces:**
- Consumes:
  - dari Task 1: label, `jobState`, `countdownParts`, `formatCountdown`;
  - dari Task 2: rute `/api/karier/*`;
  - dari `src/app/(admin)/admin/pameran/admin-ui.ts`: `api`, `send`, `uploadImage`, gaya `field`, `btn`, `btnSolid`, `label`, `card`, `alertBox`.
- Produces: `JobCard({ job, logo, now, footer }: { job: Pick<Job, 'title' | 'partnerName' | 'employment' | 'location' | 'workMode' | 'quota' | 'closesAt'>; logo: string | null; now: Date; footer?: React.ReactNode })`

Desain mengikuti `FITUR TAMBAHAN/Admin — Kelola Lowongan` dan kartu di `Siswa — Portal Karier`:
- **Logo:** inisial berwarna bila tidak ada.
- **Chip:** jenis, "lokasi · mode", "Kuota n".
- **Pita hitung mundur:** biru `#E6F1FB` dengan teks `#0072CE`; merah `#FDECEA` dengan teks `#B42318` bila sisa kurang dari 24 jam.

- [ ] **Step 1: Failing test** `careers-job-card.test.tsx`:
  - kartu menampilkan `'Tutup dalam 2 hari 05:20:31'`, chip `'Magang 3 bulan'`, `'Jakarta Selatan · Hybrid'`, `'Kuota 2'`;
  - inisial `'P'` tampil bila `logo` null;
  - dengan sisa 11 jam, pita memakai kelas atau atribut `data-urgent="true"`.
- [ ] **Step 2:** Run test. Expected: FAIL.
- [ ] **Step 3: Implement `JobCard`**, lalu halaman:
  - **Ringkasan:** 4 angka dari `stats`.
  - **Tab** "Lowongan" dan "Mitra & PIC", lewat `?tab=` seperti halaman Pameran.
  - **Tabel lowongan:** Posisi/jenis, Perusahaan → PIC, Tutup dalam (diperbarui tiap detik), Pelamar, Status (Draf, Terjadwal, Aktif, Ditutup), Aksi (Ubah, Hapus bila 0 pelamar).
  - **Formulir lowongan:**
    - tiga bagian sesuai spec 9 Tahap 1 butir 4;
    - masukan tanggal `type="date"` dan jam `type="time"`;
    - kualifikasi di textarea, satu per baris;
    - pertanyaan bisa ditambah, dihapus, dan diubah jenisnya; opsi pilihan diisi satu per baris;
    - pratinjau `JobCard` di samping;
    - tombol Simpan draf (`status: 'draft'`) dan Publikasikan (`status: 'published'`).
  - **Formulir mitra:** nama, bidang, deskripsi, logo (unggah ke folder `mitra/<id>`; untuk mitra baru, simpan dulu lalu unggah), situs, empat media sosial, dan daftar PIC (tambah/hapus baris).
  - Tombol "+ Tambah mitra" dan "+ Tambah lowongan" di kepala halaman.
- [ ] **Step 4:** Run `npx vitest run tests/unit`. Expected: semua PASS. Run `npx tsc --noEmit`. Expected: tanpa galat.
- [ ] **Step 5: Verifikasi di peramban** lewat dev server port 3457, masuk sebagai admin:
  - tambah mitra uji "PT Uji Coba" dengan logo;
  - tambah lowongan draf dengan dua pertanyaan, lalu publikasikan;
  - cek tabel dan hitung mundur;
  - ubah lowongan, lalu pastikan id pertanyaan tetap;
  - hapus lowongan dan mitra uji. Mitra dihapus lewat skrip scratchpad karena tidak ada tombol hapus mitra.

  Ambil tangkapan layar 1440 px dan 390 px.
- [ ] **Step 6: Commit**, dengan pesan `Job Portal: halaman admin kelola mitra dan lowongan`. Setelah itu push ke main dan pantau deploy Cloud Build sampai sukses.
