import React from 'react';
import './globals.css';
import type { Metadata } from 'next';
import { Poppins, Inter } from 'next/font/google';

// Font persis sesuai file Figma: Poppins (judul) dan Inter (body/UI)
// Fonts matching the Figma file exactly: Poppins (headings) and Inter (body/UI)
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Future Innovators Bootcamp',
  description: 'Aplikasi Manajemen Future Innovators Bootcamp',
};

// Layout akar aplikasi / Application root layout
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${poppins.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
