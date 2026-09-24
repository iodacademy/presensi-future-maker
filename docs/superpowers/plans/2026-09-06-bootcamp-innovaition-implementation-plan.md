# Bootcamp InnovAItion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans` to implement the approved phase task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not treat this document as permission to deploy or modify Figma.

**Goal:** Membangun aplikasi internal tiga peran yang mengikuti Design UI, dengan login/session Firebase, kelas, tugas, presensi QR dan mentoring privat.

**Architecture:** Next.js App Router menjadi UI dan backend. Browser hanya melakukan Firebase client sign-in sementara untuk menukar ID token menjadi session cookie; seluruh data melalui backend dengan Firebase Admin SDK. Transaksi Firestore menjaga kuota, presensi, submission dan impor; worker Calendar terpisah menangani integrasi idempoten.

**Tech Stack:** Node.js 24, npm, Next.js 16, React 19, TypeScript strict, Firebase Auth/Firestore/Storage, Vitest, React Testing Library, Playwright, Firebase Emulator Suite, Google Calendar API.

## Global Constraints

- Sumber spesifikasi: `../specs/2026-09-06-bootcamp-innovaition-app-design.md`, versi 1.0 untuk review.
- Referensi Figma hanya `Design UI`, file `V8iZp2tgVjRr6ypcKqeapB`.
- Enum role `admin`, `student`, `mentor`; field penentu `role`, bukan `participant`.
- Login hanya email terdaftar melalui custom auth; bukan email terverifikasi. Session lima hari.
- Mentor tidak dapat membaca submission atau memberi nilai. Admin adalah penilai.
- Slot 45 menit; satu siswa per slot; kuota dua per fase; cancel hanya admin sebelum mulai.
- Zona waktu Asia/Jakarta; timestamp UTC. Online presensi `[19:00,22:00)` WIB, token QR valid 30 detik.
- Input file PDF/ZIP/JPG maksimum 10.485.760 byte atau satu URL HTTPS, bukan keduanya.
- Capstone individu setelah semua tugas harian snapshot terkumpul; daftar wajib dikunci saat kelas aktif.
- Impor `.xlsx` maksimal 100 baris, 5 MiB, preview dan all-or-nothing.
- Daftar maksimal 25 baris/cursor; ekspor maksimal 10.000 baris/request.
- Semua code comment baru memakai Indonesia lebih dulu lalu Inggris. Source code default ASCII; UI Bahasa Indonesia.
- Tidak ada secret/data pribadi/token dalam repository atau log; test tidak mengirim email/Calendar produksi.
- Terapkan aturan basis data lokal sebelum menulis query/storage; tidak ada list tanpa batas atau data base64.
- Tidak commit/push, membuat resource berbayar atau deploy tanpa permintaan eksplisit.

## Status dan Cara Membaca

Ini rencana induk seluruh produk dan urutan dependensinya. Tiap work package memiliki batas file, kontrak, acceptance dan pengujian. Detail langkah kecil tahap pertama ada di `2026-09-06-foundation-auth-implementation-plan.md`.

Tahap berikutnya dieksekusi per work package setelah tahap dependensinya lulus, bukan satu scaffold besar yang seolah-olah seluruh fitur sudah selesai. Sebelum mengerjakan package berikut, pecah checklist package menjadi red-test, implementasi minimal, green-test dan review. Jangan mengubah spec ketika menemukan ambiguitas bisnis; ajukan perubahan eksplisit.

## Struktur File Target

```text
src/
  app/
    (auth)/login/page.tsx
    (student)/app/
    (admin)/admin/
    (mentor)/mentor/
    presensi/page.tsx
    api/
    layout.tsx
    globals.css
    manifest.ts
  components/
    app-shell.tsx
    button.tsx
    field.tsx
    dialog.tsx
    data-state.tsx
  lib/
    firebase/admin.ts
    firebase/client.ts
    env.ts
    errors.ts
    time.ts
  features/
    auth/
    classes/
    users/
    assignments/
    tasks/
    files/
    attendance/
    mentoring/
    calendar/
    dashboard/
    exports/
scripts/
  bootstrap-admin.ts
tests/
  unit/
  integration/
  e2e/
  fixtures/
firebase.json
firestore.rules
firestore.indexes.json
storage.rules
```

