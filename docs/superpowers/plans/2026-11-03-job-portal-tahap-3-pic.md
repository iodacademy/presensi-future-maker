# Job Portal Tahap 3 (Portal PIC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PIC perusahaan masuk ke `/mitra`, memilah kandidat perusahaannya, mengundang interview (Meet otomatis, link luar, atau offline), lalu mengisi hasil. Siswa mengonfirmasi undangan di Lamaran Saya.

**Architecture:**
- **Peran baru `partner`:** dokumen `users` memuat `partnerId`, dan `Actor.partnerId` terisi di sesi.
- **Layanan PIC** di `src/features/careers/partner-service.ts`. Setiap fungsi memeriksa `application.partnerId === actor.partnerId`.
- **Interview** di `src/features/careers/interview-service.ts`. Link Meet otomatis memakai `createCalendarEvent` dari `src/features/calendar/client.ts` (aksi `create` Apps Script yang sudah ada; PIC sebagai `mentorEmail` menjadi co-host, dan Calendar mengirim email undangan).
- **Rute API** di `src/app/api/mitra/*` dengan penjaga `asPartner`.
- **Halaman** klien di `src/app/(mitra)/mitra/*`, memakai `AppShell role="partner"`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Firebase Admin, vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-job-portal-design.md` (bagian 9 Tahap 3, 10, 11a, 12).

## Global Constraints

- **Komentar kode:** dua bahasa, Indonesia lalu Inggris.
- **Kueri:** semua kueri memakai kesetaraan saja (tanpa indeks gabungan), dan kueri daftar memakai `.select(...)` dengan kolom yang disebutkan.
- **Login PIC:** email saja, lewat `/api/auth/login` yang sudah ada (keputusan pemilik produk).
- **Data siswa yang terlihat PIC:** data diri lamaran, CV, surat, portofolio, lampiran, jawaban, dan nilai akhir. Tanpa kehadiran dan tanpa nilai per tugas.
- **Isolasi perusahaan:** PIC perusahaan A tidak pernah bisa membaca atau mengubah lamaran, berkas, atau profil perusahaan B. Lamaran milik perusahaan lain diperlakukan sebagai "Lamaran tidak ditemukan".
- **Interview:**
  - `durationMin` hanya 30, 45, atau 60;
  - mode `online` atau `offline`;
  - `linkSource` `meet-auto` atau `manual`;
  - link manual wajib http(s);
  - alamat wajib untuk offline;
  - pewawancara wajib;
  - catatan maksimal 500 karakter;
  - waktu dimasukkan dalam WIB.
- **Pesan standar tidak lolos** tetap `REJECT_MESSAGE`. `rejectReason` tidak pernah dikirim ke siswa.

## Review Focus

1. **PIC perusahaan lain memakai id lamaran, CV, atau berkas tugas yang ditebak:** 404/403 (Task 2 dan 3).
2. **PIC mencoba status di luar haknya** (mis. `baru`, atau `interview` tanpa formulir undangan): ditolak (Task 2).
3. **Meet otomatis dipilih saat jembatan kalender belum dikonfigurasi atau gagal:** pesan jelas, status tidak berubah (Task 4).
4. **Jadwal ulang:** acara kalender lama dibatalkan sebelum yang baru dibuat, dan konfirmasi siswa kembali ke `pending` (Task 4).
5. **Siswa mengonfirmasi lamaran milik siswa lain, atau lamaran yang tidak berstatus interview:** ditolak (Task 4).

---

### Task 1: Peran PIC dan akun login

**Files:**
- Modify:
  - `src/features/auth/types.ts` (`Role` + `'partner'`; `UserDocument.partnerId?: string | null`; `Actor.partnerId?: string | null`)
  - `src/features/auth/policy.ts` (`isValidRole`)
  - `src/features/auth/paths.ts` (`partner` → `/mitra`; `/mitra` hanya untuk `partner`)
  - `src/features/auth/session.ts` (isi `partnerId` untuk peran partner)
  - `src/middleware.ts` (lindungi `/mitra`)
  - `src/components/app-shell.tsx` (label "Mitra"; menu Dashboard `/mitra`, Kandidat `/mitra/kandidat`, Jadwal interview `/mitra/jadwal`, Profil perusahaan `/mitra/profil`)
  - `src/app/(admin)/admin/akun/page.tsx` (`Record<Role, number>` + `partner: 0`)
  - `src/features/careers/admin-service.ts`: `createPicAccounts(partnerId): Promise<{ created: string[]; existing: string[] }>`, dan `listPartners` menambah `picAccounts: string[]` (email PIC yang sudah punya akun)
  - `src/app/api/karier/partners/[id]/accounts/route.ts` (POST)
  - `src/app/(admin)/admin/job-portal/partner-form.tsx` (tombol "Aktifkan login PIC" pada mitra yang sudah tersimpan, dengan ringkasan hasilnya)
  - `src/app/api/karier/guard.ts` (`asPartner`: 403 `'Hanya PIC mitra yang diizinkan'`, dan wajib `actor.partnerId`)
- Test: `tests/unit/careers-pic-accounts.test.ts`, `tests/unit/auth-paths*.test.ts` (yang ada, tambah kasus)

`createPicAccounts`:
- Untuk setiap PIC di `partners/{id}.pics`, cari `emailIndex/{hash}`.
  - Belum ada: buat `users/{uid}` (`role 'partner'`, `partnerId`, `name`, `email`, `normalizedEmail`, `active: true`, `classId: null`) dan `emailIndex/{hash}` dalam satu batch.
  - Sudah ada dan miliknya akun `partner` dengan `partnerId` yang sama: masuk `existing`.
  - Sudah ada untuk akun lain: tolak seluruhnya dengan `'Email <email> sudah dipakai akun lain. Pakai email lain untuk PIC.'`.

- [ ] **Step 1: Failing tests:**
  - akun dibuat dengan peran dan `partnerId`;
  - memanggil dua kali tidak membuat akun ganda (`existing`);
  - email milik siswa → galat persis seperti di atas, dan tidak ada akun yang dibuat;
  - `getRoleRedirectPath('partner')` → `'/mitra'`;
  - `isAuthorizedPath('partner','/admin')` → false.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementasi.**
- [ ] **Step 4:** `npx vitest run tests/unit --maxWorkers=2` dan `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit**, dengan pesan `Job Portal: peran PIC mitra dan akun login`.

