# Spesifikasi Aplikasi Bootcamp InnovAItion

Tanggal: 2026-09-06
Versi: 1.0 untuk review tertulis sebelum implementasi.
Status: arah produk dan aturan inti disetujui dalam percakapan; rincian engineering pada dokumen ini diajukan untuk review akhir.

## 1. Tujuan dan Sumber Kebenaran

Aplikasi internal untuk mengelola peserta Bootcamp InnovAItion by Plan Indonesia selama beberapa bulan: kelas, jadwal, presensi, mentoring privat, tugas harian, Capstone, dan penilaian admin. Aplikasi web responsif/PWA, bukan aplikasi Android/iOS terpisah.

Urutan sumber kebenaran:

1. Keputusan pengguna terbaru yang tercatat dalam dokumen ini.
2. `Design UI`, file Figma `V8iZp2tgVjRr6ypcKqeapB`, untuk tampilan.
3. `2026-09-06-design-ui-reconciliation.md` untuk jejak perbandingan 24 frame.
4. `2026-09-01-bootcamp-innovaition-alur-produk.md` untuk riwayat kebutuhan, bukan untuk mengalahkan koreksi terbaru.

File Figma lain tidak menjadi referensi. Pekerjaan aplikasi tidak otomatis mengubah Figma. Nama, email, angka, tanggal dan tautan contoh desain bukan data produksi atau komitmen SLA.

## 2. Keputusan yang Sudah Disetujui

| ID | Keputusan |
|---|---|
| DEC-01 | Next.js + TypeScript; Firebase Auth, Firestore dan Firebase Storage; satu backend data |
| DEC-02 | Login cukup mengetik email terdaftar, tanpa password, OTP, tautan email atau Google login |
| DEC-03 | Firebase custom authentication dan session cookie tetap digunakan |
| DEC-04 | Peran berasal dari field `role` pada dokumen user, BUKAN `participant` |
| DEC-05 | Tiga peran: admin, siswa, mentor; mentor hanya melihat peserta bimbingan dan jadwal/booking sendiri, bukan menilai tugas |
| DEC-06 | Mentoring privat mandiri: satu slot untuk satu peserta; assignment menentukan mentor per fase, bukan mengalokasikan jadwal |
| DEC-07 | Slot 45 menit; maksimal dua booking per fase; pembatalan sebelum mulai hanya oleh admin dan mengembalikan kuota |
| DEC-08 | Kelas dapat dibuat draft tanpa mentor; siswa satu kelas aktif; mentor boleh lintas kelas |
| DEC-09 | Semua impor memakai preview dan all-or-nothing; email duplikat ditolak, tidak menimpa akun |
| DEC-10 | Zona waktu Asia/Jakarta; online otomatis 19.00-22.00 pada tanggal sesi, dapat ditutup admin lebih awal; offline manual |
| DEC-11 | Tugas dan Capstone individu; PDF/ZIP/JPG maksimum 10 MB atau tautan HTTPS; ganti sebelum dinilai; terlambat berdasarkan versi terakhir |
| DEC-12 | Capstone setelah seluruh tugas harian wajib terkumpul, tidak harus dinilai; daftar wajib dikunci saat kelas aktif |
| DEC-13 | Session lima hari; tidak ada pendaftaran umum; akun aktif dan role diperiksa server |
| DEC-14 | Figma terbaru mengalahkan panduan tipografi/sidebar lama; login dan mentor mengikuti pola visual yang ada |

Detail engineering yang belum diminta secara khusus, seperti logout semua perangkat, larangan mengubah deadline kelas aktif, pembatasan jendela offline, aktivasi sekaligus publikasi, batas impor, dan normalisasi JPG, adalah usulan dalam review tertulis ini. Jangan menganggapnya sudah disetujui hanya karena DEC-01 sampai DEC-14 disetujui.

## 3. Batas Cakupan

### Termasuk versi pertama

- Login, sesi, logout, bootstrap admin dan penonaktifan akun melalui operasi admin terbatas.
- Kelas Kota+Kelas, mentor kelas, impor akun dan assignment mentor per fase.
- Course builder, brief, submission individu, penilaian admin dan Capstone.
- Jadwal manual/Excel, presensi QR melalui HP, monitor dan rekap CSV.
- Periode mentoring, impor slot, booking, pembatalan admin, Calendar/Meet dan retry integrasi.
- Portal mentor terbatas, Home peserta, navigasi responsif dan state gagal/kosong/loading.
- Manifest PWA dan pemasangan pada browser yang mendukung. Mutasi tetap membutuhkan koneksi.

### Tidak termasuk versi pertama

- Registrasi publik, password, OTP, link login email dan login Google.
- Portal penilaian mentor, chat, pembayaran, sertifikat, video player dan notifikasi push.
- Mentoring kelompok, Capstone kelompok, pembatalan mandiri dan reschedule otomatis peserta.
- Kehadiran mentoring otomatis dari Google Meet atau pembuktian presensi berbasis GPS/wajah.
- Aplikasi native, custom URL scheme `app://`, dan penyimpanan offline data pribadi.
- SLA feedback 2x24 jam atau rubrik contoh Figma sebagai aturan global.
- Deploy publik, pembuatan resource berbayar atau pengiriman undangan produksi tanpa persetujuan operasional.

## 4. Peran dan Otorisasi

Enum aplikasi baru: `admin`, `student`, `mentor`. Label Indonesia: Admin, Siswa, Mentor. Jika sudah ada data Firebase dengan enum berbeda, inspeksi struktur tersanitasi dan sepakati migrasi sebelum integrasi; jangan membuat pemetaan kompatibilitas berdasarkan tebakan.

