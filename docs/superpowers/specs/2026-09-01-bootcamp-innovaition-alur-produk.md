# Alur Produk — Bootcamp InnovAItion by Plan Indonesia

Status: draft, menunggu review pengguna
Dibuat: 2026-09-01

Dokumen ini memuat alur lengkap aplikasi manajemen bootcamp: presensi, booking
mentoring, pengumpulan tugas, dan pengumpulan project capstone. Dua peran:
**Peserta Pelatihan** (mobile app) dan **Admin** (web desktop).

---

## 1. Ringkasan Produk

| | |
|---|---|
| Nama produk | Bootcamp InnovAItion by Plan Indonesia |
| Pengguna | Peserta pelatihan (mahasiswa) dan Admin |
| Platform Peserta | Mobile app (bergaya native), responsif — otomatis beralih ke tata letak desktop saat dibuka di layar besar/browser |
| Platform Admin | Web desktop |
| Penyimpanan tugas | Link Google Drive / link lain (tidak menyimpan file biner di database) |
| Penyimpanan presensi | Firestore |
| Kalender & meeting | Google Calendar + Google Meet, dibuat oleh akun penyelenggara (bukan akun admin/mentor pribadi) |

### Struktur data inti

- **Kota** — mis. Jakarta, Semarang, Surabaya, Yogyakarta
- **Kelas** — mis. Web Programming, Data Analyst, Digital Marketing
- **Kota + Kelas** = satu unit unik (mis. "Web Programming Semarang"). Tiap
  unit ini punya jadwal kelas sendiri, mentor sendiri, dan peserta sendiri.
  Kota+Kelas yang sama namanya tapi beda kota (mis. Web Programming Semarang
  vs Web Programming Surabaya) **tidak berbagi** jadwal maupun mentor.
- **Mentor** — satu Kota+Kelas bisa punya **lebih dari satu mentor** (mis.
  Web Programming Semarang: Mentor Rama menangani 9 peserta, Mentor Ilham
  menangani 10 peserta). Setiap peserta di-assign ke tepat satu mentor.
- **Fase Mentoring** — Bootcamp dan Magang, masing-masing punya mentor yang
  bisa berbeda.

### Warna & Tipografi

- Primer: `#0072CE`
- Sekunder: `#58CAE7`, `#ED632F`, `#FFD500`, `#9900FF`
- Alternatif: `#DC0080`, `#243C4B`, `#8AC208`, `#D40D15`
- Netral: `#000000`, `#d9d9d6`, `#FFFFFF`
- Judul: Poppins Bold. Sub judul: Poppins / Poppins Bold. Body: Arial.
- Ikon: SVG outline, tidak menggunakan emoji.

---

## 2. Menu Aplikasi Peserta (Mobile)

Navigasi bottom tab, 4 menu: **Home, Jadwal, Mentoring, Tugas**.

### 2.1 Home

Ringkasan personal, tiga blok konten:

1. **Sesi Berlangsung** — kartu biru menonjol, hanya tampil kalau ada sesi
   aktif saat ini. Berisi nama pertemuan, jam, dan tombol **Scan QR Hadir**.
   Kalau tidak ada sesi aktif, kartu ini diganti info "Sesi berikutnya" (versi
   pasif, tanpa tombol scan).
2. **Mentoring Terdekat** — booking mentoring paling dekat waktunya, kalau
   ada. Klik untuk ke detail (link Google Meet).
3. **Tugas Terdekat** — tugas dengan deadline paling dekat yang belum
   dikumpulkan. Highlight oranye kalau deadline kurang dari 24 jam. Klik
   untuk ke halaman submit.

### 2.2 Jadwal

Presensi **tidak dipisah menjadi menu sendiri** — digabung di sini.

- Filter chip: Semua / Online / Offline.
- Tiap kartu sesi menampilkan status: Berlangsung (biru, ada tombol Scan QR
  Hadir), Akan Datang (abu-abu, tombol nonaktif dengan keterangan "QR dibuka
  admin saat sesi"), Selesai (menampilkan status hadir/tidak beserta jam
  presensi).
- **Dua jalur presensi**:
  1. Buka app → Jadwal → kartu sesi berlangsung → tombol **Scan QR Hadir** →
     kamera terbuka → arahkan ke QR → hadir tercatat.
  2. Langsung buka kamera HP (di luar app) → scan QR → QR berisi deep link
     (`app://presensi?token=...`) → app terbuka otomatis dan langsung
     tercatat hadir tanpa langkah tambahan.
