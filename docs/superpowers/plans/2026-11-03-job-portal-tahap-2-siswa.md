# Job Portal Tahap 2 (Siswa) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Siswa melihat lowongan dan profil mitra, menyimpan CV, lalu melamar dengan lampiran karya dan tugas. Admin melihat pelamar, membuka CV, mengubah status, dan mengekspor .xlsx.

**Architecture:**
- **Logika murni** (kelayakan, validasi lamaran, label status) di `src/features/careers/model.ts`.
- **Layanan Firestore dan Storage:**
  - `cv-service.ts`: bank CV dan surat lamaran;
  - `student-service.ts`: bacaan siswa;
  - `apply-service.ts`: kirim lamaran dalam satu transaksi;
  - `applicants-service.ts`: bacaan dan perubahan status oleh admin.
- **Rute API** di `src/app/api/karier/*`, dengan penjaga `asStudent` di samping `asAdmin`.
- **Halaman siswa** berupa komponen klien di `src/app/(student)/app/karier/*`, memakai `StudentShell`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Firebase Admin (Firestore, Storage bucket default), `xlsx` (sudah terpasang), vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-job-portal-design.md` (bagian 8, 9 Tahap 2, dan 11). Tahap 1: `docs/superpowers/plans/2026-11-03-job-portal-tahap-1-admin.md`.

## Global Constraints

- **Komentar kode:** dua bahasa, Indonesia lalu Inggris. Komentar hanya menjelaskan *kenapa*.
- **Kueri daftar:** pakai `.select(...)` dengan kolom yang disebutkan.
  - Daftar lowongan tidak membawa `description`, `qualifications`, `questions`.
  - Daftar lamaran tidak membawa `answers`.
- **Berkas CV dan surat lamaran:**
  - Privat di bucket default, jalur `cv/<uid>/<id>.pdf`.
  - Dilayani lewat `/api/karier/cv/[id]` dengan header seperti `src/app/api/submissions/[submissionId]/file/route.ts` (`nosniff`, `sandbox`, `private, no-store`).
  - Hanya pemilik dan admin yang boleh membuka.
  - Berkas tidak pernah ditimpa atau dihapus. Menghapus dari bank hanya mengisi `deleted: true`.
- **Batas berkas:** PDF saja, maksimal 2 MB, diawali bita `%PDF-`. Maksimal 5 berkas aktif per `kind` (`cv`, `surat`) per siswa.
- **Satu lamaran per siswa per lowongan:** id dokumennya `${jobId}_${uid}`.
- **Status lamaran:** `baru | ditinjau | shortlist | interview | diterima | tidak-lolos`. Label siswa:
  - `baru` → Terkirim
  - `ditinjau`, `shortlist` → Dilihat mitra
  - `interview` → Undangan interview
  - `diterima` → Diterima
  - `tidak-lolos` → Belum lolos

  Pesan standar untuk `tidak-lolos`: "Terima kasih sudah melamar. Kali ini kamu belum lolos ke tahap berikutnya."
- **`rejectReason`** tidak pernah dikirim ke siswa.
- **Nilai akhir** diambil dari dokumen `dashboardSnapshots` terbaru (urut id menurun, `.select('ranking','generatedAt')`), baris `ranking[]` dengan `studentId` yang sama. Disimpan sebagai `finalScore`, `finalScorePending`, `finalScoreAt` (tanggal id dokumen).
- **Lowongan tampil ke siswa** bila `status === 'published'`, `opensAt <= now < closesAt`, dan siswa memenuhi `eligibility`. `min-score` memakai `finalScore` dari ringkasan; siswa tanpa nilai tidak lolos syarat itu.

## Review Focus

1. **Siswa mengirim id CV, karya, atau tugas milik siswa lain lewat API:** ditolak (Task 5).
2. **Lamaran dikirim setelah `closesAt`, atau dua kali untuk lowongan yang sama** (dua tab): ditolak, dan `applicantCount` hanya bertambah satu (Task 5).
3. **Lowongan berstatus draf, kelas lain, atau nilai di bawah syarat:** tidak tampil di daftar dan detail siswa, dan tidak bisa dilamar lewat API (Task 4 dan 5).
4. **Berkas yang bukan PDF tetapi bernama `.pdf`, atau lebih dari 2 MB:** ditolak sebelum disimpan (Task 3).
5. **Siswa membuka CV siswa lain lewat `/api/karier/cv/[id]`:** 403 (Task 3).

---

### Task 1: Prasyarat dari Tahap 1 dan nilai sementara di ringkasan

**Files:**
- Modify:
  - `src/features/careers/admin-service.ts` (`updateJob`, `deleteJob` memakai `db.runTransaction`)
  - `src/features/dashboard/snapshot-types.ts` (`RankedStudent.pending?: GradeComponent[]`)
  - `src/features/dashboard/snapshot-service.ts` (isi `pending: nilai.pending` di baris ranking; `SNAPSHOT_VERSION = 17` dengan catatan versi 17)
- Test:
  - `tests/unit/careers-admin.test.ts` (Firestore palsu mendapat `runTransaction`)
  - satu test baru di `tests/unit/dashboard-regions.test.ts` atau berkas ringkasan yang sesuai

**Interfaces:**
- Produces: `RankedStudent.pending` (opsional; ringkasan lama tidak memilikinya).

- [ ] **Step 1: Test.**
  - `deleteJob` dan `updateJob` membaca lowongan lewat `tx.get` dan menulis lewat `tx.delete` / `tx.update`. Firestore palsu mencatat bahwa transaksi dipakai.
  - Test teks sumber, mengikuti pola `dashboard-regions.test.ts`:
    - `snapshot-service.ts` memuat `pending: nilai.pending`;
    - `SNAPSHOT_VERSION` ≥ 17.
- [ ] **Step 2:** Run tests. Expected: FAIL.
- [ ] **Step 3: Implementasi.**
- [ ] **Step 4:** Run `npx vitest run tests/unit`. Expected: semua PASS.
- [ ] **Step 5: Commit**, dengan pesan `Job Portal: cek pelamar dalam transaksi, nilai sementara di ringkasan`.

### Task 2: Model lamaran

**Files:**
- Modify: `src/features/careers/model.ts`
- Test: `tests/unit/careers-model.test.ts`

**Interfaces:**
- Produces:
  - **Status lamaran:**
    - `ApplicationStatus` (union di atas)
    - `APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string>`: label admin Baru, Ditinjau, Shortlist, Interview, Diterima, Tidak lolos
    - `studentStatusLabel(s: ApplicationStatus): string`
    - `REJECT_MESSAGE`
  - **Tipe dokumen:**
    - `CvFile { id; ownerUid; kind: 'cv' | 'surat'; fileName; size; storagePath; uploadedAt; deleted }`
    - `Personal { fullName; email; phone; city; school; major; linkedin }`
    - `AttachedWork { id; title; type; cover: string }`
    - `AttachedTask { submissionId; title; kind: string }`
    - `Application { id; jobId; partnerId; studentId; classId; number; personal; cvId; cvFileName; coverLetterId: string | null; portfolioUrl; works: AttachedWork[]; tasks: AttachedTask[]; answers: Record<string, string>; finalScore: number | null; finalScorePending: boolean; finalScoreAt: string | null; status: ApplicationStatus; rejectReason: string; submittedAt; updatedAt; statusChangedAt }`
  - **Fungsi:**
    - `isOpenToStudents(job: Pick<Job,'status'|'opensAt'|'closesAt'>, now: Date): boolean`: sama dengan `jobState(...) === 'aktif'`.
    - `isEligible(e: Eligibility, s: { classId: string | null; finalScore: number | null }): boolean`
    - `validateApplicationInput(raw: unknown, job: Pick<Job,'documents'|'questions'>, owned: { cvIds: Set<string>; coverIds: Set<string>; workIds: Set<string>; submissionIds: Set<string> }): { personal: Personal; cvId: string; coverLetterId: string | null; portfolioUrl: string; workIds: string[]; submissionIds: string[]; answers: Record<string, string> }`
    - `formatApplicationNumber(n: number): string`: `1` → `'FM-JOB-0001'`.

- [ ] **Step 1: Failing tests**, dengan pesan error persis:
  - `isEligible`:
    - `{mode:'classes', classIds:['k1']}` dengan `classId 'k2'` → false;
    - `min-score 75` dengan `finalScore null` → false, dan dengan `80` → true;
    - mode `all` → true.
  - `validateApplicationInput`:
    - `fullName`, `email`, `phone`, `city`, `school`, `major` kosong → `'Lengkapi data diri: <label>'` (label: Nama lengkap, Email, No. WhatsApp, Domisili, Asal sekolah / kampus, Jurusan);
    - `cvId` tidak ada di `owned.cvIds` → `'CV tidak ditemukan'`;
    - `workIds` atau `submissionIds` di luar `owned` → `'Lampiran bukan milikmu'`;
    - `documents.portfolio==='required'` dan `portfolioUrl` kosong → `'Link portofolio wajib diisi'`;
    - `portfolioUrl` bukan http(s) → `'Tautan harus diawali http:// atau https://'`;
    - `documents.works==='required'` dan tidak ada karya maupun tugas → `'Lampirkan minimal satu karya atau tugas'`;
    - `documents.coverLetter==='required'` tanpa `coverLetterId` → `'Surat lamaran wajib diunggah'`;
    - pertanyaan wajib kosong → `'Jawab pertanyaan: <label>'`;
    - jawaban `choice` di luar opsi, atau `yes-no` selain `'Ya'`/`'Tidak'` → `'Jawaban tidak sah: <label>'`;
    - jawaban lebih dari 3.000 karakter → `'Jawaban terlalu panjang: <label>'`;
    - jawaban untuk id pertanyaan yang tidak ada dibuang;
    - lampiran dengan `documents` `off` dibuang (portofolio, karya/tugas, surat).
  - `studentStatusLabel('shortlist')` → `'Dilihat mitra'`.
  - `formatApplicationNumber(12)` → `'FM-JOB-0012'`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementasi.**
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit**, dengan pesan `Job Portal: model dan validasi lamaran`.

### Task 3: Bank CV

**Files:**
- Create:
  - `src/features/careers/cv-service.ts`
  - `src/app/api/karier/cv/route.ts` (GET daftar milik sendiri, POST unggah multipart `file` + `kind`)
  - `src/app/api/karier/cv/[id]/route.ts` (GET berkas, DELETE tandai terhapus)
- Modify: `src/app/api/karier/guard.ts`: tambah `asStudent(action: (actor: Actor) => Promise<unknown>)` (403 `'Hanya peserta yang diizinkan'`), dan `asSignedIn(action)` (401 tanpa sesi).
- Test: `tests/unit/careers-cv.test.ts`

**Interfaces:**
- Produces:
  - `listCvs(uid: string): Promise<CvFile[]>`: tidak terhapus, terbaru dulu, koleksi `studentCvs`.
  - `uploadCv(uid: string, kind: 'cv'|'surat', file: { name: string; type: string; size: number; bytes: Buffer }): Promise<CvFile>`
  - `deleteCv(uid: string, id: string): Promise<void>`
  - `readCvFile(actor: Actor, id: string): Promise<{ buffer: Buffer; fileName: string }>`: pemilik atau admin; selain itu melempar `'Tidak boleh membuka berkas ini'`.

- [ ] **Step 1: Failing tests** (Firestore dan Storage palsu):
  - berkas `.pdf` berisi `hello` → `'Berkas harus PDF'`;
  - 2 MB + 1 bita → `'Ukuran PDF maksimal 2 MB'`;
  - CV ke-6 aktif → `'Maksimal 5 CV tersimpan. Hapus salah satu dulu.'` (untuk `surat`: `'Maksimal 5 surat lamaran tersimpan. Hapus salah satu dulu.'`);
  - unggah sah menyimpan objek di `cv/<uid>/<id>.pdf` dan dokumen `studentCvs`;
  - `deleteCv` oleh pemilik lain → `'CV tidak ditemukan'`;
  - `deleteCv` sah mengisi `deleted: true` dan tidak menghapus objek Storage;
  - `readCvFile` oleh siswa lain → melempar, oleh admin → berhasil;
  - `GET /api/karier/cv/[id]` untuk siswa lain → 403.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementasi.** Nama berkas dirapikan dengan `safeFileName` dari `src/features/tasks/submission-file.ts` bila diekspor; bila tidak, ganti karakter selain `[\w.\- ]` dengan `_`.
- [ ] **Step 4:** Run → PASS. Lalu seluruh suite.
- [ ] **Step 5: Commit**, dengan pesan `Job Portal: bank CV dan surat lamaran siswa`.

### Task 4: Bacaan siswa

**Files:**
- Create:
  - `src/features/careers/student-service.ts`
  - `src/app/api/karier/lowongan/route.ts` (GET)
  - `src/app/api/karier/lowongan/[id]/route.ts` (GET)
  - `src/app/api/karier/mitra/[id]/route.ts` (GET)
  - `src/app/api/karier/lamar/route.ts` (GET `?jobId=` konteks formulir; POST di Task 5)
  - `src/app/api/karier/lamaran/route.ts` (GET)
- Test: `tests/unit/careers-student.test.ts`

**Interfaces:**
- Produces:
  - `latestFinalScore(uid): Promise<{ finalScore: number | null; finalScorePending: boolean; finalScoreAt: string | null }>`
  - `listOpenJobs(actor, now): Promise<{ jobs: StudentJobCard[]; appliedJobIds: string[]; bannerClosesAt: string | null }>`
    - `StudentJobCard = JobRow fields minus picName + { logo: string | null }`, diambil dari koleksi `partners` `select('logo.thumb')`.
    - `bannerClosesAt` adalah `closesAt` terjauh di antara lowongan yang tampil.
  - `getJobForStudent(actor, id, now): Promise<{ job: Job; partner: PublicPartner; application: { status: ApplicationStatus; number: string } | null } | null>`
    - `null` bila lowongan tidak tampil dan siswa belum melamarnya.
    - Siswa yang sudah melamar tetap bisa membuka detail walau lowongan sudah tutup.
  - `PublicPartner { id; name; field; about; logo: Logo | null; website; socials: Socials }`, tanpa `pics`.
  - `getPartnerProfile(actor, id, now): Promise<{ partner: PublicPartner; jobs: StudentJobCard[] } | null>`: `jobs` hanya yang tampil untuk siswa itu.
  - `getApplyContext(actor, jobId, now)` mengembalikan `{ job, partner, personal: Personal, className: string, cvs: CvFile[], covers: CvFile[], works: AttachedWork[], tasks: AttachedTask[] }`.
    - Melempar `'Lowongan tidak bisa dilamar'` bila tidak tampil.
    - Melempar `'Kamu sudah melamar lowongan ini'` bila sudah ada lamaran.
    - `personal` diisi dari `users` (name, email), `studentProfiles.phone`, dan `careerProfiles/{uid}` (city, school, major, linkedin).
    - `works`: `exhibitionWorks` `where personUid==uid, status=='published'`, `select('title','type','cover.thumb')`.
    - `tasks`: `submissions` `where studentId==uid`, `select('taskTitle','taskKind','fileId','url')`, hanya yang punya berkas atau tautan.
    - `className`: `classes/{classId}.canonicalName`.
  - `listMyApplications(uid): Promise<MyApplication[]>`
    - `MyApplication = { id; jobId; number; jobTitle; partnerName; statusLabel: string; status: ApplicationStatus; submittedAt; message: string | null }`.
    - `message` berisi `REJECT_MESSAGE` untuk `tidak-lolos`.
    - Judul dan nama mitra diambil dari `jobs` `select('title','partnerName')`.
    - Tidak membawa `rejectReason`.

- [ ] **Step 1: Failing tests:**
  - lowongan draf, belum buka, sudah tutup, kelas lain, dan `min-score` di atas nilai siswa tidak tampil di `listOpenJobs`;
  - lowongan sah tampil dengan logo mitra;
  - `appliedJobIds` berisi lowongan yang sudah dilamar;
  - `getJobForStudent` untuk lowongan tak terlihat → null; untuk lowongan tutup yang sudah dilamar → ada;
  - `PublicPartner` tidak memuat `pics`;
  - `getApplyContext` mengisi data diri dari tiga sumber, dan hanya memuat karya `published` milik siswa;
  - `listMyApplications` tidak memuat `rejectReason`, dan memberi `message` untuk `tidak-lolos`;
  - `latestFinalScore` memakai dokumen ringkasan dengan id terbesar, dan `pending` tidak kosong → `finalScorePending: true`;
  - rute `GET /api/karier/lowongan` oleh admin → 403.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementasi.**
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit**, dengan pesan `Job Portal: bacaan lowongan, profil mitra, dan lamaran untuk siswa`.

### Task 5: Kirim lamaran

**Files:**
- Create: `src/features/careers/apply-service.ts`
- Modify: `src/app/api/karier/lamar/route.ts` (POST)
- Test: `tests/unit/careers-apply.test.ts`

**Interfaces:**
- Consumes:
  - `validateApplicationInput`, `isOpenToStudents`, `isEligible`, `formatApplicationNumber` (Task 2);
  - `listCvs` (Task 3);
  - `latestFinalScore` dan bacaan karya/tugas (Task 4).
- Produces: `submitApplication(actor: Actor, raw: unknown, now: Date): Promise<{ id: string; number: string }>`
  - Kepemilikan CV, karya, dan tugas dihitung sebelum transaksi.
  - Di dalam `db.runTransaction`:
    1. baca `jobs/{jobId}`, `jobApplications/{jobId}_{uid}`, `counters/jobApplications`;
    2. tolak bila tidak terbuka (`'Lowongan sudah ditutup'`), tidak layak (`'Kamu belum memenuhi syarat lowongan ini'`), atau sudah ada (`'Kamu sudah melamar lowongan ini'`);
    3. tulis lamaran (`status: 'baru'`, `rejectReason: ''`);
    4. naikkan `jobs.applicantCount` dan `counters.next`.
  - `careerProfiles/{uid}` diisi setelah transaksi.
  - `works` dan `tasks` disimpan sebagai salinan (judul, jenis, sampul).

- [ ] **Step 1: Failing tests:**
  - lamaran sah menghasilkan `number 'FM-JOB-0001'`, lamaran kedua `0002`, dan `applicantCount` naik;
  - kirim dua kali → `'Kamu sudah melamar lowongan ini'`, dan `applicantCount` tetap 1;
  - sesudah `closesAt` → `'Lowongan sudah ditutup'`;
  - CV milik siswa lain → `'CV tidak ditemukan'`;
  - karya milik siswa lain → `'Lampiran bukan milikmu'`;
  - kelas tidak cocok → `'Kamu belum memenuhi syarat lowongan ini'`;
  - `finalScore` dan `finalScorePending` tersalin dari ringkasan;
  - `careerProfiles` tersimpan;
  - rute POST oleh mentor → 403.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementasi.**
- [ ] **Step 4:** Run → PASS, lalu seluruh suite.
- [ ] **Step 5: Commit**, dengan pesan `Job Portal: siswa mengirim lamaran`.

### Task 6: Halaman siswa

**Files:**
- Create:
  - `src/app/(student)/app/karier/page.tsx` (tab Lowongan dan Lamaran Saya lewat `?tab=lamaran`)
  - `src/app/(student)/app/karier/[jobId]/page.tsx` (detail)
  - `src/app/(student)/app/karier/[jobId]/lamar/page.tsx` (formulir bertahap)
  - `src/app/(student)/app/karier/mitra/[id]/page.tsx` (profil mitra)
  - `src/features/careers/countdown-banner.tsx`
- Modify: `src/components/student-shell.tsx` (menu `{ label: 'Karier', href: '/app/karier', icon: Briefcase }` dengan lencana kuning "Baru")
- Test: `tests/unit/careers-apply-form.test.tsx`

Acuan desain: `FITUR TAMBAHAN/Siswa — Portal Karier`. Pakai warna `#0072CE` dan `#F8FAFB`, pita mendesak `#FDECEA`, lencana "Baru" kuning `#FFD200`.