| Operasi | Admin | Siswa | Mentor |
|---|---|---|---|
| Kelola kelas, jadwal, kurikulum, periode, slot dan impor | Semua kelas | Tidak | Tidak |
| Kelola role/status akun | Operasi admin tervalidasi | Tidak | Tidak |
| Baca konteks kelas dan jadwal | Semua | Kelas sendiri | Kelas yang ditangani |
| Baca peserta bimbingan | Semua | Profil sendiri | Peserta yang di-assign kepadanya pada fase terkait |
| Catat presensi siswa | Monitor saja; tidak menyamar sebagai siswa | Diri sendiri dengan QR valid | Tidak |
| Baca presensi dan ekspor | Semua | Milik sendiri | Tidak pada versi pertama |
| Booking mentoring | Memantau/membatalkan | Diri sendiri, mentor yang di-assign | Tidak memesan atas nama siswa |
| Lihat booking/Meet | Semua | Milik sendiri | Booking dirinya sebagai mentor |
| Baca brief | Semua | Kelas sendiri | Tidak perlu untuk portal versi pertama |
| Kumpulkan/ganti submission | Tidak atas nama siswa | Milik sendiri sebelum dinilai | Tidak |
| Baca submission dan nilai | Semua | Milik sendiri | Tidak |
| Beri nilai dan feedback | Ya | Tidak | Tidak |

Semua izin diperiksa backend untuk setiap operasi, termasuk ekspor dan download. Redirect atau menu tersembunyi bukan kontrol akses. Role tidak diterima dari request login atau disimpan sebagai sumber kebenaran di localStorage.

Admin terakhir yang aktif tidak dapat menonaktifkan dirinya atau menurunkan role-nya tanpa admin pengganti aktif. Perubahan role/status dicatat dan memengaruhi otorisasi request berikutnya.

## 5. Login dan Session

### 5.1 Alur

1. Browser mengambil challenge CSRF same-origin untuk form masuk.
2. Pengguna mengirim email. Normalisasi hanya trim dan lowercase; jangan menghapus titik atau bagian `+` email.
3. Backend memeriksa format, rate limit, indeks email, dokumen user aktif dan role dikenal.
4. UID dokumen user stabil dan sama dengan UID Firebase Auth. Akun Auth diprovisioning secara idempoten bila perlu; tidak ada pembuatan profil umum dari email sembarang.
5. Backend membuat custom token melalui Firebase Admin SDK. Service account hanya di server.
6. Browser memakai persistence in-memory dan `signInWithCustomToken`, lalu mengambil ID token.
7. Backend memverifikasi ID token, metode masuk custom, waktu login baru, akun aktif, dan origin/CSRF; backend menerbitkan Firebase session cookie lima hari.
8. Browser membersihkan state Firebase client setelah pertukaran. Navigasi berikutnya memakai cookie menuju backend Next.js.
9. Backend memverifikasi signature, expiry dan revocation session, kemudian membaca `role` dan status user untuk izin aktual.

Usulan guardrail: ID token untuk pertukaran sesi harus memiliki `auth_time` dalam lima menit terakhir; custom token bukan session cookie. Penolakan login akun tidak terdaftar/nonaktif/role tidak dikenal memakai pesan umum tanpa membocorkan role.

### 5.2 Cookie dan logout

- Session: HttpOnly, Secure pada HTTPS, SameSite=Lax, Path=/, tanpa Domain, expiry absolut lima hari.
- Lingkungan localhost boleh tanpa Secure dengan konfigurasi development eksplisit; produksi tidak boleh menurunkan atribut ini.
- Endpoint mutasi memeriksa Origin terhadap origin aplikasi yang dikonfigurasi dan token CSRF. Tidak mempercayai Host/X-Forwarded-Host sembarang sebagai origin yang diizinkan.
- Logout menghapus cookie dan mencabut refresh token user sehingga semua session Firebase user tersebut dicabut. UI menjelaskan bahwa logout berlaku pada semua perangkat.
- Gagal Firebase/database tidak membuat session fallback atau sesi demo produksi. Tampilan menunjukkan gangguan sementara.
- Token, cookie dan email lengkap tidak ditulis ke log request.
- Session cookie tidak dapat digunakan untuk mengautentikasi Firestore browser SDK. Data aplikasi menggunakan backend; tidak ada dua sumber sesi persisten.

### 5.3 Batas identitas yang diterima dalam rancangan

Email-only bukan pembuktian kepemilikan email. Orang yang mengetahui email terdaftar dapat memperoleh sesi identitas tersebut bila dapat mengakses pintu login. Firebase custom auth mempercayai keputusan backend; session, role, rate limit dan penggunaan internal tidak memperbaiki kelemahan ini.

Pengguna telah memilih alur ini setelah risikonya dijelaskan. Dokumentasi dan aplikasi tidak boleh mengklaim email terverifikasi atau login aman dari penyamaran. Penggunaan beberapa bulan juga tidak menghilangkan risiko. Rekomendasi operasional tetap pembatasan deployment pada lingkungan internal terkontrol; mekanismenya dibahas sebelum rilis data nyata, bukan diasumsikan sudah ada.

### 5.4 Kriteria penerimaan

- AUTH-01: email terdaftar aktif masuk ke area yang sesuai role, tanpa field password.
- AUTH-02: email tidak dikenal/nonaktif/role tidak dikenal tidak memperoleh custom token/session.
- AUTH-03: siswa yang meminta endpoint admin atau mentor menerima 403 walau memanipulasi URL/body.
- AUTH-04: cookie palsu, kedaluwarsa, dicabut atau token dari proyek lain ditolak.
- AUTH-05: role/status yang berubah berlaku pada request berikutnya; token lama tidak melestarikan izin lama.
- AUTH-06: pertukaran token/logout cross-origin atau tanpa CSRF yang valid ditolak.
- AUTH-07: refresh halaman mempertahankan login; logout mencabut sesi termasuk di perangkat lain.
- AUTH-08: database/Auth tidak tersedia menghasilkan kegagalan terkontrol, bukan bypass.