- **Aturan buka/tutup QR**:
  - Online: presensi buka otomatis jam 19:00, tutup otomatis jam 22:00.
  - Offline: admin membuka dan menutup presensi secara manual dari sisi
    admin.
  - QR menyegarkan diri setiap 30 detik untuk mencegah screenshot dibagikan.

### 2.3 Mentoring

- Peserta hanya melihat mentor yang telah di-assign kepadanya (bukan pilihan
  bebas dari semua mentor di kelas).
- Ada dua fase yang bisa dipilih: **Bootcamp** dan **Magang** — mentor bisa
  berbeda di tiap fase.
- Slot tersedia dibuat oleh admin (lihat 3.4). Peserta memilih satu slot
  kosong dari daftar.
- **Jatah**: setiap peserta mendapat 2 kali sesi mentoring per fase.
  - Bila peserta mencoba booking sesi ke-2 di minggu pertama periode
    booking, sistem menampilkan peringatan konfirmasi: idealnya sesi kedua
    diambil di minggu kedua supaya ada jeda implementasi. Peserta tetap bisa
    melanjutkan booking setelah konfirmasi.
- Setelah booking dikonfirmasi:
  - Slot terkunci untuk peserta tersebut (tidak bisa direbut peserta lain).
  - Sistem otomatis membuat event Google Calendar + link Google Meet,
    dengan **akun penyelenggara sebagai organizer** (bukan akun
    admin/mentor). Undangan dikirim ke email peserta dan mentor sekaligus,
    sehingga keduanya dapat join tanpa perlu approval dari organizer.
  - Booking baru ini langsung muncul di Home sebagai "Mentoring Terdekat".

### 2.4 Tugas

Dua tab terpisah: **Tugas Harian** dan **Capstone**.

- **Tugas Harian**: daftar semua tugas kelas tersebut, tiap kartu menampilkan
  status (Belum / Terkumpul / Dinilai + skor 0-100), deadline, dan feedback
  mentor/admin setelah dinilai.
- **Capstone terkunci** sampai seluruh Tugas Harian dikumpulkan (progress
  bar menunjukkan mis. 3/4). Begitu semua harian terkumpul, tab Capstone
  otomatis terbuka.
- **Halaman detail tugas** (Harian maupun Capstone) berisi:
  1. **File Brief** — file instruksi yang diunggah admin, dengan tombol
     "Unduh Brief Tugas Berikut: Download".
  2. **Form pengumpulan** — upload file (PDF/ZIP/JPG, maks 10MB) ATAU
     tempel link Google Drive. Salah satu saja cukup.
  3. Setelah dikumpulkan: peserta bisa melihat file yang sudah dikirim dan
     tombol "Ganti File" (mengganti submission sebelum dinilai).
  4. Setelah dinilai: menampilkan skor dan feedback teks dari admin.
- Kumpul yang terlambat tetap diterima sistem tapi ditandai status
  "Terlambat".

---

## 3. Menu Aplikasi Admin (Web Desktop)

Navigasi sidebar, 5 menu: **Kelas, Jadwal dan Presensi, Mentoring, Tugas
Siswa, Peserta dan Mentor**.

### 3.1 Kelas

Tempat membuat dan mengelola unit Kota+Kelas, serta menyusun materi tugas
(course builder).

**Halaman daftar:**
- Semua Kota+Kelas yang sudah dibuat ditampilkan sebagai kartu, dengan
  toggle untuk beralih ke tampilan tabel.
- Tombol **"Buat Kelas"** di halaman ini.

**Alur Buat Kelas** (popup, 3 field, singkat):
1. Kota (pilih dari daftar atau buat baru)
2. Judul / nama kelas (pilih dari daftar atau buat baru)
3. Pilih satu atau lebih Mentor (multi-select, dari daftar mentor yang
   sudah terdaftar di menu Peserta dan Mentor)
4. Simpan

Popup ini **tidak** memuat langkah tambah peserta. Setelah simpan, kartu
Kota+Kelas baru langsung muncul di daftar.

**Klik kartu / baris kelas** → membuka halaman detail kelas, berperan
sebagai **course builder** (mirip menyusun course di LMS):
- Menyusun instruksi Tugas Harian: buat entri baru berisi Judul Tugas,
  Deskripsi singkat, dan link file atau upload file instruksi.
