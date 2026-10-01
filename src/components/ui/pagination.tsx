'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Jumlah baris per halaman di seluruh daftar admin / Rows per page across the admin lists */
export const PAGE_SIZE = 10;

interface PaginationProps {
  page: number;
  totalItems: number;
  onChange: (page: number) => void;
  /** Kata benda jamak untuk keterangannya, misalnya "akun" / Plural noun for the caption, e.g. "akun" */
  label: string;
}

/**
 * Navigasi halaman untuk daftar panjang.
 *
 * Menyebutkan rentang yang sedang dilihat beserta totalnya, bukan hanya nomor
 * halaman: "11-20 dari 47" memberi tahu berapa yang tersisa, sedangkan
 * "halaman 2" menuntut pembacanya mengalikan sendiri.
 *
 * Page navigation for long lists.
 *
 * It states the range in view and the total rather than only a page number:
 * "11-20 of 47" says how many remain, while "page 2" asks the reader to do the
 * multiplication themselves.
 */
export function Pagination({ page, totalItems, onChange, label }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  // Satu halaman tidak perlu navigasi; menampilkannya hanya menambah baris
  // yang tidak dapat ditekan.
  //
  // A single page needs no navigation; showing it only adds a row nothing can
  // be done with.
  if (totalPages <= 1) return null;

  const mulai = page * PAGE_SIZE + 1;
  const akhir = Math.min((page + 1) * PAGE_SIZE, totalItems);

  const tombol = (arah: -1 | 1, disabled: boolean) => (
    <button
      type="button"
      onClick={() => onChange(page + arah)}
      disabled={disabled}
      aria-label={arah === -1 ? 'Halaman sebelumnya' : 'Halaman berikutnya'}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '30px', height: '30px', borderRadius: '8px',
        border: '1px solid var(--color-border)', backgroundColor: '#ffffff',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
      }}
    >
      {arah === -1
        ? <ChevronLeft size={14} color="var(--color-text-main)" strokeWidth={2} />
        : <ChevronRight size={14} color="var(--color-text-main)" strokeWidth={2} />}
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
        {mulai}-{akhir} dari {totalItems} {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {tombol(-1, page === 0)}
        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-main)', minWidth: '58px', textAlign: 'center' }}>
          Hal {page + 1} / {totalPages}
        </span>
        {tombol(1, page >= totalPages - 1)}
      </div>
    </div>
  );
}