## 6. Kelas, Akun dan Assignment

### 6.1 Identitas kelas

Unit kelas adalah kombinasi kota dan nama program yang unik. ID internal tidak bergantung pada nama tampilan. Nama kanonis impor: `<Nama Program> - <Kota>`, misalnya `Web Programming - Semarang`.

Admin membuat kelas draft dengan kota dan nama program; pemilihan mentor boleh kosong. Setelah draft dibuat, admin dapat mengimpor akun mentor/siswa, memilih mentor kelas dan menyusun kurikulum. Ini menghilangkan ketergantungan melingkar kelas-mentor.

Aktivasi mensyaratkan minimal satu mentor, minimal satu tugas harian wajib yang siap terbit, dan tepat satu Capstone siap terbit. Jumlah peserta boleh nol. Aktivasi dalam satu transaksi merekam daftar ID tugas harian wajib, ID Capstone, menerbitkan seluruh tugas snapshot, dan mengubah kelas menjadi aktif. Daftar, jenis dan status publikasi tugas tersebut tidak dapat diubah setelah aktif; tidak ada tugas wajib yang ditarik dari akses siswa. Instruksi dan brief dapat dikoreksi dengan audit. Tidak ada perubahan deadline melalui UI setelah aktif pada versi pertama.

Siswa memiliki satu kelas aktif. Mentor dapat dipilih di beberapa kelas, tetapi jadwal mentoringnya tidak boleh saling tumpang tindih lintas kelas. Pemindahan siswa dengan riwayat bukan bagian versi pertama; perubahan tidak dilakukan dengan menimpa classId secara langsung.

### 6.2 Assignment

Admin memilih kelas, fase, mentor kelas, lalu siswa kelas tersebut. Satu siswa memiliki tepat satu assignment aktif per fase. Sebelum assignment lengkap, UI menampilkan Mentor belum ditetapkan, bukan slot mentor lain.

Mengganti mentor siswa pada suatu fase hanya diizinkan bila tidak ada booking non-batal pada fase tersebut. Riwayat sesi tidak dipindahkan ke mentor baru. Semua slot dan booking menyimpan mentorId eksplisit.

### 6.3 Impor akun

Format `.xlsx`, maksimum 100 baris data dan 5 MiB per file pada versi pertama. Batas ini batas operasional awal, bukan skala peserta total. Template dan pesan batas dapat diunduh/dilihat sebelum upload.

| Jalur | Kolom wajib | Kolom opsional |
|---|---|---|
| Global | Nama, Email, Role, Kelas | Tidak ada |
| Per kelas | Nama, Email, Role | Kelas; jika diisi harus cocok dengan kelas terpilih |

Role impor hanya `student` atau `mentor`; admin dibuat melalui bootstrap/operasi admin terpisah, bukan file roster. Akun mentor yang sudah ada ditambahkan ke kelas lain melalui pemilihan mentor, bukan diimpor ulang sebagai akun baru.

Seluruh file divalidasi sebelum preview: header, baris kosong, email, enum role, kelas, duplikat dalam file dan terhadap database. Preview kedua jalur menampilkan error per baris. Tombol Simpan Semua Akun nonaktif bila ada error. Server memvalidasi ulang saat konfirmasi karena data dapat berubah setelah preview.

Commit membuat seluruh dokumen user dan indeks email dalam satu transaksi Firestore; tidak mencakup Firebase Auth/email eksternal. Provisioning Firebase Auth dilakukan saat login pertama agar kegagalan layanan Auth tidak menyebabkan setengah roster tersimpan. ID job impor dan hash payload membuat retry konfirmasi idempoten. Dua impor bersamaan pada email yang sama tidak boleh membuat dua user.

### 6.4 Kriteria penerimaan

- CLS-01: database kosong dapat melalui bootstrap admin, draft kelas, impor mentor/siswa, kurikulum, assignment dan aktivasi tanpa siklus.
- CLS-02: duplikat Kota+Kelas ditolak; nama program yang sama di kota berbeda diperbolehkan.
- CLS-03: siswa/mentor tidak mengubah field role, status atau keanggotaan melalui API umum.
- IMP-01: satu baris salah pada kedua jalur membuat nol user/indeks email baru.
- IMP-02: preview yang valid tidak mengalahkan konflik baru saat commit.
- IMP-03: konfirmasi/retry ganda menghasilkan satu hasil impor, bukan akun duplikat.
- ASN-01: siswa hanya mendapat slot mentor assignment fase yang dipilih, termasuk bila mentor mengajar lintas kelas.

## 7. Tugas dan Capstone

Admin menyusun judul, deskripsi, deadline, brief berupa file atau link HTTPS, dan jenis `daily`/`capstone` pada kelas draft. Satu tugas memiliki satu brief aktif. Deadline ditampilkan WIB dan disimpan UTC.

Siswa melihat tugas kelasnya, memfilter Semua/Belum/Dinilai dan membuka detail. Daftar berisi ringkasan; instruksi panjang dan feedback penuh diambil pada detail. Preview feedback di daftar maksimal 160 karakter.

### 7.1 Submission

- Satu submission aktif per siswa per tugas.
- Input tepat satu sumber: file PDF/ZIP/JPG atau link HTTPS. Bila keduanya diisi, minta memilih salah satu, jangan menebak.
- Batas ukuran file yang ditampilkan 10 MB berarti 10 MiB atau 10.485.760 byte; server memakai batas yang sama.
- URL HTTPS dapat berupa Drive, GitHub, Figma atau layanan lain. Tolak URL dengan credential, host lokal/private literal, atau protokol non-HTTPS. Server tidak mengambil konten URL untuk memvalidasi akses.
- File masuk Firebase Storage privat; Firestore hanya menyimpan metadata dan object path. Tidak ada base64 dalam dokumen data.
- Waktu submit ditetapkan server setelah file selesai dan lolos pemeriksaan, bukan saat upload dimulai.
- Submit saat `submittedAt > dueAt` ditandai terlambat. Tepat pada deadline tidak terlambat.
- Ganti submission diperbolehkan sebelum dinilai, termasuk setelah deadline. Waktu versi terakhir menentukan urutan antrean dan keterlambatan. FirstSubmittedAt disimpan untuk audit.
- Penilaian dan penggantian bersamaan harus berserial melalui transaksi/version check; nilai tidak boleh menempel pada file yang belum diperiksa admin.
- Link di UI memakai `rel="noopener noreferrer"`; izin berbagi tetap tanggung jawab pemilik link dan dijelaskan pada form.