- Menyusun instruksi Capstone: format sama — Judul, Deskripsi singkat, link
  atau upload file instruksi.
- Perubahan di sini adalah yang menentukan isi tab Tugas Harian / Capstone
  yang dilihat peserta di app mobile.

### 3.2 Jadwal dan Presensi

Tempat membuat jadwal pertemuan kelas — begitu jadwal dibuat, sesi presensi
otomatis tersedia tanpa langkah aktivasi terpisah.

**Halaman daftar:**
- Kelas-kelas ditampilkan sebagai kartu atau tabel (toggle).
- Tombol **"Buat Jadwal"** di halaman ini — begitu diklik, admin diminta
  memilih kelas mana dulu.
- Klik kartu / baris kelas (baik dari tombol Buat Jadwal maupun langsung
  dari daftar) → membuka halaman **Tambah Jadwal** untuk kelas tersebut.

**Halaman Tambah Jadwal:**
- Dua cara mengisi: **Import Excel** (banyak sesi sekaligus) atau
  **Tambah manual** (satu per satu).
- Field tambah manual:
  - Nama Pertemuan
  - Moda: Online atau Offline
    - Jika **Offline**: wajib isi Alamat dan Link Google Maps gedung.
    - Jika **Online**: wajib isi Link Zoom saja.
- Semua jadwal yang sudah ditambahkan untuk kelas ini ditampilkan sebagai
  daftar di bawah form, dengan urutan: **sesi yang sedang berlangsung
  ditampilkan paling atas**, dan untuk sesi tersebut **QR presensi otomatis
  terbuka** (tanpa aksi manual admin, kecuali untuk sesi Offline yang tetap
  memerlukan admin membuka QR secara manual — lihat 2.2 untuk aturan
  online/offline).
- Tiap sesi di daftar punya tombol untuk melihat/membesarkan QR dan
  memonitor jumlah hadir secara langsung.
- Tombol ekspor rekap presensi (CSV) tersedia di halaman ini, tidak ada
  menu ekspor terpisah.

### 3.3 Tugas Siswa

Daftar semua submission tugas yang perlu dinilai, lintas kelas.

- Dua tab terpisah: **Tugas Mandiri (Harian)** dan **Capstone**.
- Di dalam tiap tab, daftar submission diurutkan berdasarkan **siapa yang
  paling cepat mengumpulkan** (submission terlama di atas).
- **Filter berdasarkan kelas** tersedia di kedua tab, sehingga admin bisa
  fokus menilai satu kelas tertentu tanpa terganggu submission kelas lain.
- Admin membuka tiap submission untuk melihat file/link yang dikumpulkan,
  memberi skor 0-100, dan menulis feedback teks. Hasil ini langsung terlihat
  peserta di app mobile.
- Tombol ekspor rekap tugas dan nilai (CSV) tersedia di halaman ini.

### 3.4 Mentoring

Tempat membuat slot mentoring dan memantau booking peserta.

**Alur:**
1. Admin klik **"Tambah Mentor"** kemudian **upload file jadwal** (file
   Excel yang sudah berisi kolom Tanggal dan Jam).
2. Sistem otomatis men-generate slot-slot mentoring dari isi file tersebut
   (satu baris file = satu slot).
3. Admin memantau di halaman ini:
   - Slot mana yang sudah dan belum di-booking peserta.
   - Siapa saja yang sudah booking dan siapa yang belum.
   - Slot/sesi mana yang statusnya sudah selesai (waktunya sudah lewat).
4. Setelah slot dibuat, admin **wajib melakukan assign siswa** ke slot-slot
   tersebut:
   - Assign menghubungkan slot ke akun peserta yang sudah ada di database
     (menu Peserta dan Mentor).
   - Pencarian peserta untuk keperluan assign dilakukan berdasarkan nama
     kelas yang tercantum di profil peserta.
- Tombol ekspor rekap booking mentoring (CSV) tersedia di halaman ini.

*(Catatan: konfirmasi booking oleh peserta dari sisi mobile tetap memicu
pembuatan event Google Calendar + Meet seperti dijelaskan di 2.3.)*

### 3.5 Peserta dan Mentor

Tempat mengunggah akun peserta dan mentor. Fungsinya dibatasi hanya untuk
upload akun — tidak ada fitur pengelolaan lain di menu ini.