`policy.ts` untuk aturan murni yang perlu unit test; `service.ts` untuk operasi server per fitur; `schema.ts` untuk validasi input/tipe fitur. Jangan otomatis membuat semua nama file pada setiap fitur jika tidak dibutuhkan. Semua query berada dalam modul pemilik data, bukan di komponen UI.

## Kontrak Bersama

```ts
export type Role = 'admin' | 'student' | 'mentor';
export type Phase = 'bootcamp' | 'internship';
export type Actor = { uid: string; role: Role; classId: string | null };
export type Page<T> = { items: T[]; nextCursor: string | null };
export type ApiErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_INPUT'
  | 'CONFLICT' | 'RATE_LIMITED' | 'SERVICE_UNAVAILABLE';
export type ApiFailure = { error: { code: ApiErrorCode; message: string } };
```

Actor hanya dibuat `requireActor()` setelah verifikasi session dan user aktif. Route handler tidak menerima actor dari JSON. Service menerima Actor dan memeriksa izin per operasi. Tipe response tidak menyalin seluruh Firestore document.

HTTP: 401 tanpa sesi valid; 403 role/scope ditolak; 404 resource tidak ditemukan atau disembunyikan dari pengguna tak berhak; 409 konflik state/versi; 422 input salah; 429 rate limit; 503 gangguan dependency. Pilih 403/404 konsisten pada satu jenis resource dan uji agar tidak membocorkan data.

---

## Tahap 1: Fondasi, Auth dan Session

**Rencana detail:** `2026-09-06-foundation-auth-implementation-plan.md`.

**Files:** fondasi `src/app`, `src/components`, `src/lib/firebase`, `src/features/auth`, konfigurasi tooling/emulator dan `scripts/bootstrap-admin.ts`.

**Consumes:** spesifikasi AUTH-01 sampai AUTH-08, belum membutuhkan data produksi atau Google Calendar.

**Produces:** aplikasi dapat dijalankan lokal, bootstrap admin, form email-only, session lima hari, role guard, logout, shell yang menunjukkan state belum ada data tanpa metrik palsu.

- [ ] Jalankan task 1-7 pada rencana fondasi.
- [ ] Verifikasi seluruh acceptance AUTH dan guard role dengan emulator.
- [ ] Verifikasi mobile 360/390px, desktop 1280px dan keyboard.
- [ ] Catat versi package nyata, command yang lulus/gagal, dan batas yang belum diuji.

**Gate:** tidak ada bypass ketika emulator/cloud tidak terkonfigurasi. Tidak ada fitur bisnis yang diklaim selesai hanya karena shell sudah tampil.

## Tahap 2: Kelas, Roster dan Assignment

### Package 2A: Draft kelas dan mentor kelas

**Create:** `src/features/classes/schema.ts`, `policy.ts`, `service.ts`, `src/app/api/classes/route.ts`, `src/app/api/classes/[classId]/route.ts`, halaman `src/app/(admin)/admin/kelas/page.tsx`, `class-form.tsx` dalam fitur classes.

**Tests:** `tests/unit/classes.test.ts`, `tests/integration/classes.test.ts`, `tests/e2e/admin-classes.spec.ts`.

**Consumes:** Actor dari tahap 1; profile mentor aktif dari users.

**Produces:** `createClass(actor, { city, programName, mentorIds }): Promise<{ id: string }>` dan `listClasses(actor, { cursor }): Promise<Page<ClassSummary>>`. ClassSummary berisi id, city, programName, status, mentorCount, studentCount. Resource activate belum aktif sebelum package 3A.

- [ ] Tulis test draft tanpa mentor berhasil, city/program kosong ditolak, kelas duplikat case-normalized ditolak dan program sama beda kota diterima.
- [ ] Jalankan `npm run test:unit -- tests/unit/classes.test.ts`, pastikan gagal karena service/policy belum ada.
- [ ] Buat classKeys dan classes dalam satu transaksi; hitung counts tanpa menarik semua users; hanya admin boleh mutasi.
- [ ] Implementasikan frame A1/A2 dengan kartu/tabel, pencarian terbatas, pagination, modal dan state kosong/gagal.
- [ ] Jalankan unit/integration/E2E spesifik package, termasuk dua create paralel nama sama.

