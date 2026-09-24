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
