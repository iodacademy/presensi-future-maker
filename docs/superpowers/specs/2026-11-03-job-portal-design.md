# Rancangan Job Portal (Portal Karier)

Tanggal: 3 November 2026
Status: menunggu persetujuan pemilik produk
Contoh tampilan: `FITUR TAMBAHAN/` (tiga zip: Siswa — Portal Karier, Admin — Kelola Lowongan, Mitra — Seleksi Kandidat). Contoh itu acuan desain, bukan kode yang disalin.

## 1. Tujuan

Mitra perusahaan Future Makers membuka lowongan magang dan kerja untuk peserta dan alumni bootcamp. Peserta melamar dari dalam aplikasi dengan CV dan karya yang sudah mereka buat selama bootcamp. PIC perusahaan memilah sendiri pelamarnya dan mengundang interview.

Nilai khasnya dibanding papan lowongan umum: lamaran membawa bukti kerja nyata dari bootcamp, yaitu karya Pameran yang sudah terbit dan tugas mingguan LMS, ditambah nilai akhir bootcamp.

Target waktu: lowongan pertama bisa dilamar siswa pagi ini, Selasa 3 November 2026.

## 2. Tahapan

Pemilik produk membagi pekerjaan menjadi tiga tahap. Setiap tahap di-deploy sendiri setelah diverifikasi.

| Tahap | Isi | Siap dipakai saat |
|---|---|---|
| 1. Admin | Kelola mitra (profil, logo, PIC) dan lowongan | Admin bisa memasang lowongan |
| 2. Siswa | Menu Karier, profil perusahaan, bank CV, formulir lamaran, Lamaran Saya. Admin melihat pelamar dan mengekspor .xlsx | Siswa bisa melamar |
| 3. Portal PIC | Akun PIC, pilah kandidat, undang interview, hasil seleksi | PIC memilah sendiri |

Selama Tahap 3 belum jadi, admin melihat semua lamaran yang masuk sehingga tidak ada yang hilang.

## 3. Sasaran

1. Admin memasang lowongan lengkap dengan periode, syarat pelamar, dokumen yang diminta, dan pertanyaan tambahan.
2. Siswa melamar dalam beberapa menit memakai CV yang sudah tersimpan, serta melampirkan karya Pameran dan tugas mingguan miliknya.
3. PIC hanya melihat lowongan dan pelamar perusahaannya sendiri.
4. Undangan interview sampai ke siswa lewat aplikasi, email, dan WhatsApp.
5. Biaya Firestore tetap kecil: kueri daftar tidak membawa teks panjang.

## 4. Bukan Sasaran

1. PIC membuat atau mengubah lowongan. Lowongan dibuat admin; PIC hanya mengisi profil perusahaannya (Tahap 3).
2. Pengiriman WhatsApp otomatis oleh sistem. Butuh layanan berbayar pihak ketiga.
3. Papan lowongan publik tanpa login.
4. Pencarian teks bebas lowongan. Filter bidang sudah cukup untuk jumlah lowongan yang ada.

## 5. Anti-sasaran (gagal walaupun berjalan)

1. PIC perusahaan A bisa melihat pelamar, CV, atau data perusahaan B.
2. PIC melihat kehadiran, nilai per tugas, atau data internal siswa lain selain nilai akhir.
3. CV bisa dibuka lewat URL publik oleh siapa pun yang memegang tautannya.
4. Siswa kehilangan isian lamaran karena halaman tertutup sebelum dikirim.
5. CV yang sudah terkirim berubah isinya karena siswa mengganti CV di bank CV-nya.

## 6. Keputusan Pemilik Produk

1. Tiga tahap: Admin, Siswa, Portal PIC.
2. Siswa menyimpan lebih dari satu CV. Saat melamar, siswa memilih CV yang sudah ada atau mengunggah yang baru.
3. Lampiran karya berasal dari karya Pameran milik siswa yang sudah terbit, ditambah tugas mingguan LMS.
4. PIC punya akun sendiri. Admin menambahkan mitra dan PIC. PIC masuk ke portal, memilah CV, dan mengundang interview.
5. Mitra punya profil: logo, deskripsi singkat, bidang usaha, situs, dan media sosial. Siswa bisa melihat profil ini.
6. Link interview dibuat otomatis (Google Meet lewat jembatan Apps Script), atau PIC menempelkan link luar (Zoom, Microsoft Teams, Meet lain), atau interview offline dengan alamat kantor.
7. Undangan interview dikirim lewat WhatsApp dengan tombol yang membuka chat ke nomor pelamar, berisi pesan siap kirim: posisi, perusahaan, jadwal, mode, link atau alamat, dan catatan. Email undangan dikirim lewat GAS.
8. Data bootcamp yang dilihat perusahaan hanya nilai akhir.