**Acceptance:** CLS-02, CLS-03. Draft kelas dapat dibuat tanpa akun mentor sebagai prasyarat roster.

### Package 2B: Impor akun atomik

**Create:** `src/features/users/import-schema.ts`, `import-service.ts`, `xlsx.ts`, `src/app/api/users/import/preview/route.ts`, `commit/route.ts`, `src/app/(admin)/admin/akun/page.tsx`.

**Tests:** `tests/unit/user-import.test.ts`, `tests/integration/user-import.test.ts`, `tests/e2e/admin-import.spec.ts`; fixture `.xlsx` dihasilkan test dari rows, tanpa email peserta asli.

**Consumes:** kelas draft yang ada, normalisasi email tahap 1; importer hanya student/mentor.

**Produces:** `previewUserImport(actor, { rows, classId }): Promise<ImportPreview>` dan `commitUserImport(actor, { rows, classId, idempotencyKey }): Promise<{ jobId: string; created: number }>`.

ImportPreview = `{ rows: { rowNumber, name, email, role, classId, errors: string[] }[]; valid: boolean }`. Preview bukan izin commit; server memvalidasi ulang.

- [ ] Tulis kasus satu email duplikat/kelas salah di 100 rows menghasilkan nol user/index; case-insensitive email duplikat dalam file; kolom kelas per-kelas tidak cocok tetap ditolak.
- [ ] Jalankan unit merah, implementasikan parsing XLSX tanpa evaluasi formula, limit bytes/rows dan validasi header/type; file salah/zip bomb ditolak melalui batas parser.
- [ ] Implementasikan transaksi seluruh users/emailIndex/importJob; Auth tidak dipanggil pada commit roster.
- [ ] Uji dua commit paralel email sama dan retry job sama; body berbeda dengan key sama menghasilkan 409.
- [ ] Implementasikan frame E1 dengan preview dua jalur dan tombol Simpan Semua Akun; tidak ada aksi simpan parsial.
- [ ] Jalankan unit/integration/E2E package; uji outage saat commit tidak meninggalkan subset data.

**Acceptance:** IMP-01, IMP-02, IMP-03. Pembuatan profil admin tidak lewat file roster.

### Package 2C: Assignment dan portal peserta mentor

**Create:** `src/features/assignments/schema.ts`, `service.ts`, `src/app/api/assignments/route.ts`, `src/app/api/mentor/students/route.ts`, `src/app/(mentor)/mentor/peserta/page.tsx`.

**Tests:** `tests/integration/assignments.test.ts`, `tests/e2e/mentor-students.spec.ts`.

**Produces:** `assignMentor(actor, { studentId, phase, mentorId }): Promise<void>`; `listAssignedStudents(actor, { classId, phase, cursor }): Promise<Page<{ id: string; name: string; className: string }>>`.

- [ ] Tulis kasus siswa/mentor beda kelas, role bukan mentor, mentor nonaktif dan penggantian setelah ada booking ditolak.
- [ ] Simpan assignment dengan ID deterministik siswa+fase dan audit metadata; validasi mentorIds kelas.
- [ ] Ganti makna frame C2 menjadi assignment peserta ke mentor per fase; jangan menampilkan jadwal tertentu pada popup.
- [ ] Bangun daftar peserta mentor dengan shell sekeluarga Figma, tanpa nilai/submission/presensi.
- [ ] Uji mentor lintas kelas hanya membaca siswa yang di-assign, bukan seluruh kelas yang mentor itu tangani.

**Acceptance:** ASN-01, MTR-01 bagian daftar peserta. Aktivasi kelas lengkap dituntaskan bersama kurikulum pada package 3A.

## Tahap 3: Kurikulum, File, Submission dan Nilai

### Package 3A: Course builder dan aktivasi

