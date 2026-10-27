# Rancangan Panel Admin dan Data Asli Website Pameran

Tanggal: 27 Oktober 2026
Status: menunggu persetujuan akhir pemilik produk

## 1. Tujuan

Website pameran Bootcamp Future Innovators 2026 sudah tampil di `/` dengan data contoh dari mockup. Rancangan ini mengganti data contoh itu dengan karya asli peserta dan memberi admin satu tempat untuk mengelolanya.

Pemilik produk menetapkan satu ukuran keberhasilan: setiap peserta merasa karyanya dihargai karena ikut dipamerkan. Seluruh keputusan di bawah diturunkan dari ukuran itu.

## 2. Keadaan Sekarang

Halaman publik berada di `src/app/(public)`: beranda, galeri, peserta, profil peserta, halaman karya, dokumentasi, dan tentang. Semuanya membaca `src/features/exhibition/content.ts`, yang membangkitkan 126 peserta dan 176 karya contoh secara acak, serta `photos.json` untuk foto per slot.

Bahan karya asli sudah terunduh di `TUGAS/HASIL/<Kelas>/<Nama lengkap peserta>/<Tugas>/`. Folder `TUGAS/` tidak pernah di-commit. Isi yang relevan:

| Kelas | Peserta | Bahan yang layak tampil |
|---|---|---|
| Web Programming · Semarang | 22 | 36 situs Netlify dengan tangkapan layar, 5 PDF capstone |
| Data Analyst · DKI Jakarta | 26 | 19 dashboard HTML, 32 notebook Jupyter |
| Social Media Marketing · Surabaya | 27 | 237 gambar, 50 video, 29 PDF brand identity dan laporan performa |
| Social Media Marketing · Yogyakarta | 20 | 314 gambar, 93 video, 2 PDF |

Video sudah diunggah ke folder Google Drive "KARYA PESERTA" oleh `TUGAS/_alat/unggah_video_drive.py`. Pemetaan berkas lokal ke tautan Drive tersimpan di `TUGAS/_alat/video_drive.json`. Pratinjau Drive dapat diputar tanpa login.

Commit website pameran masih lokal dan belum di-push. Pemilik produk menahan push sampai data asli siap.

## 3. Sasaran

1. Semua karya yang layak tampil muncul di website, di profil pembuatnya dan di galeri.
2. Setiap peserta muncul di beberapa halaman pertama galeri.
3. Admin mengisi data lewat impor otomatis, lalu mengkurasi di panel. Admin tidak mengetik ratusan karya satu per satu dan tidak menerbitkannya satu per satu.
4. Situs web dan dashboard dapat dicoba langsung di halaman karya, selain lewat tangkapan layar dan tombol demo.
5. Biaya Firestore dan Storage tetap kecil walaupun website dibuka publik.

## 4. Bukan Sasaran

1. Peserta mengedit profil atau karyanya sendiri.
2. Komentar, suka, atau pemungutan suara.
3. Unggahan dari pengunjung publik.
4. Statistik kunjungan.
5. Karya kelompok, misalnya tugas HP 7 Web Programming yang dikerjakan per tim.
6. Kalender konten SMM. Bahannya berupa lembar kerja Excel yang tidak layak tampil.

## 5. Hal yang Tidak Boleh Terjadi

1. Nama lengkap peserta tampil di halaman publik. Website hanya menampilkan nama panggilan. Nama lengkap di dalam PDF karya dibiarkan, sesuai keputusan pemilik produk.
2. Peserta tidak muncul di galeri karena karyanya dianggap kalah bagus.
3. Satu halaman memuat banyak iframe sekaligus.
4. Setiap kunjungan publik membaca Firestore.
5. Working paper, checklist, worksheet, dan SOP tampil di website.

## 6. Keputusan Pemilik Produk

Keputusan berikut diambil pemilik produk dalam percakapan dan tidak diubah tanpa persetujuannya.

**Semua karya tampil**

Karya yang lolos kurasi tampil di profil pembuatnya dan di galeri. Tidak ada tingkat "unggulan".

**Karya utama**