### 7.2 Penilaian

Hanya admin membuka submission lintas kelas, memfilter daily/capstone dan kelas, mengurutkan `submittedAt` menaik, lalu memberikan skor bilangan bulat 0-100 dan feedback teks. Nilai 0 adalah nilai sah, bukan belum dinilai.

Admin dapat mengoreksi nilai/feedback dengan alasan perubahan dan catatan audit. Submission tetap terkunci untuk siswa sesudah dinilai. Tidak ada tombol penilaian atau akses submission di portal mentor.

### 7.3 Kunci Capstone

Kelas aktif memiliki snapshot daftar tugas harian wajib. Capstone terbuka jika setiap ID dalam daftar memiliki submission valid milik siswa, tanpa menunggu nilai. Siswa tidak mendapat akses hanya dengan memalsukan angka progress dari browser.

Kelas draft atau daftar wajib kosong tidak membuka Capstone. Menambah tugas wajib setelah aktivasi ditolak; perbaikan instruksi tidak mengubah daftar syarat. Capstone memakai mekanisme upload, replacement, nilai dan keterlambatan yang sama dengan tugas harian.

### 7.4 Kriteria penerimaan

- TSK-01: hanya siswa kelas aktif terkait dapat membaca detail dan mengumpulkan tugas.
- TSK-02: kosong, dua sumber sekaligus, file lebih dari batas, salah tipe atau URL tidak valid ditolak.
- TSK-03: duplikasi request tidak membuat dua submission; pergantian memperbarui versi dan timestamp.
- TSK-04: tepat deadline diterima tepat waktu; satu milidetik sesudahnya terlambat.
- TSK-05: setelah dinilai, replacement ditolak, termasuk pada race dengan penilaian.
- CAP-01: kurang satu submission tetap terkunci; seluruhnya terkumpul membuka Capstone walau belum dinilai.
- GRD-01: hanya admin dapat menilai; 0 dan 100 diterima, -1/101/NaN/pecahan ditolak.
- GRD-02: detail file yang dinilai dan nomor versinya sama dengan submission yang disimpan pada grade.

## 8. Jadwal dan Presensi

Admin mengelola daftar per kelas, sesi aktif di atas lalu sesi lain menurut waktu. Form manual dan impor mengisi nama pertemuan, tanggal, jam mulai/selesai, moda, dan informasi lokasi/tautan. Waktu selesai harus lebih besar dari mulai pada hari yang sama.

Template jadwal `.xlsx`, maksimal 100 baris dan 5 MiB:

`Nama Pertemuan, Tanggal, Jam Mulai, Jam Selesai, Moda, Link Zoom, Alamat, Link Maps`.

Tanggal `YYYY-MM-DD`, jam `HH:mm`, moda `online`/`offline`. Online wajib Zoom HTTPS; offline wajib alamat dan Maps HTTPS. Field moda lain tidak dipakai. Import memakai preview/all-or-nothing dan deteksi duplikat kelas + nama pertemuan + waktu mulai.

### 8.1 Jendela presensi

Online: otomatis `[19:00,22:00)` WIB pada tanggal sesi, terpisah dari jam pembelajaran pada metadata. Form menjelaskan jendela tetap ini, termasuk bila jam sesi berbeda. Admin dapat menutup lebih awal; status penutupan tersimpan dan tidak terbuka kembali hanya karena jam masih dalam jendela. Tidak ada buka-ulang online pada versi pertama.

Offline: awalnya tertutup. Admin dapat membuka selama rentang waktu sesi, menutupnya, dan membuka kembali sebelum sesi berakhir. Setelah sesi berakhir, tidak menerima scan. Setiap penutupan/pembukaan mengganti revisi QR agar token lama invalid.

### 8.2 QR dan pencatatan

- QR monitor hanya untuk admin; siswa tidak dapat meminta endpoint pembuat QR.
- Payload berupa HTTPS link `/presensi?token=...`, bukan `app://`.
- Token ditandatangani server dengan sessionId, window/revision dan expiry; tidak mengandung daftar email.
- Setiap token memiliki jendela valid 30 detik dengan validFrom dan expiresAt. Validasi memakai jam server, status sesi/jendela dan revisi, bukan jam perangkat. Snapshot monitor dapat membawa token jendela saat ini dan satu jendela berikutnya; token berikutnya belum dapat digunakan sebelum validFrom.
- Browser HP memindai lewat kamera aplikasi atau kamera eksternal. Token disimpan sementara di sessionStorage bila perlu masuk dahulu, dikeluarkan dari URL, dan dibersihkan setelah proses. Tidak masuk log/referrer.
- GET link tidak mencatat hadir. Setelah session valid, browser mengirim POST same-origin dengan CSRF dan token. Dengan sesi yang sudah ada, alur dapat berlangsung otomatis setelah pemindaian.
- Jika token habis saat login, minta pindai QR terbaru; tidak memperpanjang token atau mempercayai waktu scan yang dilaporkan browser.
- Backend memeriksa role siswa, kelas aktif dan keanggotaan, lalu membuat satu record unik sessionId+studentId dalam transaksi.
- Scan ulang sesi yang masih dapat diakses mengembalikan record pertama tanpa mengubah jam hadir. Scan baru dengan token kedaluwarsa/kelas lain ditolak.
- Informasi `via Scan`/`via Kamera` adalah metadata jalur UI, bukan bukti perangkat fisik atau antikecurangan.
- Rotasi QR mengurangi umur screenshot, tidak mencegah relay langsung. Tidak ada klaim anti-screenshot absolut.