### Task 2: Layanan PIC (bacaan dan keputusan)

**Files:**
- Create:
  - `src/features/careers/partner-service.ts`
  - `src/app/api/mitra/dashboard/route.ts`
  - `src/app/api/mitra/jobs/[id]/candidates/route.ts`
  - `src/app/api/mitra/candidates/[id]/route.ts` (GET detail, PATCH keputusan)
  - `src/app/api/mitra/profile/route.ts` (GET, PATCH)
  - `src/app/api/mitra/logo/route.ts` (POST gambar ke `mitra/<partnerId>` lewat `storeImage`)
- Test: `tests/unit/careers-partner.test.ts`

**Interfaces:**
- `partnerDashboard(actor, now)` mengembalikan `{ partnerName, stats: { newCount, shortlist, interviews, activeJobs }, jobs: { id, title, employment, scheme, quota, closesAt, applicantCount, newCount }[] }`.
  - Lamaran dibaca dengan `where('partnerId','==',pid).select('jobId','status')`.
  - Lowongan dibaca dengan `where('partnerId','==',pid)` dan field kartu saja.
- `listCandidates(actor, jobId)`: menolak dengan `'Lowongan tidak ditemukan'` bila `jobs/{jobId}.partnerId` berbeda. Mengembalikan `ApplicantRow[]` dari `listApplicants`.
- `getCandidate(actor, appId)`:
  - lamaran perusahaan lain → `'Lamaran tidak ditemukan'`;
  - status `baru` diubah menjadi `ditinjau` (dengan `statusChangedAt`);
  - mengembalikan detail seperti `getApplicationForAdmin`.
- `decideCandidate(actor, appId, status, reason?)`: status yang boleh dipilih PIC hanya `ditinjau`, `shortlist`, `diterima`, dan `tidak-lolos`. Selain itu ditolak dengan `'Status ini tidak bisa dipilih'`. Penulisan memakai `setApplicationStatus`.
- `getOwnProfile(actor)` / `updateOwnProfile(actor, raw)`: PIC hanya boleh mengubah `field`, `about`, `website`, `socials`, dan `logo`. `name` dan `pics` tetap dari dokumen yang ada. Validasi lewat `validatePartnerInput`.

- [ ] **Step 1: Failing tests:**
  - PIC p2 membaca lamaran p1 → `'Lamaran tidak ditemukan'`;
  - membuka kandidat `baru` → menjadi `ditinjau`;
  - status `baru` dan `interview` lewat `decideCandidate` → `'Status ini tidak bisa dipilih'`;
  - `updateOwnProfile` yang mengirim `name` lain tidak mengubah nama;
  - dashboard menghitung `newCount` per lowongan;
  - rute `/api/mitra/dashboard` oleh siswa → 403.