Setiap peserta yang punya karya terbit memiliki tepat satu karya utama. Admin memilihnya, atau sistem memilih otomatis saat impor.

**Peserta tanpa karya**

Peserta yang tidak punya karya layak tampil tetap muncul di halaman Peserta dan punya profil, tanpa daftar karya. Peserta ini tidak masuk galeri.

**Peluncuran**

Kurasi dilakukan di laptop lewat `npm run dev`, yang tersambung ke Firestore produksi `bootcamp-future-makers-id`. Commit tidak di-push sampai pemilik produk menyatakan data lengkap dan siap. Push pertama langsung menayangkan website pameran dengan data asli, sehingga sakelar peluncuran tidak dibuat.

**Urutan galeri bergiliran**

Putaran pertama berisi karya utama setiap peserta. Putaran kedua berisi karya kedua setiap peserta, dan seterusnya. Di dalam satu putaran, dua kartu yang bersebelahan tidak berasal dari jenis karya yang sama atau kelas yang sama.

**Urutan berganti setiap hari**

Pengacakan memakai tanggal WIB sebagai benih. Dalam satu hari urutannya tetap. Pergantian hanya mengubah urutan, semua karya tetap ada di salah satu halaman.

**Koleksi "satu brief, banyak versi"**

Karya dengan brief yang sama untuk seluruh kelas, yaitu Dapur Nia dan Portal HRIS Sedap, tampil di galeri sebagai satu kartu koleksi. Halaman koleksi menampilkan grid semua versi dengan tombol Coba langsung dan Demo. Setiap versi tetap tercantum sebagai karya biasa di profil pembuatnya. Tampilannya mengikuti contoh di `/contoh-koleksi` yang sudah disetujui.

Keputusan perancang: jika karya utama seorang peserta adalah anggota koleksi, karya itu tetap tampil sebagai kartu sendiri di putaran pertama galeri. Tanpa pengecualian ini, peserta yang hanya punya karya Dapur Nia atau Portal HRIS Sedap tidak muncul di putaran pertama.

**Embed langsung**

Situs Netlify dan dashboard HTML tampil di iframe di halaman karya, dengan tangkapan layar sebagai sampul dan tombol "Buka demo" ke situs aslinya.

**Carousel SMM**

Satu carousel dihitung satu karya. Slide bergeser otomatis dan tetap dapat digeser manual.

**Label AI**

Karya yang dibuat dengan bantuan AI diberi label "Dibuat dengan bantuan AI". Admin menyalakannya per karya.

**Video**

Video karya disimpan di Google Drive dan diputar lewat pratinjau Drive. Admin juga dapat menempelkan tautan YouTube.

**Impor dan penerbitan massal**

Impor otomatis membuat draf. Admin menerbitkan banyak karya sekaligus dengan tombol "Terbitkan semua yang tampil" setelah menyaring daftar.

**Jenis karya mengikuti tugas asli**

| Jurusan | Jenis karya |
|---|---|
| Web Programming | Landing Page, Aplikasi Web, Capstone |
| Data Analyst | Dashboard, Data Cleaning, Analisis Data |
| Social Media Marketing | Konten Feed, Reels, Brand Identity, Laporan Campaign |

Jenis REST API dan Kalender Konten dari mockup dihapus. Alat yang tercantum pada jenis Dashboard diganti dari Looker Studio dan BigQuery menjadi Python dan HTML.

## 7. Model Data

Koleksi Firestore baru, semuanya hanya dapat ditulis lewat API admin di server.

**`exhibitionPeople/{uid}`**

Satu dokumen per peserta yang tampil, dengan id sama dengan uid di `users`. Kolom: `classId`, `nickname`, `photoUrl`, `bio`, `skills`, `linkedinUrl`, `portfolioUrl`, `visible`, `mainWorkId`, `updatedAt`.

**`exhibitionWorks/{id}`**

Satu dokumen per karya. Kolom:

| Kolom | Isi |
|---|---|
| `personUid`, `classId`, `track` | Pemilik karya dan kelasnya |
| `type` | Salah satu jenis di Bagian 6 |
| `title`, `description`, `tools` | Teks yang diedit admin |
| `status` | `draft`, `published`, atau `hidden` |
| `aiAssisted` | Label AI |
| `collectionId` | Koleksi tempat karya ini masuk, atau `null` |
| `cover` | URL sampul kecil dan URL sampul penuh |
| `media` | Satu bentuk tampilan: `site`, `html`, `carousel`, `video`, atau `pdf`, beserta URL-nya |
| `sourceKey` | Kunci impor `kelas/peserta/tugas/berkas`, dipakai agar impor ulang tidak menggandakan karya |
| `createdAt`, `updatedAt` | Stempel waktu |

**`exhibitionCollections/{id}`**

Kolom: `title`, `brief`, `classId`, `type`, `coverUrls`.

**`exhibitionSite/content`**

Satu dokumen untuk isi situs di luar karya: foto per slot yang sekarang ada di `photos.json`, tautan video di `VIDEOS`, kutipan testimoni peserta per kelas, testimoni trainer, dan testimoni Plan Indonesia.

## 8. Jalur Baca Publik

Halaman publik membaca data lewat satu fungsi server yang dibungkus cache Next dengan tag `pameran` dan masa berlaku 5 menit. Setiap penulisan dari API admin memanggil `revalidateTag('pameran')`.

Keputusan perancang: Cloud Run menjalankan 0 sampai 10 instans, dan cache Next tersimpan per instans. `revalidateTag` hanya membersihkan instans yang menerima permintaan admin. Masa berlaku 5 menit membatasi data usang di instans lain menjadi paling lama 5 menit. Akibatnya, setiap instans membaca Firestore paling banyak sekali per 5 menit per fungsi baca, ditambah sekali saat instans baru menyala. Jumlah pembacaan itu tidak bergantung pada jumlah pengunjung.

Fungsi baca untuk galeri hanya memilih kolom kartu: id, judul, jenis, kelas, nama panggilan, URL sampul kecil, status label AI, dan id koleksi. Deskripsi dan data media dibaca terpisah saat satu halaman karya dibuka, sesuai ketentuan basis data K-1, K-2, dan K-5.

Urutan bergiliran dihitung di server dari daftar yang sudah ter-cache. Tanggal WIB menjadi benih, sehingga server dan peramban menghasilkan urutan yang sama.

Perkiraan beban menurut rumus `payload × panggilan per hari × 30`:

| Jalur | Payload | Panggilan per hari | Per bulan |
|---|---|---|---|
| Daftar kartu galeri dari server ke peramban | [BUTUH DATA: ukuran JSON setelah impor, target di bawah 150 kB] | [BUTUH DATA: perkiraan pengunjung galeri per hari] | dihitung setelah dua angka di kiri ada |
| Sampul kartu dari Storage | 24 sampul WebP lebar 640 piksel per halaman, target 40 kB per sampul | sama dengan baris di atas | dihitung setelah angka pengunjung ada |
| Dashboard HTML di iframe | sekitar 4,8 MB per berkas sebelum kompresi | hanya saat pengunjung menekan Coba langsung | dihitung setelah angka pengunjung ada |

Firestore tidak masuk tabel karena pembacaannya dibatasi masa berlaku cache, bukan jumlah pengunjung.

## 9. Penyimpanan Berkas

Semua berkas karya masuk Firebase Storage di bawah `pameran/`, yang sudah dibuka baca publik di `storage.rules`. Aturan itu belum di-deploy dan wajib di-deploy sebelum peluncuran.

| Berkas | Jalur | Perlakuan |
|---|---|---|
| Gambar karya dan sampul | `pameran/karya/<workId>/<hash>.webp` | WebP, lebar maksimum 1600 piksel, sampul kartu 640 piksel |
| Dashboard HTML dan notebook | `pameran/karya/<workId>/<hash>.html` | Disimpan dengan kompresi gzip dan `contentEncoding: gzip` |
| PDF | `pameran/karya/<workId>/<hash>.pdf` | Halaman pertama dirender menjadi sampul WebP |
| Foto profil | `pameran/peserta/<uid>-<hash>.webp` | WebP persegi |
| Foto situs | `pameran/<slot>-<hash>.webp` | Sama dengan skrip `upload-pameran-photos` yang sudah ada |

