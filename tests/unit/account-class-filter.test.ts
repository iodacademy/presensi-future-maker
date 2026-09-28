// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const page = readFileSync(
  resolve(process.cwd(), 'src/app/(admin)/admin/akun/page.tsx'),
  'utf-8'
);

/**
 * Halaman akun memuat seluruh angkatan sekaligus.
 *
 * Pencarian teks sudah mencakup nama kelas, tetapi mengetiknya menuntut admin
 * mengingat ejaan persisnya dan tetap memunculkan kelas lain yang namanya
 * beririsan -- "Web Programming Semarang" dan "Web Programming Surabaya"
 * keduanya cocok dengan "web programming".
 *
 * The accounts page loads every cohort at once.
 *
 * The text search already covers class names, but typing one requires the
 * admin to recall its exact spelling and still surfaces other classes whose
 * names overlap -- "Web Programming Semarang" and "Web Programming Surabaya"
 * both match "web programming".
 */
describe('penyaring kelas pada halaman akun', () => {
  it('menyaring menurut classId, bukan nama kelas', () => {
    // Nama kelas dapat beririsan; ID-nya tidak.
    // Class names can overlap; their IDs cannot.
    expect(page).toContain("classFilter === '' || u.classId === classFilter");
  });

  it('menyediakan pilihan Semua', () => {
    // Tanpa jalan kembali, admin harus memuat ulang halaman untuk melihat
    // seluruh akun lagi.
    //
    // With no way back an admin would reload the page to see every account
    // again.
    expect(page).toMatch(/\['', 'Semua'\]/);
  });

  it('menyembunyikan penyaring pada tab admin', () => {
    // Admin tidak terikat kelas, sehingga penyaringnya akan selalu
    // mengosongkan daftar pada tab itu.
    //
    // An admin belongs to no class, so the filter would always empty the list
    // on that tab.
    expect(page).toMatch(/tab !== 'admin' && classes\.length > 0/);
  });

  it('melepas penyaring saat berpindah tab', () => {
    // Tab admin menyembunyikan penyaringnya, sehingga penyaring yang
    // tertinggal mengosongkan daftar tanpa kendali yang terlihat untuk
    // mencabutnya.
    //
    // The admin tab hides the filter, so one left behind empties the list with
    // no visible control to lift it.
    const onClick = page.slice(page.indexOf('onClick={() => {'), page.indexOf('aria-pressed={active}'));
    expect(onClick).toContain('setTab(value)');
    expect(onClick).toContain("setClassFilter('')");
  });

  it('menandai pilihan aktif bagi pembaca layar', () => {
    // Warna saja tidak terbaca pembaca layar.
    // Colour alone is not announced by a screen reader.
    const blok = page.slice(page.indexOf("tab !== 'admin' && classes.length > 0"));
    expect(blok.slice(0, 900)).toContain('aria-pressed={active}');
  });

  it('menyebut penyaring pada pesan kosong', () => {
    // "Tidak cocok dengan pencarian" menyesatkan bila yang menyaring justru
    // kelasnya, sebab kolom pencarian terlihat kosong.
    //
    // "No match for the search" misleads when it is the class doing the
    // filtering, since the search box looks empty.
    expect(page).toContain('needle || classFilter');
  });

  it('memakai daftar kelas yang sudah dimuat halaman', () => {
    // Kelas sudah diambil untuk dialog Tambah Akun; mengambilnya lagi berarti
    // satu permintaan kedua untuk data yang sama.
    //
    // Classes are already fetched for the Add Account dialog; fetching them
    // again would mean a second request for the same data.
    expect(page.match(/fetch\('\/api\/classes'\)/g)?.length ?? 0).toBe(1);
  });
});