**Create:** `src/features/tasks/schema.ts`, `authoring-service.ts`, `src/app/api/classes/[classId]/tasks/route.ts`, `src/app/api/classes/[classId]/activate/route.ts`, `src/app/(admin)/admin/kelas/[classId]/page.tsx`.

**Tests:** `tests/integration/course-builder.test.ts`, `tests/e2e/course-builder.spec.ts`.

**Produces:** `createTask(actor, input): Promise<{ id: string }>`; input = `{ classId, kind, title, description, dueAt, briefUrl, briefFileId }`. `activateClass(actor, classId): Promise<void>` mengunci snapshot dan menerbitkan tugas atomik.

- [ ] Test kelas tanpa mentor/daily/Capstone tidak aktif; dua Capstone ditolak; task daily<=100 agar aktivasi muat dalam batas transaksi.
- [ ] Pisahkan tasks dari taskDetails; implementasikan frame A3 dan form tambah/edit yang belum ada di Figma.
- [ ] Aktivasi memeriksa seluruh task snapshot lalu update published dan class status dalam transaksi yang sama.
- [ ] Setelah aktif, uji delete/add/unpublish/ubah jenis/deadline ditolak; edit deskripsi/brief masih boleh dengan audit.
- [ ] Uji CLS-01 dari database kosong melalui seluruh alur, tanpa seed kelas aktif sebagai pengganti pengujian aktivasi.

### Package 3B: File privat dan normalisasi

**Create:** `src/features/files/schema.ts`, `service.ts`, `src/app/api/files/upload/route.ts`, `src/app/api/files/[fileId]/finalize/route.ts`, `src/app/api/files/[fileId]/download/route.ts`, `scripts/cleanup-files.ts`.

**Tests:** `tests/unit/file-validation.test.ts`, `tests/integration/files.test.ts`.

**Produces:** `beginUpload(actor, input): Promise<{ fileId: string; uploadUrl: string }>`; input = `{ purpose: 'brief' | 'submission'; taskId: string; name: string; byteSize: number; mimeType: string }`. `finalizeUpload(actor, fileId): Promise<{ fileId: string; ready: true }>` dan `getDownloadUrl(actor, fileId): Promise<{ url: string; expiresAt: string }>`.

- [ ] Pastikan usulan normalisasi JPG dalam spec disetujui sebelum mengimplementasikannya; bila ditolak, revisi spec/storage plan dahulu, bukan sembunyikan perubahan format.
- [ ] Test batas 10.485.760 byte, signature berbeda dari MIME, owner lain dan file pending tidak dapat dipakai/diunduh.
- [ ] Upload ke staging, verifikasi generation, normalisasi JPG yang sudah disetujui, copy dengan no-overwrite precondition ke final, simpan generation final.
- [ ] Uji URL staging dipakai ulang tidak mengubah object final atau file yang sudah dinilai.
- [ ] Test signed download expired dan scope owner/admin; emulator test adapter tidak menggantikan uji URL bertanda tangan pada bucket staging.
- [ ] Implementasikan cleanup pending>24jam dan orphan tanpa menghapus objek masih direferensikan.

### Package 3C: Submission dan Capstone

**Create:** `src/features/tasks/submission-policy.ts`, `submission-service.ts`, `src/app/api/tasks/[taskId]/submission/route.ts`, `src/app/(student)/app/tugas/page.tsx`, `[taskId]/page.tsx`.

**Tests:** `tests/unit/submission-policy.test.ts`, `tests/integration/submissions.test.ts`, `tests/e2e/student-tasks.spec.ts`.

**Produces:** `submitTask(actor, { taskId, fileId, url, expectedVersion, idempotencyKey }): Promise<{ submissionId: string; version: number; late: boolean }>`.

- [ ] Tulis test tepat satu sumber, HTTPS, boundary deadline, class ownership dan capstone terkunci.
- [ ] Transaksi memeriksa task, snapshot kelas, ready-file ownership, seluruh syarat capstone, versi submission dan status dinilai sebelum menulis.
- [ ] Simpan taskKind server-side, firstSubmittedAt immutable, submittedAt versi terakhir, score null dan preview ringkas.
- [ ] Bangun frame tugas mobile/desktop termasuk Capstone terbuka, upload progress, replacement, error dan status dinilai.
- [ ] Uji semua TSK dan CAP; uji request ganda tidak menggandakan counter dailySubmittedCount.