Setiap berkas memakai `cache-control: public, max-age=31536000, immutable`. Nama berkas memuat hash isi sehingga berkas yang diganti selalu mendapat URL baru.

Iframe untuk situs dan dashboard memakai `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`. Tanpa `allow-same-origin`, situs Vite peserta tampil tanpa CSS karena skrip dan stylesheet bertanda `crossorigin` gagal dimuat. Pengujian di `/contoh-koleksi` membuktikannya. Situs peserta berada di domain lain, jadi izin ini tidak memberi akses ke domain aplikasi.

Iframe baru dimuat setelah pengunjung menekan "Coba langsung". Sebelum itu yang tampil adalah tangkapan layar.

`sharp` sekarang berada di `devDependencies`. Pengolahan gambar di API admin membutuhkannya di `dependencies`.

## 10. Impor Otomatis

Impor berjalan sebagai skrip lokal, mengikuti pola `scripts/upload-pameran-photos.ts`: tanpa `--apply` skrip hanya menampilkan rencana, dengan `--apply` skrip mengunggah dan menulis ke Firestore.

**Pencocokan peserta**

Nama folder peserta adalah nama lengkap. Skrip mencocokkannya dengan nama pengguna di kelas yang sama. Nama folder yang tidak cocok dilaporkan dan dilewati. Nama panggilan awal diambil dari kata pertama nama lengkap.

Skrip membuat dokumen `exhibitionPeople` untuk setiap peserta aktif di empat kelas, termasuk yang tidak punya folder di HASIL, dengan `visible` bernilai `true`. Peserta uji yang ditandai `isTest` dilewati.

**Pemetaan tugas ke jenis karya**

| Kelas | Tugas | Jenis | Media |
|---|---|---|---|
| Web | HP 1 dan HP 3 Dapur Nia | Aplikasi Web, koleksi Dapur Nia | `site` |
| Web | HP 4 Portal HRIS Sedap | Aplikasi Web, koleksi Portal HRIS Sedap | `site` |
| Web | HP 9 Landing Page | Landing Page | `site` |
| Web | PM 1 dan PM 2 | Aplikasi Web | `site` |
| Web | CP 1 | Capstone | `pdf` |
| Data Analyst | HP 9 | Dashboard | `html` |
| Data Analyst | HP 7 | Analisis Data | `html` dari notebook |
| Data Analyst | PM 1 dan PM 2 | Data Cleaning | `html` dari notebook |
| SMM | Folder konten gambar dan PM | Konten Feed | `carousel` |
| SMM | Folder konten video dan PM | Reels | `video` |
| SMM Surabaya | HP 12 | Brand Identity | `pdf` |
| SMM Surabaya | HP 16 | Laporan Campaign | `pdf` |

Satu folder terdalam yang berisi gambar menjadi satu carousel. Folder dan berkas yang namanya memuat penanda bahan mentah, seperti "mentah", "scene", "shot", "proses", dan "aset", dilewati. Tautan situs yang sama pada dua tugas milik satu peserta hanya menjadi satu karya. Berkas yang namanya menunjukkan hasil generator AI, seperti "Gemini_Generated_Image", langsung diberi label AI.

**Karya utama otomatis**

Urutan prioritas: Capstone, Landing Page, Aplikasi Web di luar koleksi, Dashboard, Konten Feed, Reels, lalu jenis lain. Karya di dalam koleksi menjadi karya utama hanya jika peserta tidak punya karya lain.

**Impor ulang**

Impor dapat dijalankan lagi setelah ada kiriman baru, misalnya capstone yang masih menyusul. Karya dengan `sourceKey` yang sudah ada tidak disentuh, sehingga hasil kurasi admin tidak tertimpa.

## 11. Panel Admin

Menu baru "Pameran" di sidebar admin `src/components/app-shell.tsx`, berisi empat tab.

**Karya**