**Field wajib saat menambah akun:** Nama, Email, Kelas.

**Dua cara upload:**

1. **Upload Global** — satu file untuk seluruh kelas sekaligus.
   - File wajib memiliki kolom "Kelas".
   - Nilai di kolom "Kelas" harus **persis sama** dengan nama kelas yang
     sudah terdaftar di menu Kelas (3.1).
   - Jika ada satu saja baris dengan nama kelas yang tidak cocok, seluruh
     proses upload ditolak dan tidak bisa dilanjutkan (all-or-nothing;
     admin harus memperbaiki file terlebih dahulu).

2. **Upload Per Kelas** — admin memilih satu kelas dulu, baru upload file
   untuk kelas tersebut.
   - Karena kelas sudah ditentukan lebih dulu, kolom "Kelas" di file **tidak
     wajib ada**.
   - Ada langkah **preview** sebelum data benar-benar disimpan, sehingga
     admin bisa mengecek data sebelum konfirmasi final.

---

## 4. Poin yang Masih Perlu Diputuskan

Ditulis di sini agar tidak hilang saat sesi brainstorming ini ditinjau ulang:

- Format detail file Excel untuk import Jadwal (3.2) — kolom apa saja
  selain Nama Pertemuan, Moda, Alamat/Link Maps, Link Zoom.
- Format detail file Excel untuk import Jadwal Mentoring (3.4) — kolom
  Tanggal dan Jam sudah dikonfirmasi, perlu dipastikan kolom durasi dan
  kapasitas per slot.
- Bagaimana sistem menangani mentor yang di-assign ke lebih dari satu
  Kota+Kelas sekaligus (apakah diperbolehkan, dan bagaimana tampilannya di
  menu Peserta dan Mentor).
- Validasi email duplikat saat upload akun peserta/mentor (menu 3.5).

---

## 5. Referensi Visual

Mockup interaktif untuk alur ini tersimpan di:
`.superpowers/brainstorm/session1/content/` (folder proyek ini), dapat
dibuka ulang lewat companion browser untuk peninjauan.

---

## 6. Update — Rombakan Menu Admin (final)

Bagian 3 di atas digantikan rombakan berikut setelah tinjauan lebih lanjut.
Struktur final Admin ada **5 menu**: Kelas, Jadwal dan Presensi, Mentoring,
Tugas Siswa, Peserta dan Mentor. (Detail lengkap sudah tertulis di atas
sebagai hasil akhir §3.1–§3.5 — bagian ini menegaskan bahwa versi tersebut
final, bukan draf sementara.)

## 7. Update — Aplikasi Peserta Responsif (Mobile + Desktop)

Aplikasi Peserta bukan mobile-only. Saat dibuka di layar besar/browser
desktop, tata letak beralih otomatis:

- **Breakpoint**: di bawah ~768px pakai tata letak mobile app (bottom tab
  bar: Home, Jadwal, Mentoring, Tugas). Di atas breakpoint itu, beralih ke
  tata letak desktop.
- **Navigasi desktop**: bottom tab bar digantikan **sidebar kiri** (warna
  primer `#0072CE`), berisi menu yang sama dengan ikon yang sama.
- **Konten Home desktop**: berubah dari susunan 1 kolom (stack vertikal)
  menjadi **grid 2 kolom** — kolom kiri lebih lebar berisi kartu Sesi
  Berlangsung (diperbesar) plus ringkasan progres bootcamp (presensi, tugas
  harian, mentoring dalam bentuk angka); kolom kanan berisi kartu Mentoring
  Terdekat dan Tugas Terdekat.
- **Scan QR presensi tetap wajib menggunakan kamera HP**, sekalipun peserta
  sedang mengakses aplikasi dari desktop — karena webcam desktop tidak
  praktis untuk alur scan QR yang sudah didesain (lihat §2.2). Tombol Scan
  QR Hadir di tampilan desktop mengarahkan peserta untuk membuka aplikasi
  atau kamera di HP-nya.
- Halaman Jadwal, Mentoring, dan Tugas versi desktop mengikuti pola yang
  sama: konten yang di mobile berbentuk stack kartu penuh-lebar, di desktop
  disusun ulang jadi grid/kolom yang memanfaatkan ruang layar lebar, tanpa
  mengubah data atau aksi yang tersedia.