- **Daftar:**
  - spanduk biru dengan judul "Lamar posisi dari mitra Future Makers" dan kotak Hari/Jam/Menit/Detik (Detik kuning) ke `bannerClosesAt`;
  - chip filter bidang;
  - kartu `JobCard` dengan footer "n pelamar" atau lencana hijau "Sudah dilamar", plus tombol "Lihat detail".
- **Detail:**
  - Tentang posisi, Kualifikasi, Dokumen yang diminta, Tahapan seleksi (Review CV oleh mitra → Interview (undangan dikirim lewat portal ini) → Pengumuman hasil), dan hitung mundur;
  - tombol "Lamar sekarang", atau "Sudah dilamar — lihat status";
  - nama mitra menaut ke profil.
- **Formulir:**
  - langkah 1 Data diri, 2 Dokumen, 3 Pertanyaan (dilewati bila tidak ada), 4 Periksa lamaran, lalu layar "Lamaran terkirim" dengan nomornya.
  - Di langkah Dokumen:
    - kartu radio daftar CV;
    - tombol "Unggah CV baru" (POST `/api/karier/cv`, lalu otomatis terpilih) dan "Hapus" per CV;
    - surat lamaran dengan pola yang sama;
    - kotak centang karya (sampul, judul, jenis) dan tugas (judul, jenis), mengikuti `documents`.
  - Draf (semua isian selain berkas) tersimpan di `localStorage` kunci `karier-draf-<jobId>` lewat try/catch, dipulihkan saat dibuka, dan dihapus setelah terkirim.
