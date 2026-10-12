// Tipe data autentikasi dan peran / Authentication and role data types
export type Role = 'admin' | 'student' | 'mentor';

export interface UserDocument {
  uid: string;
  email: string;
  normalizedEmail: string;
  name: string;
  role: Role;
  active: boolean;
  classId: string | null;
  /** Akun uji coba: tidak dihitung di dashboard / A test account: excluded from the dashboard */
  isTest?: boolean;
  /**
   * Tanggal bergabung "YYYY-MM-DD" bagi peserta yang masuk di tengah program.
   * Kosong berarti dihitung dari createdAt.
   *
   * Join date "YYYY-MM-DD" for a participant who entered mid-programme. Empty
   * means it counts from createdAt.
   */
  joinedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Actor {
  uid: string;
  email: string;
  name: string;
  role: Role;
  classId: string | null;
  /** Saat peserta mulai dihitung (joinMoment); hanya untuk peserta / When the participant starts counting (joinMoment); participants only */
  joinIso?: string;
}
