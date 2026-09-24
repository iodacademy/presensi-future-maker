# Pencocokan Design UI dengan Alur Produk

Tanggal pemeriksaan: 2026-09-06
Status: audit selesai; D-01, platform D-03, dan alur login/peran D-02 telah diklarifikasi pengguna; risiko identitas dan keputusan lainnya tercatat untuk spesifikasi.

## 1. Sumber dan Batas Pemeriksaan

- Figma: https://www.figma.com/design/V8iZp2tgVjRr6ypcKqeapB/Design-UI
- File key: `V8iZp2tgVjRr6ypcKqeapB`; page: `0:1`, `Page 1`.
- Dokumen pembanding: `2026-09-01-bootcamp-innovaition-alur-produk.md` dalam folder ini.
- Panduan visual lokal: `Warna` pada root proyek.
- Semua 24 frame diperiksa melalui nama, teks layer, dimensi, layout, dan reaksi prototipe pada node turunannya.
- Ekspor PNG yang benar-benar dilihat: Home peserta mobile `11:2724`, Mentoring peserta desktop `15:205`, dan Peserta dan Mentor admin `10:2533`.
- Ini bukan audit visual seluruh frame atau pengujian prototipe interaktif. Tidak ditemukan reaksi prototipe pada node turunan dalam pemeriksaan ini.
- File `DESIGN LMS PLAN INDONESIA` tidak dibaca atau diubah. Desain `Design UI` juga tidak diubah.
- Nama orang, email, angka progres, dan tanggal contoh pada Figma adalah konten desain, bukan data operasional terverifikasi. Jangan digunakan untuk seed produksi.

## 2. Matriks Seluruh Layar

