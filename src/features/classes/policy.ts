// Aturan validasi dan penamaan kelas / Class validation and naming policy
import type { CreateClassInput } from './types';

/**
 * Memformat nama kanonis kelas: <Nama Program> - <Kota>
 *
 * Formats canonical class name: <Program Name> - <City>
 */
export function formatCanonicalClassName(programName: string, city: string): string {
  return `${programName.trim()} - ${city.trim()}`;
}

/**
 * Menghasilkan kunci unik kelas yang dinormalisasi huruf kecil.
 *
 * Generates normalized lowercase unique key for class identity.
 */
export function generateClassKey(city: string, programName: string): string {
  return `${city.trim().toLowerCase()}_${programName.trim().toLowerCase()}`;
}

/**
 * Memvalidasi masukan pembuatan kelas baru.
 *
 * Validates new class creation input.
 */
export function validateClassInput(input: CreateClassInput): { city: string; programName: string; mentorIds: string[] } {
  const city = input.city ? input.city.trim() : '';
  const programName = input.programName ? input.programName.trim() : '';

  if (!city || !programName) {
    throw new Error('Kota dan Nama Kelas wajib diisi / City and Program Name are required');
  }

  const mentorIds = Array.isArray(input.mentorIds) ? input.mentorIds.filter(Boolean) : [];

  return {
    city,
    programName,
    mentorIds,
  };
}