- [ ] **Step 2–4:** RED → implementasi → GREEN, lalu seluruh suite.
- [ ] **Step 5: Commit**, dengan pesan `Job Portal: layanan PIC untuk memilah kandidat`.

### Task 3: Akses berkas bagi PIC

**Files:**
- Modify:
  - `src/features/careers/cv-service.ts` (`readCvFile`): PIC boleh membuka bila ada `jobApplications` `where partnerId==actor.partnerId, cvId==id`, atau `coverLetterId==id`.
  - `src/features/tasks/submission-file.ts` (`readSubmissionFile`): PIC boleh membuka bila ada lamaran `where partnerId==pid, studentId==sub.studentId` yang `tasks`-nya memuat `submissionId`.
- Test: `tests/unit/careers-pic-files.test.ts`

- [ ] **Step 1: Failing tests:**
  - PIC p1 membuka CV pelamar p1 → berhasil;
  - PIC p2 → `'Tidak boleh membuka berkas ini'`;
  - berkas tugas yang dilampirkan ke lamaran p1 → berhasil untuk p1, ditolak untuk p2;
  - berkas tugas yang tidak dilampirkan → ditolak untuk p1.
- [ ] **Step 2–4:** RED → implementasi → GREEN.
- [ ] **Step 5: Commit**, dengan pesan `Job Portal: PIC membuka berkas pelamar perusahaannya`.

### Task 4: Interview

**Files:**
- Modify: `src/features/careers/model.ts`, dengan tambahan:
  - `Interview { date; start; durationMin: 30|45|60; mode: 'online'|'offline'; linkSource: 'meet-auto'|'manual'; url; address; interviewer; note; confirmation: 'pending'|'hadir'|'jadwal-ulang'; rescheduleNote; calendarEventId: string|null; invitedAt }`
  - `validateInterviewInput(raw): Omit<Interview,'confirmation'|'rescheduleNote'|'calendarEventId'|'invitedAt'|'url'> & { url: string }`
  - `interviewStartIso(i): string` (WIB → ISO)
  - `interviewMessage(input: { studentName; jobTitle; partnerName; interview }): string`
- Create:
  - `src/features/careers/interview-service.ts`
  - `src/app/api/mitra/candidates/[id]/interview/route.ts` (POST)
  - `src/app/api/mitra/interviews/route.ts` (GET)
  - `src/app/api/karier/lamaran/[id]/konfirmasi/route.ts` (POST siswa)
- Modify: `src/features/careers/student-service.ts`: `MyApplication.interview` diisi (tanpa `calendarEventId`) bila status `interview`.
- Test: `tests/unit/careers-interview.test.ts` (dengan `src/features/calendar/client` di-mock)

**Interfaces:**
- `inviteToInterview(actor, appId, raw, now)` mengembalikan `{ waLink: string | null; meetUrl: string }`.
  - Lamaran harus milik perusahaan PIC.
  - Bila ada `interview.calendarEventId`, batalkan dulu lewat `cancelCalendarEvent`; kegagalan pembatalan dicatat tapi tidak menghentikan proses.
  - `meet-auto`:
    - bila `isCalendarConfigured()` false → `'Link Meet otomatis belum tersedia. Tempel link meeting sendiri.'`;
    - panggil `createCalendarEvent({ bookingId: 'interview-' + appId, summary: 'Interview ' + jobTitle + ' · ' + partnerName, description: catatan, startsAt, endsAt, studentEmail: personal.email, mentorEmail: actor.email })`;
    - `meetUrl` kosong → `'Link Meet belum terbentuk. Coba lagi atau tempel link sendiri.'`.
  - Disimpan: `interview` (`confirmation 'pending'`), `status 'interview'`, dan `statusChangedAt`.
  - `waLink = whatsAppLink(personal.phone, interviewMessage(...))`.
- `listInterviews(actor)`: lamaran `where partnerId==pid, status=='interview'`, `select('number','jobId','personal.fullName','personal.phone','interview')`.
- `respondInterview(actor, appId, response: 'hadir'|'jadwal-ulang', note)`:
  - siswa pemilik saja (`studentId === actor.uid`);
  - status harus `interview`;
  - `jadwal-ulang` wajib catatan → `'Tulis alasan dan usulan waktu lain'`.