Tabel dengan saringan kelas, jenis, status, dan koleksi, serta pencarian nama. Setiap baris punya kotak centang. Aksi massal: Terbitkan, Sembunyikan, Jadikan draf, Nyalakan label AI, Matikan label AI, dan Masukkan ke koleksi. Tombol "Terbitkan semua yang tampil" menerbitkan seluruh hasil saringan. Form edit karya mengubah teks, jenis, sampul, URL situs, tautan video, dan urutan slide carousel. Tombol "Tambah karya" membuka form yang sama dengan pencarian nama peserta.

Keputusan perancang, karena pemilik produk meminta admin dapat mengunggah foto dari laptop: form karya menerima unggahan gambar untuk slide dan sampul, PDF, dan berkas HTML dashboard. Server mengompres gambar ke WebP dan menyimpan HTML dengan gzip. Untuk PDF yang diunggah lewat panel, admin mengunggah gambar sampulnya sendiri. Perenderan halaman pertama PDF dan konversi notebook hanya berjalan di skrip impor, supaya Cloud Run tidak perlu memasang poppler dan Jupyter.

**Peserta**

Daftar peserta per kelas. Form edit berisi nama panggilan, foto profil, bio, keahlian, LinkedIn, portofolio, tampil atau tidak, dan pilihan karya utama.

**Koleksi**

Membuat, mengubah judul dan brief, dan melihat karya anggota setiap koleksi.

**Konten Situs**

Mengganti foto per slot, tautan video, dan teks testimoni di `exhibitionSite/content`.

Semua API di bawah `/api/pameran/*` memeriksa peran admin di server lewat `getSessionActor`.

## 12. Perubahan Halaman Publik

1. `content.ts` tidak lagi membangkitkan data contoh. Teks desain yang tetap, seperti deskripsi jurusan, tetap ada.
2. Galeri memakai urutan bergiliran dan menampilkan kartu koleksi.
3. Halaman karya menampilkan media sesuai bentuknya: iframe untuk `site` dan `html`, carousel otomatis, pemutar Drive atau YouTube, dan penampil PDF.
4. Halaman baru untuk koleksi.
5. Kartu dan halaman karya menampilkan label AI.
6. Profil peserta menampilkan semua karya terbit milik peserta itu, termasuk anggota koleksi. Profil peserta tanpa karya tetap tampil tanpa bagian karya.
7. Beranda dan dokumentasi membaca foto dan testimoni dari `exhibitionSite/content`.

## 13. Pengujian

1. Fungsi urutan bergiliran: setiap peserta muncul di putaran pertama, tidak ada dua kartu bersebelahan dengan jenis atau kelas yang sama jika susunan itu mungkin, dan hasilnya sama untuk tanggal yang sama.
2. Fungsi baca publik hanya mengembalikan karya berstatus `published` milik peserta yang `visible`, dan tidak pernah mengembalikan nama lengkap.
3. API admin menolak peran selain admin.
4. Impor: pemetaan tugas ke jenis, pelewatan bahan mentah, dan impor ulang yang tidak menggandakan karya.
5. Aksi massal terbitkan mengubah status seluruh karya hasil saringan.

## 14. Diserahkan kepada Pembangun

1. Tata letak tabel dan form admin, mengikuti komponen admin yang sudah ada.
2. Cara merender notebook dan halaman pertama PDF menjadi berkas tampil.
3. Penanda bahan mentah tambahan yang ditemukan saat impor percobaan.
4. Posisi kartu koleksi di dalam urutan bergiliran.

## 15. Risiko

1. Firebase Storage belum terbukti menyajikan berkas HTML untuk iframe dengan tipe konten yang benar. Pembangun memverifikasinya dengan satu dashboard sebelum mengimpor semua. Jika gagal, dashboard ditempatkan di Netlify seperti situs peserta.
2. Folder Drive "KARYA PESERTA" sekarang dibagikan dengan izin Editor untuk siapa saja yang punya tautan. Siapa pun yang membuka tautan video di website dapat mengganti isi videonya. Pemilik folder mengubahnya menjadi Pelihat sebelum peluncuran.
3. Situs Netlify milik peserta dapat dihapus pemiliknya kapan saja. Tangkapan layar tetap tampil, tetapi tombol Coba langsung dan Demo menjadi rusak.
