import localFont from 'next/font/local';

/**
 * Font disimpan di repo, tidak diambil dari Google Fonts saat build. Sejak
 * November 2026 Google Fonts mengirim alamat berkas tanpa ekstensi ke server
 * Cloud Build, dan pemuat next/font/google gagal membacanya sehingga build
 * berhenti. Berkasnya subset latin dari Google Fonts, jadi tampilannya sama.
 *
 * Fonts live in the repo instead of being fetched from Google Fonts at build
 * time. Since November 2026 Google Fonts sends Cloud Build servers file URLs
 * without an extension, and the next/font/google loader fails to parse them,
 * stopping the build. The files are the Google Fonts latin subset, so they
 * look the same.
 */

// Poppins (judul) dan Inter (body/UI) sesuai file Figma / Poppins (headings) and Inter (body/UI) per the Figma file
export const poppins = localFont({
  src: [
    { path: './poppins-400.woff2', weight: '400', style: 'normal' },
    { path: './poppins-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-poppins',
  display: 'swap',
});

export const inter = localFont({
  src: './inter-latin.woff2',
  weight: '400 700',
  variable: '--font-inter',
  display: 'swap',
});

// Desain pameran juga memakai bobot 500 dan 600 / The exhibition design also uses weights 500 and 600
export const poppinsPameran = localFont({
  src: [
    { path: './poppins-400.woff2', weight: '400', style: 'normal' },
    { path: './poppins-500.woff2', weight: '500', style: 'normal' },
    { path: './poppins-600.woff2', weight: '600', style: 'normal' },
    { path: './poppins-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-pameran-headline',
  display: 'swap',
});
