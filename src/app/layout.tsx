import React from 'react';
import './globals.css';
import type { Metadata } from 'next';
import { inter, poppins } from '@/fonts';

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