### 8.3 Monitor dan desktop

Monitor menampilkan jumlah hadir/belum dan daftar hadir paginated. Polling hanya ketika dialog terlihat: satu request snapshot ringkas tiap 30 detik dengan data terbaru setelah aksi manual. Server mengembalikan waktu server, token saat ini dan token berikutnya agar perubahan jendela tidak harus menunggu jaringan. Timer countdown QR bergerak lokal; tidak memicu query per detik. Jika tidak ada token yang masih valid, QR disembunyikan dan ditampilkan status Memperbarui QR, bukan kode kedaluwarsa. Tutup dialog/melepas halaman menghentikan polling.

Siswa desktop mendapat petunjuk membuka alamat aplikasi pada HP dan memindai QR yang ditampilkan penyelenggara. Aplikasi tidak membuat QR admin baru di halaman siswa. Tidak ada dukungan webcam desktop pada versi pertama.

### 8.4 Kriteria penerimaan

- ATT-01: boundary online 18:59:59 ditolak, 19:00 diterima, 22:00 ditolak pada WIB, tidak dipengaruhi timezone browser.
- ATT-02: offline tertutup, penutupan awal online dan revisi token lama menolak presensi baru.
- ATT-03: dua scan paralel membuat tepat satu record dan satu kenaikan counter.
- ATT-04: token rusak/kedaluwarsa, siswa beda kelas, mentor dan pengguna tanpa session ditolak.
- ATT-05: izin kamera ditolak/kamera tidak tersedia menampilkan pemulihan, tidak memalsukan keberhasilan.
- ATT-06: ekspor dan monitor hanya mencakup kelas yang diminta dan tidak mengirim token QR dalam CSV.

## 9. Mentoring dan Calendar

### 9.1 Periode, assignment dan slot

Per kelas dan fase `bootcamp`/`internship`, admin menetapkan awal/akhir periode. Slot harus berada dalam periode, berdurasi 45 menit dan tidak bertumpang tindih untuk mentor yang sama, termasuk lintas kelas.

Template `.xlsx`, maksimal 100 baris dan 5 MiB:

`Tanggal, Jam` dengan tanggal `YYYY-MM-DD` dan jam `HH:mm`; kelas, fase dan mentor dipilih sebelum impor. Jam akhir dihitung 45 menit. Preview menampilkan interval lengkap. Slot di masa lalu atau lintas tengah malam ditolak.

Slot memiliki satu tempat, bukan kapasitas 12. Siswa hanya melihat slot kelas, fase dan mentor assignment-nya. Periode belum buka, sudah tutup atau assignment belum ada memakai state jelas.

### 9.2 Booking atomik

Backend dalam transaksi memeriksa akun/kelas/assignment, periode, slot belum mulai, ketersediaan dan kuota kurang dari dua. Backend membuat booking, mengisi slot, menaikkan counter kuota dan membuat job Calendar. Request idempotency key mengembalikan booking yang sama saat diulang.

Sesi yang diajukan sebagai booking kedua dan waktu slotnya masih pada tujuh hari pertama periode memerlukan konfirmasi peringatan. Backend memeriksa flag konfirmasi; ini peringatan, bukan larangan mutlak mengambil sesi kedua.

Counter kuota menghitung booking non-batal, termasuk yang integrasi Calendar-nya gagal atau waktunya sudah lewat. Selesai karena waktu lewat berarti berakhir, bukan bukti hadir. Tidak ada pengembalian kuota otomatis untuk no-show.

Admin dapat membatalkan sebelum mulai. Pembatalan melepaskan slot dan mengurangi kuota tepat sekali dalam transaksi serta menjadwalkan pembatalan event. Siswa/mentor tidak dapat membatalkan sendiri. Slot yang sudah mulai tidak dapat dibatalkan untuk mengembalikan kuota.

### 9.3 Integrasi penyelenggara

- Akun Google penyelenggara terpisah dari metode login aplikasi. Konfigurasi awal dilakukan operator dengan OAuth yang memberikan akses kalender yang sesuai.
- Organizer harus akun penyelenggara. Peserta dan mentor diundang menggunakan email terdaftar dengan `sendUpdates=all` saat event siap.
- Job Calendar memakai event ID deterministik dari booking dan conference request ID stabil. Request ulang setelah timeout tidak membuat event/Meet kedua.
- Status integrasi `pending`, `ready`, `failed`, `cancel_pending`, `cancelled` terpisah dari status booking.
- Link Meet hanya ditampilkan setelah benar-benar tersedia. Booking pending tetap mempertahankan slot/kuota, dengan teks Link Meet sedang disiapkan.
- Gagal integrasi menyimpan error tersanitasi dan retry dengan backoff; admin dapat memicu ulang job yang sama. Tidak memasukkan credential atau detail internal pada UI siswa.
- Worker menangani race pembatalan dan pembuatan event: event yang baru terbuat untuk booking batal harus dibatalkan, bukan menghidupkan booking kembali.
- Credential penyelenggara disimpan dalam secret store server. Tidak memakai akun Google admin/mentor secara diam-diam.
- Perilaku masuk Meet tanpa approval diuji dengan akun penyelenggara sebenarnya; undangan tidak cukup sebagai bukti konfigurasi host mengizinkannya.

### 9.4 Portal mentor

Menu Peserta Bimbingan dan Jadwal Mentoring. Filter kelas/fase hanya pilihan yang ditangani mentor. Daftar peserta memuat nama, kelas dan ringkasan booking; email hanya pada detail bila diperlukan untuk komunikasi sesi. Tidak memuat presensi kelas, submission atau nilai.