| Node | Frame | Kecocokan dengan dokumen | Kekurangan atau keputusan terkait |
|---|---|---|---|
| `10:1228` | A1 Kelas - List | Kartu Kota+Kelas, jumlah mentor/peserta/tugas, Buat Kelas, toggle tabel sesuai 3.1 | State tabel, kosong, error, pagination belum memiliki frame khusus |
| `10:1457` | A2 Popup Buat Kelas | Kota, nama kelas, multi-select mentor sesuai 3.1 | Ada Tambah Mentor Baru; bootstrap mentor-kelas belum ditentukan |
| `10:1516` | A3 Course Builder | Tugas Harian, Capstone, brief, aturan kunci sesuai 3.1 | Form tambah/edit, deadline tugas harian, publikasi dan perubahan setelah submission belum dirinci |
| `10:1634` | B1 Jadwal dan Presensi | Pemilihan kelas, daftar sesi, QR dan ekspor CSV sesuai 3.2 | Layar memuat kelas dan daftar sesi bersama; dokumen menggambarkan navigasi ke detail. Kedua pola bisa ditampung dengan detail kelas |
| `10:1793` | B2 Tambah Jadwal | Manual/Excel, moda, link Zoom sesuai 3.2 | Figma menambahkan tanggal/jam; state offline, preview Excel dan validasinya belum tergambar |
| `10:1888` | B3 QR Monitor | QR 30 detik, ringkasan dan daftar hadir sesuai 2.2/3.2 | Tombol Tutup Manual pada sesi online belum dijelaskan dokumen; rotasi QR bukan jaminan antikecurangan |
| `10:1933` | C1 Mentoring Admin | Slot, status booking, ekspor dan assign sesuai 3.4 | Definisi slot, kapasitas, periode fase, dan arti Belum Punya Slot belum pasti |
| `10:2045` | C2 Assign Siswa | Pencarian peserta sekelas dan mentor sesuai 3.4 | Judul dan isi secara eksplisit mengalokasikan peserta ke slot tertentu; perlu diselaraskan dengan pilihan slot mandiri |
| `10:2087` | D1 Tugas Siswa | Tab harian/capstone, filter kelas, urutan waktu kumpul, skor dan ekspor sesuai 3.3 | Form penilaian dan detail submission belum mempunyai frame khusus |
| `10:2533` | E1 Peserta dan Mentor | Upload global/per kelas dan preview sesuai 3.5 | Simpan Akun Valid menyiratkan penyimpanan parsial; bertentangan dengan penolakan seluruh impor global |
| `11:2724` | 01 Home - Sesi Aktif | Tiga blok: sesi, mentoring, tugas sesuai 2.1 | State sudah hadir, belum ada mentoring/tugas, dan beberapa sesi bersamaan belum ditentukan |
| `11:2799` | 01 Home - Tidak Ada Sesi | Sesi berikutnya tanpa scan sesuai 2.1 | Copy presensi otomatis harus hanya berlaku untuk online; offline tetap dibuka admin |
| `11:2869` | 02 Jadwal Mobile | Filter moda, aktif/akan datang/selesai, hadir sesuai 2.2 | Aksi buka Zoom/Maps dan state tidak hadir/batal belum lengkap |
| `11:2933` | 02b Scan QR - Kamera Aktif | Kamera dan instruksi rotasi sesuai 2.2 | Izin kamera ditolak, kamera tidak tersedia, token salah/kedaluwarsa, offline dan login belum tergambar |
| `11:2991` | 03 Mentoring Mobile | Mentor terpilih, fase, kuota, tersedia/penuh/booking saya sesuai 2.3 | Menampilkan 45 menit dan 5/12 atau 12/12, berbeda dari slot privat terkunci untuk satu peserta |
| `11:3056` | 04a Tugas Harian Mobile | Daftar, filter, deadline, terkumpul, skor/feedback sesuai 2.4 | Feedback panjang perlu dibatasi di daftar; detail diambil saat dibuka |
| `11:3130` | 04b Capstone Terkunci | Progress tugas harian dan kunci sesuai 2.4 | State Capstone terbuka, tidak ada tugas harian, dan perubahan kurikulum perlu aturan |
| `11:3190` | 04c Form Pengumpulan Mobile | Brief dan file PDF/ZIP/JPG atau link, maksimum 10 MB sesuai 2.4 | State upload, gagal, terkirim, ganti dan dinilai belum mempunyai frame khusus |
| `11:3237` | 02c Scan QR - Sukses | Konfirmasi sesi, waktu dan metode sesuai 2.2 | Scan duplikat harus mengembalikan presensi yang sama, bukan mencatat ulang |
| `15:2` | 05 Home Desktop | Ringkasan progres dan petunjuk scan HP sesuai bagian 7 | Sidebar aktual putih, bukan biru seperti dokumen; ringkasan harus agregat server |
| `15:113` | 06 Jadwal Desktop | Data/aksi setara mobile, petunjuk scan HP sesuai bagian 7 | Perlu alur konkret pindah ke HP tanpa memajang token admin kepada peserta |
| `15:205` | 07 Mentoring Desktop | Fase, mentor, slot, kuota, Meet dan riwayat sesuai 2.3 | Judul 1-on-1/privat bertentangan dengan 12 peserta per slot; 45 menit baru terlihat di desain |
| `15:312` | 08 Tugas Desktop | Daftar tugas, nilai, brief dan progress kunci sesuai 2.4 | Menambahkan GitHub sebagai jenis link; deskripsi/feedback panjang tidak boleh ikut seluruh kueri daftar |
| `15:433` | 09 Detail dan Kumpul Desktop | Instruksi, brief, upload atau link sesuai 2.4 | Desktop menyebut PDF/ZIP saja, mobile juga JPG; menambahkan rubrik dan SLA feedback 2x24 jam yang belum disepakati |

## 3. Cakupan Fitur yang Sudah Didukung Sumber

Bagian ini merangkum kebutuhan dari dokumen/desain, bukan persetujuan atas rekomendasi pada bagian 4.

