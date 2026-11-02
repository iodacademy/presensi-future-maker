import { describe, expect, it } from 'vitest';
import {
  formatApplicationNumber, isEligible, studentStatusLabel, validateApplicationInput, type JobDocuments, type JobQuestion,
} from '../../src/features/careers/model';

const questions: JobQuestion[] = [
  { id: 'q1', label: 'Kenapa tertarik?', kind: 'long', options: [], required: true },
  { id: 'q2', label: 'Bersedia hybrid?', kind: 'yes-no', options: [], required: false },
  { id: 'q3', label: 'Durasi', kind: 'choice', options: ['3 bulan', '6 bulan'], required: false },
];
const documents: JobDocuments = { portfolio: 'optional', works: 'optional', coverLetter: 'optional' };
const job = { documents, questions };
const owned = { cvIds: new Set(['cv1']), coverIds: new Set(['sl1']), workIds: new Set(['w1']), submissionIds: new Set(['t1_u1']) };
const personal = { fullName: 'Andi Pratama', email: 'andi@x.id', phone: '0812', city: 'Semarang', school: 'SMK 1', major: 'RPL', linkedin: '' };
const base = { personal, cvId: 'cv1', coverLetterId: null, portfolioUrl: '', workIds: [], submissionIds: [], answers: { q1: 'Suka desain' } };

describe('kelayakan pelamar', () => {
  it('mode semua selalu layak', () => {
    expect(isEligible({ mode: 'all' }, { classId: null, finalScore: null })).toBe(true);
  });
  it('kelas tertentu hanya kelas itu', () => {
    expect(isEligible({ mode: 'classes', classIds: ['k1'] }, { classId: 'k2', finalScore: 90 })).toBe(false);
    expect(isEligible({ mode: 'classes', classIds: ['k1'] }, { classId: 'k1', finalScore: null })).toBe(true);
  });
  it('nilai minimal butuh nilai yang ada dan cukup', () => {
    expect(isEligible({ mode: 'min-score', minScore: 75 }, { classId: 'k1', finalScore: null })).toBe(false);
    expect(isEligible({ mode: 'min-score', minScore: 75 }, { classId: 'k1', finalScore: 80 })).toBe(true);
  });
});

describe('validasi lamaran', () => {
  it('lamaran sah dirapikan', () => {
    const r = validateApplicationInput({ ...base, answers: { q1: ' Suka desain ', q2: 'Ya', q9: 'buang' } }, job, owned);
    expect(r.answers).toEqual({ q1: 'Suka desain', q2: 'Ya' });
    expect(r.cvId).toBe('cv1');
  });
  it('data diri wajib lengkap', () => {
    expect(() => validateApplicationInput({ ...base, personal: { ...personal, phone: ' ' } }, job, owned)).toThrow('Lengkapi data diri: No. WhatsApp');
    expect(() => validateApplicationInput({ ...base, personal: { ...personal, school: '' } }, job, owned)).toThrow('Lengkapi data diri: Asal sekolah / kampus');
  });
  it('CV harus milik siswa', () => {
    expect(() => validateApplicationInput({ ...base, cvId: 'cvLain' }, job, owned)).toThrow('CV tidak ditemukan');
  });
  it('karya dan tugas harus milik siswa', () => {
    expect(() => validateApplicationInput({ ...base, workIds: ['wLain'] }, job, owned)).toThrow('Lampiran bukan milikmu');
    expect(() => validateApplicationInput({ ...base, submissionIds: ['t1_u2'] }, job, owned)).toThrow('Lampiran bukan milikmu');
  });
  it('portofolio wajib dan harus http(s)', () => {
    const j = { ...job, documents: { ...documents, portfolio: 'required' as const } };
    expect(() => validateApplicationInput(base, j, owned)).toThrow('Link portofolio wajib diisi');
    expect(() => validateApplicationInput({ ...base, portfolioUrl: 'javascript:x' }, job, owned)).toThrow('Tautan harus diawali http:// atau https://');
  });
  it('karya wajib butuh minimal satu karya atau tugas', () => {
    const j = { ...job, documents: { ...documents, works: 'required' as const } };
    expect(() => validateApplicationInput(base, j, owned)).toThrow('Lampirkan minimal satu karya atau tugas');
    expect(validateApplicationInput({ ...base, submissionIds: ['t1_u1'] }, j, owned).submissionIds).toEqual(['t1_u1']);
  });
  it('surat lamaran wajib', () => {
    const j = { ...job, documents: { ...documents, coverLetter: 'required' as const } };
    expect(() => validateApplicationInput(base, j, owned)).toThrow('Surat lamaran wajib diunggah');
    expect(() => validateApplicationInput({ ...base, coverLetterId: 'slLain' }, job, owned)).toThrow('Surat lamaran tidak ditemukan');
  });
  it('pertanyaan wajib dan jawaban pilihan diperiksa', () => {
    expect(() => validateApplicationInput({ ...base, answers: {} }, job, owned)).toThrow('Jawab pertanyaan: Kenapa tertarik?');
    expect(() => validateApplicationInput({ ...base, answers: { q1: 'x', q3: '1 tahun' } }, job, owned)).toThrow('Jawaban tidak sah: Durasi');
    expect(() => validateApplicationInput({ ...base, answers: { q1: 'x', q2: 'Mungkin' } }, job, owned)).toThrow('Jawaban tidak sah: Bersedia hybrid?');
    expect(() => validateApplicationInput({ ...base, answers: { q1: 'a'.repeat(3001) } }, job, owned)).toThrow('Jawaban terlalu panjang: Kenapa tertarik?');
  });
  it('lampiran untuk dokumen yang tidak diminta dibuang', () => {
    const off = { ...job, documents: { portfolio: 'off' as const, works: 'off' as const, coverLetter: 'off' as const } };
    const r = validateApplicationInput({ ...base, portfolioUrl: 'https://x.id', workIds: ['w1'], submissionIds: ['t1_u1'], coverLetterId: 'sl1' }, off, owned);
    expect(r).toMatchObject({ portfolioUrl: '', workIds: [], submissionIds: [], coverLetterId: null });
  });
});

describe('label dan nomor lamaran', () => {
  it('shortlist tampil sebagai dilihat mitra bagi siswa', () => {
    expect(studentStatusLabel('shortlist')).toBe('Dilihat mitra');
    expect(studentStatusLabel('baru')).toBe('Terkirim');
  });
  it('nomor lamaran empat digit', () => {
    expect(formatApplicationNumber(12)).toBe('FM-JOB-0012');
  });
});
