import { describe, expect, it } from 'vitest';
import {
  assignQuestionIds, countdownParts, isoToWib, formatCountdown, jobState, partnerNameKey, salaryLabel, validateJobInput, validatePartnerInput,
} from '../../src/features/careers/model';

const baseJob = {
  partnerId: 'p1', title: 'UI/UX Designer Intern', employment: 'magang-3', category: 'desain', scheme: 'full',
  location: 'Jakarta Selatan', workMode: 'hybrid', quota: 2, description: 'Membantu tim produk.',
  qualifications: 'Menguasai Figma', eligibility: { mode: 'all' },
  opensAt: { date: '2026-11-03', time: '08:00' }, closesAt: { date: '2026-11-12', time: '23:59' },
  documents: { portfolio: 'required', works: 'optional', coverLetter: 'off' },
  questions: [], status: 'draft',
};

const basePartner = {
  name: 'PT DIPSI', field: 'Software house', about: '', logo: null, website: '',
  socials: { instagram: '', linkedin: '', tiktok: '', youtube: '' },
  pics: [{ name: 'Rina Kusuma', phone: '0812', email: 'rina@dipsi.co.id' }],
};

describe('model karier', () => {
  it('nama mitra dibandingkan tanpa beda huruf dan spasi', () => {
    expect(partnerNameKey('  PT   DIPSI ')).toBe(partnerNameKey('pt dipsi'));
  });

  it('lowongan menolak tanggal tutup sebelum tanggal buka', () => {
    expect(() => validateJobInput({ ...baseJob, opensAt: { date: '2026-11-05', time: '08:00' }, closesAt: { date: '2026-11-04', time: '23:59' } }))
      .toThrow('Tanggal tutup harus setelah tanggal buka');
  });

  it('tanggal WIB disimpan sebagai UTC', () => {
    expect(validateJobInput(baseJob).closesAt).toBe('2026-11-12T16:59:00.000Z');
    expect(validateJobInput(baseJob).opensAt).toBe('2026-11-03T01:00:00.000Z');
  });

  it('ISO UTC dikembalikan ke tanggal dan jam WIB untuk diubah', () => {
    expect(isoToWib('2026-11-12T16:59:00.000Z')).toEqual({ date: '2026-11-12', time: '23:59' });
    expect(isoToWib('2026-11-12T18:30:00.000Z')).toEqual({ date: '2026-11-13', time: '01:30' });
  });

  it('tanggal ISO yang sudah jadi diterima apa adanya', () => {
    expect(validateJobInput({ ...baseJob, closesAt: '2026-11-12T16:59:00.000Z' }).closesAt).toBe('2026-11-12T16:59:00.000Z');
  });

  it('pertanyaan pilihan butuh minimal dua opsi', () => {
    expect(() => validateJobInput({ ...baseJob, questions: [{ label: 'Durasi', kind: 'choice', options: ['3 bulan'], required: true }] }))
      .toThrow('Pertanyaan pilihan butuh minimal dua opsi');
  });

  it('pertanyaan berlabel kosong ditolak', () => {
    expect(() => validateJobInput({ ...baseJob, questions: [{ label: ' ', kind: 'long', options: [], required: false }] }))
      .toThrow('Teks pertanyaan wajib diisi');
  });

  it('opsi dikosongkan untuk pertanyaan selain pilihan', () => {
    const job = validateJobInput({ ...baseJob, questions: [{ id: 'q1', label: 'Kenapa?', kind: 'long', options: ['x'], required: true }] });
    expect(job.questions[0]).toEqual({ id: 'q1', label: 'Kenapa?', kind: 'long', options: [], required: true });
  });

  it('id pertanyaan lama dipertahankan, yang baru diberi id', () => {
    const qs = assignQuestionIds([
      { id: 'q1', label: 'A', kind: 'long', options: [], required: true },
      { id: '', label: 'B', kind: 'yes-no', options: [], required: false },
    ]);
    expect(qs[0].id).toBe('q1');
    expect(qs[1].id).toMatch(/^[a-z0-9]{8}$/);
  });

  it('kualifikasi diisi satu per baris, baris kosong dibuang', () => {
    expect(validateJobInput({ ...baseJob, qualifications: 'Menguasai Figma\n\n Punya portofolio ' }).qualifications)
      .toEqual(['Menguasai Figma', 'Punya portofolio']);
  });

  it('kuota harus bilangan bulat minimal 1', () => {
    expect(() => validateJobInput({ ...baseJob, quota: 0 })).toThrow('Kuota minimal 1');
  });

  it('mode kelas tertentu butuh minimal satu kelas', () => {
    expect(() => validateJobInput({ ...baseJob, eligibility: { mode: 'classes', classIds: [] } })).toThrow('Pilih minimal satu kelas');
  });

  it('skema lowongan wajib Full Internship atau Project Based', () => {
    expect(() => validateJobInput({ ...baseJob, scheme: undefined })).toThrow('Skema lowongan tidak dikenal');
    expect(validateJobInput(baseJob).scheme).toBe('full');
  });

  it('gaji satu angka tetap, boleh kosong', () => {
    expect(validateJobInput(baseJob).salary).toBeNull();
    expect(validateJobInput({ ...baseJob, salary: '' }).salary).toBeNull();
    expect(validateJobInput({ ...baseJob, salary: '2000000' }).salary).toBe(2000000);
    expect(() => validateJobInput({ ...baseJob, salary: -5 })).toThrow('Gaji harus berupa angka rupiah');
    expect(() => validateJobInput({ ...baseJob, salary: 'dua juta' })).toThrow('Gaji harus berupa angka rupiah');
  });

  it('label gaji per bulan, atau per project untuk Project Based', () => {
    expect(salaryLabel(2000000)).toBe('Rp 2.000.000 / bulan');
    expect(salaryLabel(2000000, 'full')).toBe('Rp 2.000.000 / bulan');
    expect(salaryLabel(1500000, 'project')).toBe('Rp 1.500.000 / project');
    expect(salaryLabel(null)).toBeNull();
    expect(salaryLabel(undefined)).toBeNull();
  });

  it('jenis yang tidak dikenal ditolak', () => {
    expect(() => validateJobInput({ ...baseJob, employment: 'freelance' })).toThrow('Jenis lowongan tidak dikenal');
  });

  it('status lowongan mengikuti waktu', () => {
    const j = { status: 'published' as const, opensAt: '2026-11-03T01:00:00.000Z', closesAt: '2026-11-10T16:59:00.000Z' };
    expect(jobState(j, new Date('2026-11-02T00:00:00Z'))).toBe('terjadwal');
    expect(jobState(j, new Date('2026-11-05T00:00:00Z'))).toBe('aktif');
    expect(jobState(j, new Date('2026-11-11T00:00:00Z'))).toBe('ditutup');
    expect(jobState({ ...j, status: 'draft' }, new Date('2026-11-05T00:00:00Z'))).toBe('draft');
  });

  it('hitung mundur diformat seperti contoh', () => {
    const now = new Date('2026-11-03T00:00:00Z');
    expect(formatCountdown(countdownParts('2026-11-05T05:20:31Z', now))).toBe('2 hari 05:20:31');
    expect(formatCountdown(countdownParts('2026-11-03T11:14:02Z', now))).toBe('11:14:02');
    expect(formatCountdown(countdownParts('2026-11-02T00:00:00Z', now))).toBe('Ditutup');
  });

  it('tautan mitra selain http(s) ditolak', () => {
    expect(() => validatePartnerInput({ ...basePartner, website: 'javascript:alert(1)' })).toThrow('Tautan harus diawali http:// atau https://');
  });

  it('mitra wajib punya nama dan minimal satu PIC dengan email sah', () => {
    expect(() => validatePartnerInput({ ...basePartner, name: ' ' })).toThrow('Nama perusahaan wajib diisi');
    expect(() => validatePartnerInput({ ...basePartner, pics: [] })).toThrow('Minimal satu PIC');
    expect(() => validatePartnerInput({ ...basePartner, pics: [{ name: 'Rina', phone: '', email: 'bukan-email' }] })).toThrow('Email PIC tidak sah');
  });

  it('isian mitra dirapikan dan email PIC dikecilkan', () => {
    const p = validatePartnerInput({ ...basePartner, name: '  PT DIPSI ', pics: [{ name: ' Rina ', phone: ' 0812 ', email: ' Rina@DIPSI.co.id ' }] });
    expect(p.name).toBe('PT DIPSI');
    expect(p.pics[0]).toEqual({ name: 'Rina', phone: '0812', email: 'rina@dipsi.co.id' });
  });
});