| Modul | Peserta | Admin | Aturan yang sudah eksplisit |
|---|---|---|---|
| Kelas dan roster | Melihat konteks Kota+Kelas sendiri | Membuat unit Kota+Kelas, memilih beberapa mentor, impor akun | Setiap peserta memiliki satu mentor per fase; mentor antarfase dapat berbeda |
| Home | Sesi aktif/berikutnya, mentoring terdekat, tugas terdekat; progres pada desktop | Tidak ada menu dashboard admin terpisah | Menu peserta Home, Jadwal, Mentoring, Tugas |
| Jadwal | Filter online/offline, informasi sesi, status kehadiran | Tambah manual/Excel, daftar sesi dan ekspor presensi | Online memerlukan Zoom; offline memerlukan alamat dan Maps |
| Presensi | Scan kamera HP atau membuka tautan QR melalui kamera eksternal | Monitor QR dan daftar/jumlah hadir | Firestore untuk presensi; rotasi 30 detik; online 19.00-22.00; offline manual |
| Mentoring | Fase Bootcamp/Magang, mentor sendiri, booking, Meet, riwayat | Impor slot, assign dan monitor, ekspor CSV | Dua sesi per peserta per fase; peringatan untuk sesi kedua pada minggu pertama, bukan larangan |
| Integrasi kalender | Undangan dan tautan Meet untuk peserta | Event memakai akun penyelenggara | Peserta dan mentor menjadi undangan; status gagal integrasi belum ditetapkan |
| Course builder | Membaca instruksi dan mengunduh brief | Menyusun tugas harian dan Capstone | Perubahan konten kelas menjadi sumber tugas peserta |
| Submission | File atau link, penggantian sebelum dinilai, melihat nilai/feedback | Melihat submission, memberi nilai/feedback, ekspor | Skor 0-100; terlambat diterima dan ditandai; Capstone setelah semua harian terkumpul |
| Impor akun | Akun dimasukkan penyelenggara | Global/per kelas, preview | Global ditolak seluruhnya jika ada kelas tidak cocok; Nama dan Email wajib |

Tidak ada bukti scope portal mentor tersendiri, pembayaran, sertifikat, chat, video pembelajaran, atau aplikasi native yang sudah dipilih. Jangan menambahkannya sebagai fitur pasti.

## 4. Register Keputusan

### D-01: Kapasitas dan assignment mentoring

Bukti: dokumen 2.3 menyatakan slot terkunci bagi peserta yang booking; frame `15:205` menyebut 1-on-1 tetapi juga 12/12 peserta. Frame `10:2045` mengalokasikan peserta ke slot tertentu.

Alternatif yang perlu dipilih:

1. Privat mandiri: satu slot = satu mentor + satu peserta; admin menetapkan mentor per fase, peserta memilih slot mentor itu. Paling konsisten dengan judul 1-on-1; membutuhkan revisi semantik Assign Siswa.
2. Privat alokasi: satu slot = satu mentor + satu peserta; admin mengalokasikan slot ke peserta, peserta mengonfirmasi. Paling konsisten dengan popup Assign Siswa.
3. Kelompok: satu slot menampung beberapa peserta; kapasitas, daftar undangan dan privasi antaranggota harus ditentukan. Judul 1-on-1 harus diubah.

Keputusan pengguna pada 2026-09-06: alternatif 1, privat mandiri.

Satu slot hanya dapat dibooking satu peserta. Admin menetapkan mentor peserta per fase dan menyediakan jadwal; peserta memilih slot kosong mentor tersebut. Assign Siswa berarti assignment peserta ke mentor per fase, bukan alokasi jadwal. Indikator kapasitas 12 peserta pada satu slot tidak digunakan. Perubahan ini berlaku untuk spesifikasi implementasi; file Figma belum diedit.

### D-02: Autentikasi dan peran mentor

Belum ada layar login, aktivasi akun, pemulihan akses atau bootstrap admin. Dokumen menyebut dua peran login, tetapi desain menampilkan feedback mentor dan mentor penilai.

Pengguna sempat memilih admin sebagai penilai dengan dua peran login. Klarifikasi terbaru pada 2026-09-06 menggantikan jumlah peran tersebut: ada admin, siswa, dan mentor. Pengguna mengoreksi nama field penentu peran menjadi `role`, BUKAN `participant`, pada dokumen user.

Alur yang diminta pengguna: cukup mengetik alamat email yang terdaftar; tidak memakai password, tautan email atau login Google. Server mencari dokumen user lalu menentukan akses dari field `role`. Email yang tidak terdaftar tidak boleh membuat akun otomatis. Ini adalah identifikasi berdasarkan daftar email, bukan autentikasi yang membuktikan kepemilikan email.