## 7. Keadaan Sekarang yang Relevan

- **Peran:** `Role = 'admin' | 'student' | 'mentor'` (`src/features/auth/types.ts`). Penjaluran di `src/features/auth/paths.ts`.
- **Login:** hanya dengan email terdaftar, tanpa password (`src/app/api/auth/login/route.ts`). Lihat pertanyaan terbuka di bagian 12.
- **Profil peserta:** `studentProfiles/{uid}` memuat `phone`. Nama dan email ada di `users/{uid}`.
- **Karya Pameran:** `exhibitionWorks`, dengan `personUid`, `status: 'published'`, `title`, `type`, `cover.thumb`. Halaman publiknya `/karya/[id]`.
- **Tugas mingguan:** `submissions` (`id = ${taskId}_${studentId}`), dengan `taskKind` `daily | working-paper | capstone`, `taskTitle`, `fileId` (berkas di Firebase Storage, dibuka lewat `/api/submissions/[id]/file` dengan pemeriksaan akses), atau `url`.
- **Nilai akhir:** dihitung oleh `getFinalGrades(classId)` (berat, membaca seluruh data kelas). Ringkasan harian `dashboardSnapshots/{tanggal}` memuat `ranking[].score` per siswa.
- **Gambar publik:** `storeImage(buf, folder)` di `src/features/exhibition/media.ts` menyimpan webp `{thumb, full}`. Folder dibatasi `karya/<id>`, `peserta/<id>`, `situs`. Aturan Storage membuka baca publik hanya untuk `pameran/**`. Semua berkas lain privat dan dilayani lewat server.
- **WhatsApp:** `whatsAppLink(phone, message)` di `src/lib/whatsapp.ts` membuat tautan `wa.me` dengan pesan terisi.
- **Apps Script:** `scripts/apps-script/Code.gs`, aksi `create` membuat acara Kalender dengan ruang Meet (dipakai mentoring). `MailApp` sudah dipakai untuk email pengingat. Perubahan Code.gs harus ditempel dan di-deploy manual oleh pemilik produk.

## 8. Model Data

Semua akses lewat server (Admin SDK), mengikuti pola aplikasi sekarang.

### `partners/{id}` — mitra

`name` (unik, dicek tanpa beda huruf besar-kecil), `field` (bidang usaha), `about` (deskripsi singkat), `logo {thumb, full}` | null, `website`, `socials { instagram, linkedin, tiktok, youtube }` (semua opsional), `pics: [{ name, phone, email }]`, `active`, `createdAt`, `updatedAt`.

Logo disimpan lewat `storeImage` ke folder `mitra/<id>` (pola folder diperluas). Logo tampil sebagai inisial berwarna bila belum ada, seperti di contoh.

### `jobs/{id}` — lowongan

- `partnerId`, `partnerName` (salinan untuk kartu)
- `title`, `employment`: `'magang-3' | 'magang-6' | 'kontrak' | 'full-time'`
- `category`: `'teknologi' | 'desain' | 'pemasaran' | 'administrasi'`
- `location`, `workMode`: `'hybrid' | 'wfo' | 'remote'`, `quota`
- `description`, `qualifications: string[]` (teks panjang; tidak ikut kueri daftar)
- `eligibility`: `{ mode: 'all' }` | `{ mode: 'classes', classIds }` | `{ mode: 'min-score', minScore }`
- `opensAt`, `closesAt` (ISO; `closesAt` dasar hitung mundur)
- `documents`: `{ portfolio, works, coverLetter }`, masing-masing `'required' | 'optional' | 'off'`. CV selalu wajib.
- `questions: [{ id, label, kind: 'long' | 'yes-no' | 'choice', options?, required }]`
- `status`: `'draft' | 'published'`. Lowongan dianggap tutup bila `now > closesAt`; tidak ada status terpisah.
- `applicantCount` (penghitung, ditambah dalam transaksi saat lamaran dikirim)
- `createdAt`, `updatedAt`

### `studentCvs/{id}` — bank CV

`ownerUid`, `fileName`, `size`, `storagePath` (`cv/<uid>/<id>.pdf`, privat), `uploadedAt`, `deleted` (bool).

PDF saja, maksimal 2 MB, maksimal 5 CV aktif per siswa. Berkas CV tidak pernah ditimpa. Menghapus CV dari bank hanya menandai `deleted`; berkasnya tetap ada selama dirujuk lamaran (anti-sasaran 5).

