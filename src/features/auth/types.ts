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
  createdAt: string;
  updatedAt: string;
}

export interface Actor {
  uid: string;
  email: string;
  name: string;
  role: Role;
  classId: string | null;
}