Keputusan lanjutan yang disetujui pengguna: tetap menggunakan Firebase Auth melalui custom authentication. Backend menerbitkan custom token untuk UID akun yang terdaftar dan aktif; browser menjalankan `signInWithCustomToken`, mengambil ID token, lalu menukarnya melalui backend menjadi Firebase session cookie. Backend memverifikasi cookie serta role/status akun untuk otorisasi. Session cookie bukan credential untuk Firestore client SDK. Masa sesi 5 hari adalah usulan awal; cookie HttpOnly, Secure pada HTTPS, SameSite, perlindungan CSRF dan pencabutan sesi masuk rancangan teknis. Pengguna menyatakan penggunaan internal selama beberapa bulan; ini tidak menghilangkan batasan pembuktian identitas di bawah.

Referensi teknis: https://firebase.google.com/docs/auth/admin/create-custom-tokens dan https://firebase.google.com/docs/auth/admin/manage-cookies .

Hak mentor untuk menilai belum otomatis disetujui oleh penambahan peran mentor. Perlu membedakan login/portal mentor dari izin penilaian, sebab pilihan sebelumnya masih menyatakan admin yang menilai. Nama collection, nilai enum field `role`, dan apakah database tersebut sudah ada belum dikonfirmasi.

Risiko yang sudah disampaikan: orang yang mengetahui email admin, siswa, atau mentor dapat menyamar sebagai pemiliknya jika dapat mengakses pintu masuk aplikasi. Label internal, role lookup server, session cookie, rate limiting, atau Firebase custom token tidak menghilangkan risiko tersebut. Jangan mendokumentasikan alur ini sebagai autentikasi email terverifikasi.

Rekomendasi mitigasi sebelum memakai data nyata: batasi akses deployment melalui identitas terverifikasi di gateway/SSO atau tinjau ulang verifikasi email. Belum ada bukti gateway tersebut tersedia atau disetujui. Pilihan alur email-only tidak memberi otorisasi untuk membuka deployment publik; implementasi dan deployment produksi belum dilakukan. Mekanisme sesi Firebase/server perlu dituangkan dalam plan dengan mempertahankan batasan identitas ini secara eksplisit.

### D-03: Platform dan backend

Firestore untuk presensi adalah keputusan tertulis, bukan asumsi. Backend modul lain belum dipilih.

Opsi awal: aplikasi web responsif/PWA dengan Next.js + TypeScript dan Firebase Auth/Firestore/Storage untuk satu backend. Alternatif web dengan backend relasional harus menjelaskan alasan mempertahankan Firestore untuk presensi atau meminta persetujuan menggantinya. Native menambah build/distribusi dan tidak diperlukan hanya untuk layout bergaya mobile.

Keputusan pengguna pada 2026-09-06: web responsif/PWA menggunakan Next.js + TypeScript, Firebase Auth, Firestore dan Firebase Storage. Tidak menggunakan database kedua. Web/PWA menggunakan HTTPS untuk link presensi, bukan `app://`. Pemilihan hosting, proyek Firebase dan akun Google penyelenggara masih perlu dikonfirmasi; credential tidak dimasukkan ke dokumen.

### D-04: Impor dan bootstrap kelas

Global all-or-nothing wajib dipertahankan sampai pengguna menyetujui perubahan. Rekomendasi tombol: Simpan Semua Akun, nonaktif selama ada error. Jangan menyimpan hanya baris valid secara diam-diam.

Kelas membutuhkan mentor terdaftar, sementara impor mentor membutuhkan kelas yang sudah ada. Dua penyelesaian minimum: kelas draft tanpa mentor atau mentor boleh terdaftar sebelum memiliki kelas. Pilih satu alur bootstrap.

Perlu keputusan format kelas kanonis (Kota+Kelas), jenis akun dalam template, email duplikat, mentor lintas kelas, batas baris/file, dan retry provisioning akun. Transaksi database tidak otomatis membuat layanan auth/email ikut atomik.

### D-05: Jadwal dan QR

Tanggal, jam mulai/akhir dan zona waktu perlu menjadi field pasti. Rekomendasi awal zona tampilan Asia/Jakarta dengan timestamp tersimpan UTC, bukan menggunakan jam perangkat peserta.

