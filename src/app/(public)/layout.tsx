import React from 'react';
import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { Header } from '@/features/exhibition/ui';
import '@/features/exhibition/pameran.css';

// Bobot 500 dan 600 dipakai desain pameran, tidak dimuat oleh layout akar / Weights 500 and 600 are used by the exhibition design and not loaded by the root layout
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-pameran-headline',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Pameran Future Makers 2026',
  description: 'Pameran karya peserta bootcamp Future Makers 2026 · Plan Indonesia',
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`pameran ${poppins.variable}`}>
      <Header />
      <main style={{ flex: 1 }}>{children}</main>
      <footer style={{ background: 'var(--surface-muted)', padding: '32px 22px' }}>
        <div style={{ maxWidth: 1024, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
          <span>Pameran Karya Bootcamp Future Makers 2026 · Plan Indonesia</span>
          <span>Sampai semua setara</span>
        </div>
      </footer>
    </div>
  );
}
