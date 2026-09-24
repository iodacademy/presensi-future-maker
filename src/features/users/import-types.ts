// Tipe data impor akun pengguna / User account import data types
import type { Role } from '../auth/types';

export interface ImportRow {
  name: string;
  email: string;
  role: Role;
  className: string;
}

export interface ValidatedImportRow extends ImportRow {
  rowNumber: number;
  status: 'VALID' | 'DITOLAK';
  errors: string[];
}

export interface ImportPreviewResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  isValid: boolean;
  rows: ValidatedImportRow[];
}
