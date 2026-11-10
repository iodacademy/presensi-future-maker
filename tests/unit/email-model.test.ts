import { describe, expect, it } from 'vitest';
import { emailStatus, planSend, renderTemplate, templateVars, toHtml, validateTemplateInput } from '../../src/features/email/model';

const row = (score: number, placement: string, placementReasons: string[] = []) => ({
  studentId: 's1', studentName: 'Budi Santoso', className: 'Web Programming - Semarang', city: 'Semarang', score, placement, placementReasons,
}) as never;

describe('status email peserta', () => {
  it('SPA minimal 60 dan dapat skema: lulus dan berhak magang', () => {
    expect(emailStatus(row(75, 'full'))).toEqual({ category: 'lulus-magang', label: 'Lulus · Full Internship' });
    expect(emailStatus(row(62, 'project'))).toEqual({ category: 'lulus-magang', label: 'Lulus · Project Based' });
  });

  it('SPA minimal 60 tanpa skema: lulus tetapi tidak berhak magang', () => {
    expect(emailStatus(row(60, 'none'))).toEqual({ category: 'lulus-tanpa-magang', label: 'Lulus · tidak ditempatkan' });
  });

  it('SPA di bawah 60: tidak lulus, apa pun skemanya', () => {
    expect(emailStatus(row(59, 'none'))).toEqual({ category: 'tidak-lulus', label: 'Tidak lulus' });
    expect(emailStatus(row(55, 'project'))).toEqual({ category: 'tidak-lulus', label: 'Tidak lulus' });
  });

  it('capstone yang belum dinilai belum punya status', () => {
    expect(emailStatus(row(40, 'pending'))).toEqual({ category: null, label: 'Menunggu nilai capstone' });
  });
});

describe('isian template', () => {
  it('mengganti isian yang dikenal dan membiarkan yang tidak dikenal', () => {
    const vars = templateVars(row(75, 'full'));
    expect(renderTemplate('Halo {nama}, {jurusan} {kota}: SPA {spa}, {skema}. {lain}', vars))
      .toBe('Halo Budi Santoso, Web Programming Semarang: SPA 75, Full Internship. {lain}');
  });

  it('alasan diambil dari syarat skema yang tidak terpenuhi', () => {
    const vars = templateVars(row(52, 'none', ['Tidak mengumpulkan capstone', 'Nilai TPM + capstone di bawah 50']));
    expect(vars.alasan).toBe('tidak mengumpulkan capstone; nilai TPM + capstone di bawah 50');
    expect(vars.skema).toBe('-');
  });

  it('kontak PIC mengikuti kota kelas', () => {
    expect(templateVars(row(75, 'full')).kontak_pic).toContain('Rama');
  });

  it('HTML meloloskan karakter khusus dan memakai baris baru', () => {
    expect(toHtml('A <b>\nhttps://contoh.id/x')).toBe('A &lt;b&gt;<br><a href="https://contoh.id/x">https://contoh.id/x</a>');
  });
});

describe('validasi template', () => {
  it('nama, subjek, dan isi wajib; kategori harus dikenal', () => {
    expect(() => validateTemplateInput({ name: '', category: 'umum', subject: 'S', body: 'B' })).toThrow('Nama template');
    expect(() => validateTemplateInput({ name: 'N', category: 'x', subject: 'S', body: 'B' })).toThrow('Kategori');
    expect(validateTemplateInput({ name: ' N ', category: 'umum', subject: ' S ', body: 'B' })).toEqual({ name: 'N', category: 'umum', subject: 'S', body: 'B' });
  });
});

describe('rencana kirim', () => {
  it('melewati penerima yang sudah menerima template yang sama kecuali dikirim ulang', () => {
    const sent = new Set(['a']);
    expect(planSend(['a', 'b', 'b'], sent, false)).toEqual({ send: ['b'], skipped: ['a'] });
    expect(planSend(['a', 'b'], sent, true)).toEqual({ send: ['a', 'b'], skipped: [] });
  });
});