### Package 3D: Penilaian dan ekspor tugas

**Create:** `src/features/tasks/grading-service.ts`, `src/features/exports/csv.ts`, `src/app/api/submissions/[submissionId]/grade/route.ts`, `src/app/api/exports/tasks/route.ts`, halaman admin tugas dan detail.

**Tests:** `tests/unit/csv.test.ts`, `tests/integration/grading.test.ts`, `tests/e2e/admin-grading.spec.ts`.

**Produces:** `gradeSubmission(actor, { submissionId, expectedVersion, score, feedback, correctionReason }): Promise<void>`; CSV memfilter taskKind/classId dan hanya memilih field rekap.

- [ ] Test score 0/100, tolak pecahan/-1/101, mentor ditolak dan versi tidak cocok menghasilkan konflik.
- [ ] Transaksi grade mengunci version; simpan feedback panjang di document detail dan preview<=160 karakter pada submission.
- [ ] Buat frame D1 dan detail penilaian; urutkan submittedAt menaik dengan document ID sebagai tie-breaker.
- [ ] Uji race grade/replacement menghasilkan hanya satu perubahan valid, bukan nilai pada file yang belum dinilai.
- [ ] Uji sanitasi formula CSV, filter kedua tab, pagination dan batas 10.000 rows.

**Gate tahap 3:** CLS-01, TSK-01 sampai TSK-05, CAP-01, GRD-01 dan GRD-02 lulus. Tidak menampilkan klaim SLA feedback 2x24 jam.

## Tahap 4: Jadwal dan Presensi

### Package 4A: Authoring dan impor jadwal

**Create:** `src/features/attendance/schedule-schema.ts`, `schedule-service.ts`, `src/lib/time.ts`, route sessions/manual/import, halaman admin jadwal/detail dan siswa jadwal.

**Tests:** `tests/unit/schedule.test.ts`, `tests/integration/schedules.test.ts`, `tests/e2e/schedules.spec.ts`.

**Produces:** `createSession(actor, input): Promise<{ id: string }>`; input = `{ classId, title, date, startTime, endTime, mode, zoomUrl, address, mapsUrl }`, date/time WIB dikonversi eksplisit UTC.

- [ ] Test online tanpa Zoom, offline tanpa alamat/Maps, akhir<=awal, tanggal invalid dan duplikat ditolak.
- [ ] Implementasikan manual/Excel dengan preview/all-or-nothing seperti batas spec, tanpa memakai importer akun untuk field berbeda.
- [ ] Tampilkan sesi aktif/berikutnya/selesai, filter moda dan tautan lokasi sesuai frame B1/B2 serta jadwal siswa.
- [ ] Larang pengubahan waktu sesi dengan presensi existing agar sessionEndsAt snapshot tetap konsisten.

### Package 4B: Token, scan dan monitor

**Create:** `src/features/attendance/qr.ts`, `policy.ts`, `service.ts`, route monitor/close/open/scan, halaman presensi dan scanner HP.

**Tests:** `tests/unit/attendance-policy.test.ts`, `tests/integration/attendance.test.ts`, `tests/e2e/attendance.spec.ts`.

**Produces:** `getQrMonitor(actor, sessionId): Promise<QrMonitor>`; QrMonitor = `{ serverNow, currentToken, nextToken, currentExpiresAt, nextValidFrom, nextExpiresAt, attendeeCount }`. `recordAttendance(actor, { token, source }): Promise<{ recordedAt: string; alreadyRecorded: boolean }>`.