Tutup Manual online pada Figma harus dijelaskan sebagai override yang tersimpan atau dihapus dari implementasi. Rotasi QR memperpendek masa berlaku screenshot, tetapi tidak mencegah penerusan token secara langsung. Token wajib divalidasi server bersama waktu, sesi dan keanggotaan kelas. Scan ulang harus idempoten.

### D-06: Tugas, file dan Capstone

Penyimpanan link dan upload file dapat hidup bersama: file biner masuk object storage; metadata/referensinya masuk database. Pilihan provider belum final.

Rekomendasi penyamaan format: PDF/ZIP/JPG maksimum 10 MB untuk semua viewport; URL HTTPS termasuk Drive/GitHub/Figma. Jangan mengasumsikan link dapat dibaca admin hanya karena format URL valid. Hindari permintaan server ke URL pengguna tanpa kebutuhan dan pembatasan yang jelas.

Perlu keputusan definisi keterlambatan setelah mengganti submission, publikasi/penambahan tugas harian setelah Capstone terbuka, kasus nol tugas harian, dan apakah Capstone individu atau kelompok. Rubrik dan janji feedback 2x24 jam dari frame detail bukan aturan global yang sudah disetujui.

### D-07: Calendar, Meet dan lifecycle booking

Dokumen meminta akun penyelenggara sebagai organizer. Kuota dan ketersediaan harus dikunci atomik; provisioning Calendar/Meet memerlukan retry idempoten dan status terpisah dari reservasi.

Undangan Calendar tidak otomatis menjamin peserta masuk Meet tanpa approval: konfigurasi Workspace/host perlu diuji dengan akun nyata. Jangan menjanjikan perilaku tersebut berdasarkan mockup.

Perlu keputusan durasi slot (desain menunjukkan 45 menit), periode booking per fase, pembatalan, reschedule, kuota setelah batal/no-show, dan bentrok jadwal mentor. Waktu slot lewat hanya membuktikan sesi berakhir, bukan kehadiran.

### D-08: Sumber kebenaran visual

Figma memakai Poppins dan Inter; panduan lokal menyebut Poppins dan Arial. Font campuran pada sebagian layer belum diurai per rentang karakter. Sidebar admin pada PNG berwarna gelap `#243C4B`; sidebar peserta desktop putih, berbeda dari sidebar biru di dokumen lama. Primer `#0072CE` tetap terlihat pada desain.

Rekomendasi: Design UI menjadi acuan visual terbaru; aturan bisnis memakai spesifikasi hasil rekonsiliasi. Ikuti perbedaan shell admin/peserta yang ada, bukan menyeragamkannya tanpa alasan. Ukuran teks yang ditemukan mencakup 8-20 px; pemeriksaan keterbacaan, kontras, focus dan touch target tetap diperlukan saat implementasi, bukan menyalin semua nilai secara membuta.

## 5. State dan Alur yang Harus Masuk Spesifikasi

- Login, sesi kedaluwarsa, akses ditolak, logout dan pemulihan akses sesuai metode auth terpilih.
- Loading, error dengan retry, kosong dan sukses untuk semua halaman berbasis data.
- Mentor belum ditetapkan; tidak ada slot; kuota habis; slot diambil pengguna lain; Calendar/Meet belum siap/gagal.
- Jadwal belum ada; presensi belum dibuka/sudah ditutup; scan ulang; token invalid/kedaluwarsa; peserta beda kelas.
- Kamera ditolak/tidak tersedia; koneksi terputus saat scan; perpindahan desktop ke HP.
- Upload belum selesai/gagal, file salah tipe/terlalu besar, URL tidak valid; ganti submission; submission dinilai saat peserta mencoba mengganti.
- Capstone terbuka, terkumpul, dinilai dan terlambat, bukan hanya state terkunci.
- Form tambah/edit tugas dan penilaian admin; form offline dan preview impor jadwal/slot.
- Preview impor dengan ringkasan error per baris, konfirmasi final, submit ganda dan retry tanpa duplikasi.
- Pagination, filter, ekspor mengikuti cakupan izin; nilai CSV berbahaya harus dinetralkan agar tidak menjadi formula spreadsheet.
- Dialog dapat ditutup dengan Escape; fokus dipulihkan; semua aksi dapat dioperasikan melalui keyboard.

## 6. Batas Teknis untuk Spesifikasi Berikutnya

