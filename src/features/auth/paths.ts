// Helper penjaluran rute berbasis role (aman untuk klien dan server)
// Role-based route redirection helpers (safe for both client and server)
import type { Role } from './types';

/**
 * Menentukan halaman beranda tujuan berdasarkan role.
 *
 * Resolves home destination path based on role.
 */
export function getRoleRedirectPath(role: Role): string {
  switch (role) {
    case 'admin':
      return '/admin/kelas';
    case 'student':
      return '/app';
    case 'mentor':
      return '/mentor/peserta';
    default:
      return '/login';
  }
}

/**
 * Memverifikasi apakah role diizinkan mengakses path tertentu.
 *
 * Verifies whether a role is authorized to access a specific path.
 */
export function isAuthorizedPath(role: Role, path: string): boolean {
  if (path.startsWith('/admin')) {
    return role === 'admin';
  }
  if (path.startsWith('/app')) {
    return role === 'student';
  }
  if (path.startsWith('/mentor')) {
    return role === 'mentor';
  }
  return true;
}