### `careerProfiles/{uid}` — isian data diri terakhir

`city`, `school`, `major`, `linkedin`, `updatedAt`. Disimpan setiap kali lamaran dikirim, dipakai mengisi otomatis lamaran berikutnya. Nama, email, dan nomor WhatsApp diambil dari `users` dan `studentProfiles`. Nomor yang diubah di formulir hanya berlaku untuk lamaran itu.

### `jobApplications/{jobId}_{uid}` — lamaran

Satu siswa satu lamaran per lowongan.

- `jobId`, `partnerId`, `studentId`, `classId`, `number` (`FM-JOB-0001`, dari dokumen penghitung `counters/jobApplications` dalam transaksi)
- `personal { fullName, email, phone, city, school, major, linkedin }`
- `cvId`, `cvFileName`
- `portfolioUrl`, `coverLetterPath` (PDF opsional, privat, `cv/<uid>/surat-<id>.pdf`)
- `works: [{ id, title, type, cover }]` (salinan saat melamar)
- `tasks: [{ submissionId, title, kind }]` (salinan saat melamar)
- `answers: { [questionId]: string }`
- `finalScore`: number | null, `finalScorePending`, `finalScoreAt`. Diambil dari ringkasan dashboard terbaru saat lamaran dikirim (keputusan builder 4 dan 8 di bagian 11).
- `status`: `'baru' | 'ditinjau' | 'shortlist' | 'interview' | 'diterima' | 'tidak-lolos'`
- `rejectReason` (internal, tidak pernah dikirim ke siswa)
- `interview` (Tahap 3, lihat bagian 10)
- `submittedAt`, `updatedAt`, `statusChangedAt`

Label status di sisi siswa:

| Status | Label siswa |
|---|---|
| `baru` | Terkirim |
| `ditinjau`, `shortlist` | Dilihat mitra |
| `interview` | Undangan interview |
| `diterima` | Diterima |
| `tidak-lolos` | Belum lolos, dengan pesan standar: "Terima kasih sudah melamar. Kali ini kamu belum lolos ke tahap berikutnya." |

Shortlist sengaja tampil sama dengan "Dilihat mitra" bagi siswa.

## 9. Tampilan per Tahap

### Tahap 1 — Admin (`/admin/job-portal`)

Menu "Job Portal" di sidebar admin. Acuan: `Admin.dc.html`.

1. **Ringkasan:** Lowongan aktif, Total pelamar, Mitra terdaftar, Interview terjadwal. Angka diambil dengan `count()` atau penjumlahan `applicantCount`, bukan dengan menarik seluruh lamaran.
2. **Tab Lowongan:** tabel berisi posisi dan jenis, perusahaan dan PIC, tutup dalam (hitung mundur; merah bila kurang dari 24 jam), jumlah pelamar, status (Draf, Aktif, Ditutup), dan tombol "Lihat pelamar" (isinya dibangun di Tahap 2).
3. **Tab Mitra & PIC:** daftar mitra; formulir tambah dan ubah mitra berisi nama, bidang, deskripsi, logo, situs, media sosial, serta satu atau lebih PIC (nama, HP, email). Di Tahap 1, data PIC hanya disimpan; akun login PIC dibuat di Tahap 3.
4. **Tambah dan ubah lowongan:** tiga bagian seperti contoh (Perusahaan; Detail posisi; Periode dan isian lamaran), dengan pratinjau kartu di portal siswa. Tombol Simpan draf dan Publikasikan. Kualifikasi diisi satu per baris. Pertanyaan tambahan bisa ditambah, diubah, dan dihapus. Lowongan yang sudah punya pelamar tidak bisa dihapus, hanya diubah.

### Tahap 2 — Siswa (`/app/karier`)

Menu "Karier" dengan lencana "Baru" di sidebar siswa. Acuan: `Siswa.dc.html`.

1. **Tab Lowongan:**
   - Spanduk berisi hitung mundur ke `closesAt` terjauh di antara lowongan yang sedang dibuka.
   - Filter bidang: Semua, Teknologi, Desain, Pemasaran, Administrasi.
   - Kartu lowongan berisi logo, posisi, perusahaan, jenis, lokasi dan mode, kuota, sisa waktu, jumlah pelamar atau "Sudah dilamar", dan tombol "Lihat detail".
   - Hanya lowongan `published` dengan `opensAt <= now` dan yang memenuhi `eligibility` siswa yang tampil. Lowongan yang sudah tutup hilang dari daftar, tetapi tetap ada di Lamaran Saya.