Ini usulan kriteria engineering, bukan bukti fitur sudah berjalan.

- Otorisasi ditegakkan server/rules, bukan hanya menyembunyikan menu. Peserta tidak membaca submission atau presensi peserta lain.
- Kuota, nilai, status presensi, waktu dan kunci Capstone tidak dipercaya dari browser.
- Tidak ada query daftar tanpa batas; pagination berbasis cursor. Proyeksi field eksplisit bila provider mendukung; pada Firestore pisahkan dokumen ringkasan dari detail panjang.
- Deskripsi panjang, feedback penuh dan metadata sensitif tidak dimuat di seluruh daftar.
- Hitungan dashboard memakai agregat backend atau counter terjaga; tidak menarik semua record untuk dihitung browser.
- Listener hanya saat layar relevan aktif dan dilepas ketika berpindah. Rotasi tampilan QR bukan pemicu membaca seluruh daftar hadir.
- Setiap query baru memiliki anggaran `payload x panggilan per hari x 30` memakai skala terbesar dua tahun yang disetujui pengguna. Estimasi di atas 500 MB/bulan per query ditinjau sebelum digabung.
- Batas pengguna/kelas/sesi dua tahun belum diketahui. Tidak boleh mengklaim estimasi biaya sudah lolos sebelum angka tersebut dikonfirmasi dan payload diukur.
- File privat menggunakan otorisasi akses dan metadata, bukan base64 atau URL publik permanen. File yatim dan versi terganti memerlukan kebijakan pembersihan.
- Aturan database, indeks dan konfigurasi storage disimpan dalam version control; untuk Postgres gunakan migrasi dan RLS sesuai ketentuan lokal, untuk Firebase gunakan rules/indexes dan migrasi data yang dapat diulang.
- Data pribadi, token QR, refresh token Google dan credential server tidak masuk log atau bundle browser.
- Kalender/email produksi tidak dipanggil oleh seed/test. Fixture diberi label data uji, bukan data peserta asli.

## 7. Urutan Implementasi yang Diusulkan

Ini roadmap dependensi, belum implementation plan siap eksekusi. Plan rinci dibuat setelah keputusan produk dan stack disetujui.

| Tahap | Hasil yang dapat diuji | Dependensi |
|---|---|---|
| 1. Fondasi + akses + kelas | Aplikasi berjalan, login sesuai peran, shell mengikuti Figma, bootstrap kelas/mentor tanpa siklus | D-02, D-03, D-04, D-08 |
| 2. Roster dan assignment | Impor tervalidasi, keanggotaan kelas dan assignment fase benar; peserta lintas kelas ditolak | Tahap 1, D-01 dan D-04 |
| 3. Course builder dan tugas | Admin membuat tugas; peserta kumpul; admin menilai; Capstone mengikuti aturan yang disepakati | Tahap 2 dan D-06 |
| 4. Jadwal dan presensi | Sesi manual/Excel, QR HP, idempotensi, monitor dan CSV bekerja | Tahap 2 dan D-05 |
| 5. Mentoring dan kalender | Slot, kuota, booking paralel aman, event penyelenggara dan retry teruji | Tahap 2, D-01 dan D-07 |
| 6. Home dan kesiapan rilis | Home merangkum data nyata; semua state, responsive, aksesibilitas, anggaran query dan deployment diuji | Tahap 3-5 |

Pengujian per tahap mencakup unit aturan bisnis, integrasi database/rules, dan E2E alur peserta/admin. Pengujian paralel booking dan submit ganda bukan pengujian opsional di akhir.

## 8. Gerbang Berikutnya

1. Putuskan D-01 karena memengaruhi relasi assignment, slot, kapasitas dan Calendar.
2. Konfirmasi keputusan lain satu per satu; catat jawaban tanpa mengubah dokumen sumber lama.
3. Susun spesifikasi aplikasi final per modul: cakupan, izin, data, state, error dan kriteria penerimaan.
4. Setelah pengguna menyetujui spesifikasi, susun plan rinci dengan file target, kontrak modul, langkah test dan kriteria selesai.
5. Eksekusi tahap pertama dan laporkan hasil test/build yang benar-benar dijalankan.