- **Lamaran Saya:** kartu per lamaran berisi judul, mitra, nomor, tanggal kirim, label status, dan pesan standar bila belum lolos.
- **Profil mitra:** logo, nama, bidang, deskripsi, tautan situs dan media sosial (`target="_blank" rel="noopener noreferrer"`), dan lowongan yang terbuka.

- [ ] **Step 1: Failing test** `careers-apply-form.test.tsx`, dengan `fetch` palsu untuk konteks:
  - langkah Data diri menolak lanjut bila No. WhatsApp kosong, dengan pesan `'Lengkapi data diri: No. WhatsApp'`;
  - draf dipulihkan dari `localStorage` (kota terisi);
  - kirim memanggil `POST /api/karier/lamar` dengan `cvId` terpilih, lalu menampilkan `'Lamaran terkirim'` dan nomor dari respons.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementasi** semua halaman dan menu.
- [ ] **Step 4:** Run `npx vitest run tests/unit` dan `npx tsc --noEmit`. Expected: PASS, tanpa galat.
- [ ] **Step 5: Commit**, dengan pesan `Job Portal: menu Karier untuk siswa`.

### Task 7: Pelamar di admin dan verifikasi ujung ke ujung

**Files:**
- Create:
  - `src/features/careers/applicants-service.ts`
  - `src/app/api/karier/jobs/[id]/applications/route.ts` (GET)
  - `src/app/api/karier/applications/[id]/route.ts` (GET detail, PATCH status)
  - `src/app/(admin)/admin/job-portal/[jobId]/page.tsx`
