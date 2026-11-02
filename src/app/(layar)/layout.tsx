import React from 'react';
import type { Metadata } from 'next';
import { poppinsPameran as poppins } from '@/fonts';
import '@/features/exhibition/pameran.css';

export const metadata: Metadata = {
  title: 'Karya Capstone · Bootcamp Future Innovators 2026',
  description: 'Tayangan karya capstone peserta Bootcamp Future Innovators 2026 · Plan Indonesia',
};

/**
 * Tata letak untuk halaman yang ditayangkan di layar pameran: tanpa menu dan
 * footer, karena tidak ada yang mengoperasikannya dengan tetikus.
 *
 * Layout for pages shown on exhibition screens: no menu or footer, since nobody
 * operates them with a mouse.
 */
export default function LayarLayout({ children }: { children: React.ReactNode }) {
  return <div className={`pameran ${poppins.variable}`}>{children}</div>;
}