2. **Detail lowongan:** tentang posisi, kualifikasi, dokumen yang diminta, tahapan seleksi, hitung mundur, dan tombol "Lamar sekarang" (atau "Sudah dilamar — lihat status"). Nama perusahaan membuka profil perusahaan.
3. **Profil perusahaan** (`/app/karier/mitra/[id]`): logo, nama, bidang, deskripsi, situs, media sosial, dan lowongan perusahaan itu yang sedang dibuka.
4. **Formulir lamaran** (`/app/karier/[jobId]/lamar`), langkah bertahap seperti contoh:
   1. Data diri, terisi otomatis.
   2. Dokumen:
      - CV: pilih dari bank CV atau unggah baru. CV yang diunggah langsung masuk bank.
      - Link portofolio dan surat lamaran, sesuai pengaturan lowongan.
      - "Lampirkan karya": daftar centang karya Pameran milik siswa yang sudah terbit (sampul, judul, jenis), lalu tugas mingguan yang sudah dikumpulkan (judul tugas, ada berkas atau tautannya).
   3. Pertanyaan tambahan.
   4. Periksa lamaran, dengan tombol "Ubah" per bagian. Kalimat "Setelah dikirim, lamaran tidak bisa diubah".
   5. Lamaran terkirim, dengan nomor lamaran.

   Isian yang belum dikirim tersimpan di `localStorage` peramban per lowongan, dan dipulihkan saat formulir dibuka lagi. Server menolak lamaran bila lowongan sudah tutup, siswa tidak memenuhi syarat, sudah pernah melamar, dokumen wajib kosong, atau CV, karya, dan tugas yang dirujuk bukan milik siswa itu.
5. **Tab Lamaran Saya:** daftar lamaran dengan status. Kartu undangan interview tampil di sini sejak Tahap 3.
6. **Bank CV:** dikelola dari langkah dokumen: unggah, ganti nama tampilan, hapus. Tidak perlu halaman sendiri.
7. **Admin, Lihat pelamar** (`/admin/job-portal/[jobId]`):
   - Tabel pelamar berisi nama, kelas, nilai akhir, waktu kirim, status, dan "Terakhir diubah".
   - Detail satu lamaran: CV (dibuka lewat rute server), karya, tugas, dan jawaban.
   - Tombol "Ekspor .xlsx".
   - Admin juga bisa mengubah status lamaran, supaya seleksi bisa berjalan sebelum Tahap 3 jadi.

### Tahap 3 — Portal PIC (`/mitra`)

Acuan: `Mitra.dc.html`.

1. **Akun:**
   - Peran baru `partner`. `users/{uid}` menyimpan `partnerId`.
   - Admin membuat akun dari tab Mitra & PIC, satu akun per email PIC. Satu perusahaan bisa punya lebih dari satu PIC.
   - Cara masuk menunggu keputusan (bagian 12).
2. **Dashboard:** "Halo, [nama]". Ringkasan pelamar baru, shortlist, interview terjadwal, dan lowongan aktif. Kartu lowongan perusahaannya berisi jumlah pelamar, jumlah yang baru, dan sisa waktu.
3. **Kandidat:**
   - Tab per status. Tabel berisi nama, kelas, nilai akhir, waktu kirim, dan status.
   - Tidak ada kolom kehadiran (keputusan 8).
   - Membuka kandidat berstatus `baru` mengubahnya menjadi `ditinjau`.
4. **Review CV:**
   - Pratinjau PDF dan tombol unduh.
   - Jawaban pelamar dan nomor WhatsApp.
   - "Buka portofolio".
   - Karya dan tugas yang dilampirkan, tanpa nilai tugas.
   - Nilai akhir.
   - Keputusan: Lolos & undang interview, Simpan ke shortlist, atau Tidak lolos (dengan alasan internal).
5. **Undang interview:** lihat bagian 10.
6. **Jadwal interview:**
   - Daftar interview berikut status konfirmasi siswa.
   - Setelah interview, PIC mengisi hasil: Diterima atau Tidak diterima (dengan alasan internal).
7. **Profil perusahaan:** PIC bisa mengubah deskripsi, logo, situs, dan media sosial perusahaannya.
8. **Akses berkas:** CV, surat lamaran, dan berkas tugas yang dilampirkan bisa dibuka PIC hanya bila berkas itu dirujuk lamaran ke perusahaannya. Rute berkas tugas yang sekarang (`/api/submissions/[id]/file`) diperluas dengan aturan ini.

## 10. Interview (Tahap 3)

Isi `jobApplications.interview`:

- `date`, `start` (WIB), `durationMin` (30, 45, atau 60)
- `mode`: `'online' | 'offline'`
- `linkSource`: `'meet-auto' | 'manual'`, dan `url`
- `address` (untuk mode offline)
- `interviewer`, `note`
- `confirmation`: `'pending' | 'hadir' | 'jadwal-ulang'`, dan `rescheduleNote`
- `calendarEventId` (bila Meet dibuat otomatis)

Alurnya:

1. PIC mengisi formulir undangan. Bila memilih "Buat link Meet otomatis", server memanggil aksi `create` Apps Script yang sudah ada dengan email siswa dan PIC, lalu menyimpan link Meet-nya. Bila aksi itu tidak cukup untuk interview, misalnya butuh judul dan deskripsi sendiri, Code.gs diubah. Pemilik produk menempel dan men-deploy versi barunya.
2. Status menjadi `interview`. Email undangan dikirim lewat GAS (`MailApp`).
3. Layar sukses menampilkan tombol "Kirim lewat WhatsApp" (`whatsAppLink`) ke nomor di lamaran, berisi pesan siap kirim.
4. Siswa melihat kartu undangan di Lamaran Saya, lalu menekan "Konfirmasi hadir" atau "Minta jadwal ulang" (dengan alasan dan usulan waktu). PIC melihat status itu dan bisa menjadwalkan ulang.

## 11. Keputusan Builder (dibuat penulis rancangan, bisa dikoreksi)

1. Rute: `/admin/job-portal`, `/app/karier`, `/mitra`.
2. "Lihat pelamar" dan ekspor .xlsx dibangun di Tahap 2, karena baru berisi setelah siswa bisa melamar.
3. Draf lamaran disimpan di `localStorage`, bukan Firestore. CV sudah tersimpan di bank begitu diunggah, jadi yang bisa hilang hanya isian teks.
4. `finalScore` disalin dari `dashboardSnapshots` terbaru saat lamaran dikirim, bukan dihitung ulang tiap PIC membuka halaman. Satu baca dokumen per lamaran. Bila belum ada nilai, tampil "Belum ada nilai akhir". Syarat `min-score` memakai angka yang sama.
5. Admin juga bisa mengisi dan mengubah profil mitra, supaya lowongan tampil rapi sebelum PIC punya akun.
6. Lowongan yang sudah tutup tidak tampil di daftar siswa.
7. **Alumni** berarti peserta yang akunnya tetap aktif setelah bootcamp selesai. Per 3 November 2026, keempat kelas masih aktif dan belum ada angkatan lama yang dinonaktifkan, jadi tidak perlu jenis akses khusus. Bila kelas ditutup nanti, akun peserta tetap aktif supaya Karier bisa dipakai. Peserta nonaktif (yang mengundurkan diri) memang tidak bisa melamar.
8. **Nilai akhir sementara.** Ringkasan dashboard hanya dibangun ulang saat admin membuka dashboard, dan selama capstone belum dinilai, nilainya parsial. Lamaran menyimpan `finalScore`, `finalScorePending` (true bila ada komponen yang belum dinilai), dan `finalScoreAt` (tanggal ringkasan). PIC dan admin melihat label "sementara" dan tanggalnya. Field ringkasan yang dibaca bernama `ranking`.
9. **Urutan dalam Tahap 2,** supaya siswa bisa melamar secepatnya:
   - lamaran inti: CV, karya, tugas, pertanyaan, dan kirim;
   - lalu Lamaran Saya;
   - lalu tampilan pelamar untuk admin;
   - ekspor .xlsx paling akhir.
10. **Sebelum Tahap 3 jadi,** CV sampai ke perusahaan secara manual. Admin membuka dan mengunduh CV per pelamar dari tampilan pelamar, lalu meneruskannya sendiri. Tidak ada pengiriman otomatis dan tidak ada tautan publik (anti-sasaran 3).
11. **Satu email PIC untuk satu akun dan satu mitra.** PIC yang juga mentor memakai email lain untuk akun PIC-nya, supaya model satu pengguna satu peran tetap berlaku.

## 12. Pertanyaan Terbuka

1. **Cara PIC masuk (sebelum Tahap 3).** Siswa, mentor, dan admin masuk hanya dengan mengetik email. Untuk PIC perusahaan luar yang membuka CV dan nomor WhatsApp siswa, cara ini berarti siapa pun yang tahu email PIC bisa masuk. Pilihannya:
   - Sama seperti pengguna lain (email saja).
   - Password, seperti di contoh ("email undangan untuk membuat password").
   - Kode sekali pakai yang dikirim ke email PIC setiap kali masuk.

   Jawabannya menentukan seberapa besar pekerjaan login di Tahap 3.