Jadwal menampilkan waktu WIB, peserta, status integrasi, link Meet dan riwayat berakhir. Tidak ada kontrol membuat slot, assign siswa atau menilai.

### 9.5 Kriteria penerimaan

- MEN-01: dua siswa berebut satu slot menghasilkan satu booking sukses dan satu konflik, tanpa kuota bocor.
- MEN-02: tiga booking paralel oleh satu siswa menghasilkan paling banyak dua booking non-batal.
- MEN-03: slot mentor lain/kelas lain/fase lain ditolak walau ID-nya diketahui.
- MEN-04: peringatan booking kedua minggu pertama harus dikonfirmasi, lalu tetap boleh lanjut.
- MEN-05: pembatalan admin sebelum mulai mengembalikan kuota sekali; pengulangan tidak mengurangi lagi.
- CAL-01: timeout setelah Google membuat event lalu retry menghasilkan satu event dan satu Meet.
- CAL-02: gagal Calendar tidak menampilkan link palsu atau membuka slot yang sudah dimiliki siswa.
- CAL-03: race cancel/create akhirnya membuat booking batal tanpa event aktif yang tertinggal.
- MTR-01: mentor hanya membaca peserta dan booking assignment sendiri; endpoint nilai/admin ditolak.

## 10. Home dan Navigasi

Siswa: `/app`, `/app/jadwal`, `/app/mentoring`, `/app/tugas`, `/app/tugas/[taskId]`, `/app/presensi/scan`, dan `/presensi` sebagai pintu link QR.

Admin: `/admin/kelas`, `/admin/kelas/[classId]`, `/admin/jadwal`, `/admin/jadwal/[classId]`, `/admin/mentoring`, `/admin/tugas`, `/admin/tugas/[submissionId]`, `/admin/akun`.

Mentor: `/mentor/peserta`, `/mentor/jadwal`. Umum: `/login` dan halaman akses ditolak/tidak ditemukan. Setelah login redirect ditentukan backend dari role; return path hanya relatif dan harus tetap melewati pemeriksaan izin.

Home memilih sesi dengan presensi terbuka paling awal, atau sesi berikutnya; bila beberapa aktif tersedia tautan menuju Jadwal. Setelah hadir, tombol berubah menjadi status Hadir, bukan terus meminta scan.

Mentoring terdekat = booking non-batal dengan waktu terdekat yang belum berakhir. Tugas terdekat = tugas terbuka belum dikumpulkan, diurutkan deadline; terlambat ditampilkan eksplisit dan tidak disembunyikan. Kurang dari 24 jam menjadi peringatan, tanpa hardcode kata Besok yang salah hari.

Progres desktop dihitung server dari counter/ringkasan: hadir dari sesi berakhir, harian terkumpul dari snapshot wajib, kuota mentoring fase aktif. Pembagi nol menampilkan belum tersedia, bukan NaN atau 100% palsu.

## 11. Visual, Responsif dan Aksesibilitas

- Acuan 24 frame Figma; node ID rinci ada pada rekonsiliasi. Tidak membuat ulang gaya dari template dashboard generik.
- Primer `#0072CE`, judul Poppins Bold, body Inter mengikuti Figma aktual. Font disajikan lokal lewat paket/aset yang lisensinya sesuai.
- Admin memakai sidebar gelap `#243C4B`; peserta desktop sidebar putih dengan item aktif biru. Mobile memakai header biru dan bottom nav sesuai Figma.
- Breakpoint tegas: `<768px` mobile, `>=768px` desktop. Desktop desain utama 1280x800; mobile 390x844; uji juga 360px dan 768px.
- Tinggi frame bukan tinggi konten tetap. Halaman boleh scroll; bottom nav tidak menutupi form atau tombol; perhatikan safe-area HP.
- Admin tetap dapat dipakai di HP dengan navigasi ringkas dan tabel scroll dalam container, bukan overflow seluruh halaman.
- Pertahankan komposisi Figma tetapi naikkan teks 8-10px yang tidak terbaca; body utama minimal 14px dan label sekunder minimal 12px sebagai batas implementasi awal.
- Touch target minimum 44x44px, kontras WCAG AA, fokus jelas, label form dan error yang dapat dibaca pembaca layar.
- Modal memiliki focus trap, Escape, pengembalian fokus; aksi submit menunjukkan pending dan mencegah duplikasi.
- Tidak ada tema gelap tambahan, logo baru, avatar rekaan atau animasi dekoratif. Inisial user dipakai bila foto tidak tersedia; nama produk sebagai identitas sementara bila aset logo resmi belum diberikan.
- Loading/kosong/gagal/sukses diwajibkan untuk UI data. Tidak memasang tautan menu yang berujung halaman kosong tanpa fungsi.
- Fase pengembangan boleh menampilkan area yang belum terbangun dengan penjelasan eksplisit, tetapi tidak dihitung fitur selesai dan tidak termasuk rilis akhir.

## 12. Arsitektur dan Data

### 12.1 Batas modul

Next.js App Router menggunakan Server Components untuk pembacaan awal dan Client Components hanya untuk interaksi. Route Handlers menjalankan mutasi/endpoint JSON. Firebase Admin SDK dan integrasi Google hanya pada runtime Node server.

Modul berdasarkan fitur: auth, classes, users, assignments, tasks, attendance, mentoring, calendar, dashboard, exports. Jangan membuat abstraction repository generik yang hanya meneruskan SDK. Pure policy function dipisahkan bila dibutuhkan pengujian boundary atau digunakan ulang.

Database dan storage client rules default deny untuk aplikasi server-mediated ini. Admin SDK melewati rules, sehingga semua data service memerlukan identitas server yang sudah diverifikasi dan pemeriksaan scope eksplisit. Browser tidak menerima daftar seluruh user untuk pencarian login.

