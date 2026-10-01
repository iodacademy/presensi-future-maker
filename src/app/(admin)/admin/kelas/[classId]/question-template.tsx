'use client';

import React from 'react';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';
import { templateRows, TEMPLATE_HEADERS } from '@/features/exams/import-policy';

/**
 * Menyusun dan mengunduh berkas contoh soal.
 *
 * Berdiri terpisah dari panel impor sebab contohnya dibutuhkan lebih awal:
 * admin menyiapkan soalnya di Excel sebelum ujiannya ada, sedangkan panel
 * impor baru muncul setelah ujian dibuat dan kartunya dibuka.
 *
 * Builds and downloads the question template.
 *
 * It stands apart from the import panel because the template is needed
 * earlier: an admin prepares questions in Excel before the exam exists, while
 * the import panel only appears once an exam is created and its card opened.
 */
export function downloadQuestionTemplate(): void {
  const sheet = XLSX.utils.json_to_sheet(templateRows(), { header: [...TEMPLATE_HEADERS] });
  // Lebar kolom disetel supaya pertanyaannya terbaca tanpa perlu melebarkan
  // sendiri; berkas contoh yang kolomnya sempit terlihat seperti berkas yang
  // rusak.
  //
  // Column widths are set so the question reads without widening it by hand; a
  // template with cramped columns looks like a broken file.
  sheet['!cols'] = [{ wch: 50 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Soal');
  XLSX.writeFile(wb, 'contoh-soal-ujian.xlsx');
}

export function TemplateDownloadButton({
  compact = false,
  showColumns = false,
}: {
  compact?: boolean;
  /** Menyebutkan kolomnya di layar, untuk tempat yang belum punya keterangan lain / Names the columns on screen, where no other note explains them */
  showColumns?: boolean;
}) {
  const tombol = (
    <button
      type="button"
      onClick={downloadQuestionTemplate}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
        padding: compact ? '8px 12px' : '9px 14px', borderRadius: '8px',
        border: '1px solid var(--color-border)', backgroundColor: '#ffffff',
        fontSize: '11px', fontWeight: 700, color: 'var(--color-text-main)',
      }}
    >
      <Download size={12} strokeWidth={2} /> Unduh Contoh Excel
    </button>
  );

  if (!showColumns) return tombol;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {tombol}
      {/* Kolomnya disebut di layar, bukan hanya di dalam berkasnya: admin yang
          menyiapkan soal di komputer lain perlu tahu bentuknya tanpa membuka
          unduhan.

          The columns are named on screen rather than only inside the file: an
          admin preparing questions on another machine needs to know the shape
          without opening the download. */}
      <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
        Kolomnya: {TEMPLATE_HEADERS.join(', ')}.
      </div>
    </div>
  );
}
