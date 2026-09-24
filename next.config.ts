import type { NextConfig } from 'next';

// Harus berupa objek, bukan fungsi. Hostinger membungkus berkas ini dengan config
// miliknya sendiri untuk memaksa output standalone, dan penggabungan itu hanya
// bekerja pada ekspor objek -- ekspor fungsi membuat build gagal dengan
// "produced no standalone server or static output".
//
// Must be an object, not a function. Hostinger wraps this file with its own
// config to force standalone output, and that merge only works on an object
// export -- a function export fails the build with "produced no standalone
// server or static output".
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Menyalin dependensi terpakai ke satu folder mandiri, sehingga image Docker
  // tidak perlu memuat seluruh node_modules. Hostinger memaksa nilai ini juga,
  // jadi menyetelnya di sini tidak mengganggu jalur itu.
  //
  // Copies only the used dependencies into a self-contained folder, so the
  // Docker image need not ship all of node_modules. Hostinger forces this value
  // too, so setting it here does not disturb that path.
  output: 'standalone',
  // Build tidak menimpa chunk dev yang sedang dilayani / Builds must not overwrite chunks served by a running dev server
  distDir: process.env.NODE_ENV === 'development' ? '.next' : '.next-build',
};

export default nextConfig;