### 12.2 Model dokumen

Nama di bawah kontrak rancangan baru; belum ada klaim database sudah dibuat.

| Collection/path | Field inti | Batas dan invariant |
|---|---|---|
| `users/{uid}` | email, normalizedEmail, name, role, active, classId, createdAt, updatedAt | role enum; student classId tunggal; mentor/admin classId null; tanpa credential |
| `emailIndex/{sha256(normalizedEmail)}` | uid, normalizedEmail | Email unik; hash bukan anonimisasi; akses server saja |
| `classes/{id}` | city, programName, canonicalName, status, mentorIds, requiredDailyTaskIds, capstoneTaskId, counters | status draft/active; daftar wajib immutable saat aktif |
| `classKeys/{hash}` | classId | Keunikan kota+program, dinormalisasi untuk deteksi duplikat |
| `assignments/{studentId_phase}` | studentId, classId, phase, mentorId, updatedAt | Satu assignment siswa per fase |
| `tasks/{id}` | classId, kind, title, dueAt, briefFileId, briefUrl, order, published, version | Ringkasan; tidak memuat deskripsi panjang |
| `taskDetails/{id}` | description | Detail dibaca saat dibuka; plain text, bukan HTML bebas |
| `submissions/{taskId_studentId}` | taskId, taskKind, classId, studentId, fileId, url, firstSubmittedAt, submittedAt, late, version, score, gradedAt, feedbackPreview | Tepat satu fileId/url; taskKind dari tugas server; score null berbeda dari 0 |
| `submissionFeedback/{submissionId}` | text, gradedVersion, gradedBy | Feedback lengkap terpisah; hanya owner/admin |
| `files/{id}` | ownerId, purpose, objectPath, objectGeneration, originalName, downloadName, mimeType, byteSize, status, createdAt | status pending/ready/rejected; generation objek final immutable; tidak memuat biner atau signed URL permanen |
| `sessions/{id}` | classId, title, mode, startsAt, endsAt, zoomUrl, address, mapsUrl, attendanceOverride, qrRevision, attendeeCount | Data daftar ringkas; tidak memuat daftar hadir |
| `attendance/{sessionId_studentId}` | sessionId, classId, studentId, sessionEndsAt, recordedAt, source | Unik; sessionEndsAt disalin server; timestamp pertama tidak berubah karena scan ulang |
| `mentoringPeriods/{classId_phase}` | classId, phase, startsAt, endsAt | Jendela booking/fase; awal minggu pertama berasal dari startsAt |
| `mentoringSlots/{id}` | classId, phase, mentorId, startsAt, endsAt, bookingId | bookingId null berarti tersedia bila masih dalam periode |
| `mentorDays/{mentorId_date}` | intervals | Kunci transaksi untuk mencegah overlap lintas kelas; maksimal 32 slot/hari |
| `mentoringQuotas/{studentId_phase}` | count | Integer 0-2; diubah bersama booking/cancel |
| `bookings/{id}` | slotId, classId, studentId, mentorId, phase, startsAt, endsAt, status, calendarStatus, meetUrl, createdAt | status confirmed/cancelled; berakhir dihitung dari endsAt |
| `calendarJobs/{bookingId}` | operation, status, attempt, nextAttemptAt, leaseUntil, eventId, errorCode | Worker idempoten; tanpa secret OAuth |
| `importJobs/{id}` | type, payloadHash, createdBy, status, rowCount, createdAt | Konfirmasi yang sama tidak mengulang write |
| `idempotency/{hash}` | actorId, operation, payloadHash, resultId, createdAt | Retry body berbeda dengan key sama ditolak |
| `studentProgress/{uid}` | attendanceCount, dailySubmittedCount, updatedAt | Counter dipelihara transaksi; bukan status otorisasi tunggal |
| `auditEvents/{id}` | actorId, action, entityType, entityId, occurredAt, changedFields | Metadata perubahan; jangan menyalin file, token atau data pribadi penuh |

Semua timestamp persisten memakai Firestore Timestamp UTC. Batas teks: nama user/kelas/judul 120 karakter, deskripsi tugas dan feedback 10.000 karakter, URL 2.048 karakter. Batas array mentor/daftar wajib kelas 100 untuk menjaga ukuran dokumen/transaksi; melebihi batas ditolak dengan pesan jelas.

### 12.3 Query dan indeks

- Daftar maksimal 25 baris per halaman dengan cursor stabil dan document ID sebagai tie-breaker.
- Semua query server menyebut field yang dikirim ke browser; detail panjang tidak dimuat pada list. `.select()` Admin SDK digunakan untuk proyeksi bila sesuai.
- Filter kelas/role/owner dipasang sebelum query dan diperiksa pada detail; tidak menarik semua lalu memfilter browser.
- Indeks komposit disimpan pada `firestore.indexes.json`: sessions(classId, startsAt), tasks(classId, kind, order), submissions(taskKind, classId, submittedAt), submissions(taskKind, submittedAt), bookings(studentId/mentorId, status, startsAt), mentoringSlots(classId, phase, mentorId, startsAt), attendance(studentId, sessionEndsAt), sessions(classId, endsAt), calendarJobs(status, nextAttemptAt).
- Progres hadir Home menggunakan agregat count attendance siswa dengan sessionEndsAt <= waktu server dan count sesi kelas yang endsAt <= waktu server; bukan seluruh counter scan termasuk sesi berlangsung. Jadwal yang sudah memiliki presensi tidak dapat diubah waktunya pada versi pertama agar snapshot sessionEndsAt tidak bergeser.
- Counter dan status diperbarui atomik; read-counter-then-write tanpa transaksi dilarang.
- Export mengalirkan batch server, maksimum 10.000 baris per permintaan; kelebihan meminta filter lebih sempit. Tidak menampung seluruh dataset di browser.
- CSV menetralkan awalan formula `=`, `+`, `-`, `@` dan karakter kontrol yang bisa memicu spreadsheet.