- [ ] Test jendela WIB dan signed token nbf/expiry/revision, signature rusak serta token dari sesi lain.
- [ ] Endpoint admin mengembalikan dua jendela token untuk countdown lokal; polling 30 detik hanya selama dialog aktif, hapus QR jika token valid tidak ada.
- [ ] Scanner memproses satu token pada satu waktu, melepas camera stream saat keluar, memulihkan permission error dan meminta scan ulang bila token habis saat login.
- [ ] POST same-origin tervalidasi melakukan transaksi satu attendance/counter; GET tidak mutasi.
- [ ] Bangun B3 dan state scan/sukses; desktop menjelaskan pakai HP tanpa akses QR generator siswa.
- [ ] Test 20 scan paralel satu siswa menghasilkan satu record; test close/revision membatalkan token yang sudah diterbitkan.
- [ ] Tambah route ekspor presensi memakai CSV helper dan izin admin.

**Gate tahap 4:** ATT-01 sampai ATT-06; scan HP nyata melalui HTTPS dicatat terpisah dari kamera mock E2E.

## Tahap 5: Mentoring, Calendar dan Portal Mentor

### Package 5A: Periode dan impor slot

**Create:** `src/features/mentoring/schema.ts`, `slot-service.ts`, route periods/slots/import, UI admin mentoring.

**Tests:** `tests/unit/mentoring-slot.test.ts`, `tests/integration/mentoring-slots.test.ts`.

**Produces:** `createPeriod(actor, { classId, phase, startsAt, endsAt }): Promise<void>`; `importSlots(actor, { classId, phase, mentorId, rows, idempotencyKey }): Promise<{ created: number }>`.

- [ ] Test mentor nonanggota kelas, slot masa lalu/luar periode/lintas hari dan duplikat ditolak.
- [ ] Kunci mentorDays per tanggal di transaksi untuk pemeriksaan interval overlap lintas kelas, termasuk dua importer bersamaan.
- [ ] Import Tanggal/Jam menghitung akhir 45 menit, maksimal 100 rows dan 32 slot mentor per hari.
- [ ] Implementasikan C1, filter fase, preview slot dan ringkasan tanpa label kapasitas kelompok.

### Package 5B: Booking, kuota dan cancel

**Create:** `src/features/mentoring/booking-policy.ts`, `booking-service.ts`, route bookings/cancel, UI mentoring siswa.

**Tests:** `tests/unit/booking-policy.test.ts`, `tests/integration/bookings.test.ts`, `tests/e2e/mentoring.spec.ts`.

**Produces:** `bookSlot(actor, { slotId, acknowledgeEarlySecondSession, idempotencyKey }): Promise<{ bookingId: string }>`; `cancelBooking(actor, bookingId): Promise<void>`.

- [ ] Tulis red test MEN-01 sampai MEN-05; bedakan idempotent retry sukses dari booking ketiga.
- [ ] Transaksi read-all-before-write pada user/class/assignment/period/slot/quota, lalu tulis slot+quota+booking+job+idempotency result.
- [ ] Batalkan hanya sebelum mulai; decrement kuota dan release slot sekali; buat job cancel dengan bookingId yang sama.
- [ ] UI siswa mengikuti frame 03/07, warning konfirmasi kedua, conflict saat slot direbut dan state Meet belum siap.
- [ ] Uji beban konkurensi pada emulator dan ulang transaksi tidak memicu panggilan Calendar dari dalam callback transaksi.

### Package 5C: Worker Calendar dan jadwal mentor

**Create:** `src/features/calendar/google-client.ts`, `worker.ts`, `src/app/api/internal/calendar-jobs/route.ts`, route retry admin, halaman `/mentor/jadwal`, ekspor mentoring.

**Tests:** `tests/integration/calendar-jobs.test.ts`, `tests/e2e/mentor-schedule.spec.ts`, panduan smoke staging Google.

**Produces:** `processCalendarJob(jobId: string): Promise<void>` dengan credential server; internal route memakai identitas scheduler/secret terpisah dari login email-only, bukan endpoint worker terbuka.