- [ ] **Step 1: Failing tests:**
  - `validateInterviewInput`: durasi 20 ditolak; manual tanpa link http(s) ditolak; offline tanpa alamat ditolak;
  - `interviewMessage` memuat posisi, perusahaan, tanggal dan jam WIB, dan link;
  - `meet-auto` tanpa konfigurasi → galat, status tetap;
  - undangan sah → status `interview`, `waLink` diawali `https://wa.me/62`;
  - jadwal ulang memanggil `cancelCalendarEvent` dengan id lama, dan konfirmasi kembali ke `pending`;
  - `respondInterview` oleh siswa lain → `'Lamaran tidak ditemukan'`;
  - `listMyApplications` membawa `interview` tanpa `calendarEventId`.
- [ ] **Step 2–4:** RED → implementasi → GREEN, lalu seluruh suite.
- [ ] **Step 5: Commit**, dengan pesan `Job Portal: undangan interview dan konfirmasi siswa`.

### Task 5: Halaman portal PIC dan kartu interview siswa

**Files:**
- Create:
  - `src/app/(mitra)/mitra/page.tsx` (dashboard: "Halo, <nama>", 4 angka, kartu lowongan berisi "Lihat kandidat")
  - `src/app/(mitra)/mitra/kandidat/page.tsx` (`?job=`; tab status Baru, Ditinjau, Shortlist, Interview, Diterima, Tidak lolos; tabel Nama, Kelas FM, Nilai akhir, Dikirim, Status, "Review CV")
  - `src/app/(mitra)/mitra/kandidat/[id]/page.tsx` (pratinjau CV `<iframe>` dari `/api/karier/cv/<id>` + Unduh; jawaban; data diri; portofolio; lampiran; "DATA FUTURE MAKERS" berisi kelas dan nilai akhir; keputusan Lolos & undang interview, Simpan ke shortlist, Tidak lolos dengan alasan internal)
  - `src/app/(mitra)/mitra/kandidat/[id]/invite-form.tsx` (formulir undangan; sesudah terkirim menampilkan "Kirim lewat WhatsApp" ke `waLink` dan link Meet)
  - `src/app/(mitra)/mitra/jadwal/page.tsx` (daftar interview, status konfirmasi siswa dan catatannya, tombol Diterima / Tidak diterima, "Jadwalkan ulang" ke halaman kandidat)
  - `src/app/(mitra)/mitra/profil/page.tsx` (ubah bidang, deskripsi, logo, situs, media sosial)
- Modify: `src/app/(student)/app/karier/page.tsx`: kartu Lamaran Saya berstatus interview menampilkan Tanggal, Waktu, Mode, link atau alamat, Pewawancara, Catatan, serta tombol "Konfirmasi hadir" dan "Minta jadwal ulang" (textarea alasan).
- Test: `tests/unit/careers-invite-form.test.tsx`

Acuan desain: `FITUR TAMBAHAN/Mitra — Seleksi Kandidat` (Mitra.png) dan bagian undangan di `Siswa — Portal Karier`.

- [ ] **Step 1: Failing test:**
  - memilih "Link sendiri" memunculkan isian link;
  - mengirim memanggil `POST /api/mitra/candidates/a1/interview` dengan isian;
  - respons `{ waLink }` memunculkan tautan "Kirim lewat WhatsApp" dengan `href` = `waLink`.
- [ ] **Step 2–4:** RED → implementasi → GREEN; `npx tsc --noEmit`.
- [ ] **Step 5: Verifikasi peramban** dengan skrip Playwright di scratchpad dan dev server port 3457:
  1. Admin membuat mitra uji dengan PIC email `pic.uji@contoh.test`, mengaktifkan login, dan membuat lowongan `project`.
  2. Siswa uji (placement project bila ada; bila tidak, sementara memakai baris ringkasan uji yang dibersihkan di akhir) melamar.
  3. PIC masuk, membuka kandidat (status menjadi Ditinjau), lalu mengundang interview mode **manual** (link `https://meet.google.com/uji-uji-uji`). Mode `meet-auto` tidak diuji di peramban agar tidak mengirim undangan Calendar sungguhan.
  4. Tombol WhatsApp muncul.
  5. Siswa mengonfirmasi hadir, lalu PIC melihat "Hadir" dan mengisi Diterima.
  6. Ambil tangkapan layar 1440 px dan 390 px.
  7. Bersihkan semua data uji, termasuk `users` dan `emailIndex` PIC uji.
- [ ] **Step 6: Commit**, dengan pesan `Job Portal: portal PIC dan kartu interview siswa`. Setelah itu push ke main dan pantau deploy.