- Modify: `src/app/(admin)/admin/job-portal/jobs-tab.tsx` (tombol "Lihat pelamar" ke `/admin/job-portal/<id>`)
- Test: `tests/unit/careers-applicants.test.ts`

**Interfaces:**
- Produces:
  - `listApplicants(jobId): Promise<ApplicantRow[]>`
    - `ApplicantRow = { id; number; fullName; email; phone; city; school; major; className: string; finalScore; finalScorePending; finalScoreAt; status; submittedAt; statusChangedAt; cvId; portfolioUrl }`.
    - `select` tanpa `answers`.
    - `className` dari `classes` `select('canonicalName')`.
  - `getApplicationForAdmin(id): Promise<Application & { className: string; questions: JobQuestion[] }>`
  - `setApplicationStatus(id, status, rejectReason?): Promise<void>`
    - mengisi `statusChangedAt`;
    - `rejectReason` hanya disimpan untuk `tidak-lolos`;
    - status tak dikenal → `'Status lamaran tidak dikenal'`.

- [ ] **Step 1: Failing tests:**
  - `listApplicants` hanya untuk `jobId` itu, dan `select` tanpa `answers`;
  - `setApplicationStatus` menolak status tak dikenal, dan mengosongkan `rejectReason` bila status bukan `tidak-lolos`;
  - rute oleh siswa → 403.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementasi halaman.**
  - Tabel pelamar: No. lamaran, Nama, Kelas, Nilai akhir (dengan label "sementara · <tanggal>" bila pending; "Belum ada nilai akhir" bila null), Dikirim, Status (select), Terakhir diubah.
  - Klik baris membuka detail: data diri, tombol "Buka CV" (`/api/karier/cv/<cvId>` di tab baru), surat lamaran, portofolio, karya (tautan `/karya/<id>`), tugas (`/api/submissions/<id>/file` bila berkas), dan jawaban berlabel pertanyaan.
  - Tombol "Ekspor .xlsx" membangun berkas di peramban dari `ApplicantRow` dengan `xlsx`, seperti `src/app/(admin)/admin/dashboard/page.tsx`. Nama berkas `Pelamar_<judul>.xlsx`.
- [ ] **Step 4:** Run `npx vitest run tests/unit` dan `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Verifikasi ujung ke ujung** di dev server port 3457 dengan skrip Playwright di scratchpad:
  1. Admin membuat mitra dan lowongan uji (2 pertanyaan, karya opsional).
  2. Masuk sebagai akun siswa uji (`isTest: true`) bila ada; bila tidak ada, buat akun siswa uji lewat skrip dan hapus di akhir.
  3. Siswa melihat kartu, membuka detail, mengunggah CV PDF kecil, melampirkan satu karya bila ada, menjawab, lalu mengirim.
  4. Cek layar "Lamaran terkirim" dan tab Lamaran Saya.
  5. Admin membuka pelamar, membuka CV, mengubah status ke Ditinjau, lalu siswa melihat "Dilihat mitra".
  6. Ambil tangkapan layar 1440 px dan 390 px.
  7. Bersihkan semua data uji (lamaran, CV dan objek Storage-nya, `careerProfiles` bila dibuat oleh uji, penghitung dikembalikan, lowongan, mitra).
- [ ] **Step 6: Commit**, dengan pesan `Job Portal: admin melihat pelamar dan mengekspor`. Setelah itu push ke main dan pantau deploy.