- [ ] Fake Google client mensimulasikan timeout setelah create berhasil, pending conference, rate limit, lease expired dan cancel/create race.
- [ ] Gunakan eventId deterministik format valid Google dari bookingId, conference requestId stabil, lease job atomik dan retry terbatas/backoff.
- [ ] Update Meet hanya saat conference siap, kirim undangan dengan organizer yang dikonfigurasi; jangan menyisipkan link contoh Figma.
- [ ] Portal mentor menampilkan booking dirinya, peserta assignment, status dan tombol Meet yang benar-benar tersedia; tidak ada nilai/submission.
- [ ] Uji CAL-01 sampai CAL-03 dan MTR-01; uji organizer, peserta/mentor external, email undangan dan host approval dengan kalender staging nyata sebelum produksi.
- [ ] Uji CSV mentoring dengan scope/filter dan sanitasi yang sama, bukan menyalin export semua booking ke browser.

## Tahap 6: Home, Kualitas dan Rilis

**Create:** `src/features/dashboard/service.ts`, halaman Home final, `tests/integration/dashboard.test.ts`, `tests/e2e/app-journeys.spec.ts`, `docs/operations.md`, `docs/query-budget.md`.

**Consumes:** seluruh modul sebelumnya; tidak ada fake metric pada Home produksi.

- [ ] Test pemilihan sesi aktif/berikutnya, sudah hadir, tanpa mentoring, tugas terlambat, kurang dari 24 jam dan pembagi nol.
- [ ] Implementasikan Home 01/05 dengan agregat server, ringkasan payload<=4KiB, tanpa mengambil seluruh submission/attendance.
- [ ] Uji semua menu/aksi pada tiga role; tidak ada route coming-soon dalam rilis final.
- [ ] Uji 360/390/768/1280px, safe area, keyboard, modal, focus, kontras dan network error.
- [ ] Implementasikan manifest/install PWA tanpa cache offline data pribadi/session/API. Jangan menjanjikan scan atau submit offline.
- [ ] Jalankan seluruh lint/typecheck/unit/integration/E2E/build dengan log hasil nyata.
- [ ] Ukur payload, call frequency, Firestore reads/writes dan download files pada skala dua tahun yang dikonfirmasi, bukan data uji saat ini.
- [ ] Siapkan origin HTTPS, secret store, Firebase rules/indexes, Google organizer, backup/retensi dan prosedur penutupan aplikasi sesudah program.
- [ ] Minta persetujuan deployment terpisah; jangan menjalankan Firebase deploy sebagai bagian test.

## Peta Coverage

| Spesifikasi | Package |
|---|---|
| AUTH-01..08, peran, session, bootstrap | Tahap 1 |
| CLS-01..03, IMP-01..03, ASN-01 | 2A, 2B, 2C, 3A |
| TSK-01..05, CAP-01, GRD-01..02, storage | 3A..3D |
| ATT-01..06, jadwal dan CSV | 4A, 4B |
| MEN-01..05, CAL-01..03, MTR-01 | 2C, 5A..5C |
| Home, navigasi, visual, PWA | Tahap 1 dan 6, UI masing-masing package |
| Query budget, retensi, staging dan deployment | Semua package data dan tahap 6 |

## Risiko dan Prasyarat

- Java belum ditemukan melalui PATH; integration emulator tidak boleh diberi status lulus sebelum runtime terpenuhi.
- Firebase/Google project dan credential belum diverifikasi. Pengembangan lokal memakai emulator dan fake Google provider, bukan endpoint produksi.
- Batas akun nyata, jumlah kelas/sesi dan retensi belum dikonfirmasi; budget produksi belum dapat dinyatakan selesai.
- Signed URL/GCS generation dan masuk Meet tanpa approval perlu staging nyata, tidak cukup fake test.
- Email-only tetap memungkinkan penyamaran. Deployment internal/restriksi jaringan harus dinyatakan apa adanya, bukan dianggap aman karena Firebase session.

## Serah Terima Eksekusi

Setelah pengguna menyetujui spec dan plan, mulai tahap 1 saja. Gunakan agen per task jika tersedia atau jalankan inline dengan checkpoint; jangan menjalankan dua task yang mengubah file auth/schema bersama secara paralel. Review patch dan hasil test sebelum mengambil task selanjutnya.

Tidak membuat Git commit karena belum diminta dan folder belum merupakan repository. Jika pengguna meminta Git nanti, inisialisasi/staging/commit dilakukan sebagai pekerjaan terpisah dengan pemeriksaan secret dan diff.