## 13. Storage dan Anggaran Operasional

Upload melalui izin server terbatas pada satu object path staging milik user dengan TTL pendek. Finalisasi memeriksa object ada, ukuran, MIME dan signature format; ekstensi saja tidak cukup. Hasil validasi disalin ke object path final baru dengan precondition tidak boleh menimpa objek yang ada. Firestore menyimpan generation objek final yang terverifikasi. URL upload staging tidak dapat menimpa objek final atau mengganti isi yang sudah dinilai. File pending tidak dapat dijadikan submission. ZIP tidak diekstrak server. Unduhan file privat memakai URL bertanda tangan maksimal lima menit setelah pemeriksaan izin dan merujuk generation final tersebut.

Usulan normalisasi untuk review: input JPG dikonversi menjadi WebP sebelum menjadi objek final, lebar maksimum 1600px, mutu awal 0,82, maksimum 300 kB. Form menjelaskan perubahan format dan menampilkan preview sebelum konfirmasi; bila batas ukuran tidak tercapai, minta file lebih kecil atau PDF, jangan menurunkan mutu tanpa pemberitahuan. Metadata menyimpan originalName dan downloadName berekstensi .webp; JPG staging dibersihkan setelah normalisasi. Peserta yang perlu mempertahankan berkas asli menggunakan ZIP/PDF atau tautan. Gambar UI/preview memakai batas WebP yang sama; aset publik immutable memakai cache satu tahun. PDF/ZIP dipertahankan sebagai dokumen dan tidak diperlakukan sebagai gambar UI.

Object pending lebih dari 24 jam tanpa referensi dibersihkan job terbatas. Object lama setelah replacement tidak dihapus sebelum transaksi referensi baru berhasil. File yang masih direferensikan submission/brief tidak boleh ikut cleanup.

Anggaran payload target awal: list 25 baris <=20 KiB; detail teks <=32 KiB; Home <=4 KiB; monitor QR <=4 KiB selain thumbnail QR. Ini target engineering yang wajib diukur, bukan hasil benchmark yang sudah lulus.

Rumus wajib: `payload per panggilan x panggilan per hari x 30`, dihitung pada batas skala dua tahun. Query >500 MB/bulan perlu review. Contoh skenario sizing, bukan prediksi pengguna aktual: 1.000 pengguna aktif/hari x 4 panggilan Home x 4 KiB x 30 = 491.520.000 byte/bulan. Daftar 20 KiB dengan frekuensi sama = 2.457.600.000 byte/bulan, sehingga harus ditinjau sebelum digabung.

Jumlah peserta total/aktif, kelas, sesi, dan retensi riil belum diberikan; gate estimasi produksi belum lulus. Ukuran halaman/batas upload tidak dianggap pengganti estimasi tersebut. Report biaya harus memisahkan egress data, read/write Firestore, storage/download file dan layanan Google.

## 14. Rencana Pengujian dan Selesai

Pengujian unit untuk policy role, normalisasi email, boundary waktu, kuota, capstone, submission dan CSV. Integrasi Firebase Emulator untuk auth/session, transaksi, rules deny dan race. E2E browser untuk alur tiga role, responsif, keyboard, form dan error state.

Uji camera permission/success dapat memakai input kamera mock saat E2E, tetapi scan pada HP nyata melalui HTTPS tetap diperlukan sebelum rilis. Calendar memakai fake provider untuk test; uji organizer/undangan/Meet dengan akun staging nyata adalah gate terpisah.

Perintah target proyek setelah tooling dibuat: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, `npm run build`. Tidak ada klaim lulus sebelum perintah dan lingkungan yang diperlukan benar-benar berjalan.

Selesai per modul berarti acceptance ID terkait lolos, tidak ada tombol mati, state lengkap, scope data terbukti, dan tidak melanggar anggaran query/file. Modul belum aktif tidak boleh dilaporkan sebagai selesai hanya karena mockup tampil.

## 15. Tahapan dan Gerbang Lingkungan

1. Fondasi lokal: Next.js, design tokens, Firebase emulator, login custom/session dan shell role.
2. Kelas/akun: bootstrap, draft/aktif, impor, assignment, portal mentor daftar peserta.
3. Tugas: course builder, storage, submit, penilaian, Capstone dan ekspor.
4. Jadwal/presensi: manual/impor, QR, scan, monitor dan CSV.
5. Mentoring: periode, slot, kuota, booking, cancel, Calendar dan portal jadwal mentor.
6. Home final, responsive, aksesibilitas, sizing, pengujian perangkat dan deployment yang disetujui.

Kondisi lingkungan yang teramati: root belum memiliki source aplikasi/package manifest/Git; Node v24.12.0 dan npm 11.6.2 tersedia; `java -version` belum dikenali pada PATH. Ini bukan bukti Java tidak terpasang di lokasi lain. Firestore Emulator membutuhkan runtime Java yang sesuai versi firebase-tools terpilih; periksa dan siapkan sebelum klaim integration test.

Resource yang harus tersedia sebelum integrasi nyata: proyek Firebase staging/produksi dan region, credential server melalui environment/ADC, konfigurasi web Firebase, bucket privat, akun Google penyelenggara dan izin Calendar, origin HTTPS/hosting, serta angka sizing/retensi. Tidak meminta private key di chat dan tidak memasukkannya ke dokumen/repository.

Persetujuan dokumen tidak otomatis mengizinkan membuat resource berbayar, deploy, commit/push atau mengubah desain Figma. Spec dan plan diserahkan untuk review; eksekusi tahap pertama dimulai setelah persetujuan eksplisit pengguna atas dokumen dan izin mulai. Tahap berikut dapat disusun/dijalankan terpisah dengan hasil verifikasi masing-masing.
