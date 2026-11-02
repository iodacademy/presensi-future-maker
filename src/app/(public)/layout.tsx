import React from 'react';
import type { Metadata } from 'next';
import { poppinsPameran as poppins } from '@/fonts';
import { Header } from '@/features/exhibition/ui';
import '@/features/exhibition/pameran.css';

export const metadata: Metadata = {
  title: 'Pameran Bootcamp Future Innovators 2026',
  description: 'Pameran karya peserta Bootcamp Future Innovators 2026 · Plan Indonesia',
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`pameran ${poppins.variable}`}>
      <Header />
      <main style={{ flex: 1 }}>{children}</main>
      <footer style={{ background: 'var(--surface-muted)', padding: '32px 22px' }}>
        <div style={{ maxWidth: 1024, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
          <span>Pameran Karya Bootcamp Future Innovators 2026 · Plan Indonesia</span>
          <span>Sampai semua setara</span>
        </div>
      </footer>
    </div>
  );
}
