'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, Calendar, Users, FileText, Contact, LogOut, Settings, Award, BookOpen } from 'lucide-react';
import type { Role } from '@/features/auth/types';
import { ProfileMenu } from '@/components/ui/profile-menu';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

interface AppShellProps {
  role: Role;
  userName?: string;
  classNameTitle?: string;
  children: React.ReactNode;
}

// Nilai sidebar (lebar, padding, gap) diambil presisi dari node Figma 10:1229
// Sidebar values (width, padding, gap) extracted precisely from Figma node 10:1229
const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  mentor: 'Mentor',
  student: 'Peserta',
};

export function AppShell({ role, userName, classNameTitle, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const roleLabel = ROLE_LABELS[role];

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (e) {
      window.location.href = '/login';
    }
  }

  const navMap: Record<Role, NavItem[]> = {
    admin: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutGrid },
      { label: 'Kelas', href: '/admin/kelas', icon: BookOpen },
      { label: 'Jadwal dan Presensi', href: '/admin/jadwal', icon: Calendar },
      { label: 'Mentoring', href: '/admin/mentoring', icon: Users },
      { label: 'Tugas Siswa', href: '/admin/tugas', icon: FileText },
      { label: 'Nilai Akhir', href: '/admin/nilai', icon: Award },
      { label: 'Peserta dan Mentor', href: '/admin/akun', icon: Contact },
      { label: 'Pengaturan', href: '/admin/pengaturan', icon: Settings },
    ],
    student: [
      { label: 'Home', href: '/app', icon: LayoutGrid },
      { label: 'Jadwal', href: '/app/jadwal', icon: Calendar },
      { label: 'Mentoring', href: '/app/mentoring', icon: Users },
      { label: 'Tugas', href: '/app/tugas', icon: FileText },
    ],
    mentor: [
      { label: 'Peserta Bimbingan', href: '/mentor/peserta', icon: Contact },
      { label: 'Jadwal Mentoring', href: '/mentor/jadwal', icon: Calendar },
    ],
  };

  const navItems = navMap[role] || [];
  const isAdmin = role === 'admin';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'var(--color-bg-app)' }}>
      {/* Sidebar: w=200, padding=18, gap=16 (persis node 10:1229) */}
      <aside
        className="app-shell-sidebar"
        style={{
          width: '200px',
          // Menempel setinggi layar agar menu tetap terjangkau saat halaman
          // panjang digulir; bila layarnya pendek, menunya bergulir sendiri.
          //
          // Sticks at screen height so the menu stays reachable while a long
          // page scrolls; on a short screen the menu scrolls on its own.
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          backgroundColor: isAdmin ? 'var(--color-sidebar-admin)' : '#ffffff',
          color: isAdmin ? '#ffffff' : 'var(--color-text-main)',
          borderRight: isAdmin ? 'none' : '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '18px',
          gap: '16px',
          flexShrink: 0,
        }}
      >
        {/* Logo block: itemSpacing=2, fontSize 9/13 (node 10:1230) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div
            style={{
              fontSize: '9px',
              fontWeight: 400,
              color: isAdmin ? '#ffffff' : 'var(--color-primary)',
            }}
          >
            FUTURE INNOVATORS BOOTCAMP
          </div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '13px',
              fontWeight: 700,
              color: isAdmin ? '#ffffff' : 'var(--color-text-main)',
            }}
          >
            {isAdmin ? 'Admin Panel' : 'Portal Belajar'}
          </div>
          {classNameTitle && (
            <div
              style={{
                fontSize: '11px',
                color: isAdmin ? 'var(--color-sidebar-inactive-text)' : 'var(--color-text-muted)',
                marginTop: '4px',
              }}
            >
              {classNameTitle}
            </div>
          )}
        </div>

        {/* Nav: itemSpacing=3, tiap item padding=9 gap=8 radius=8 (node 10:1233) */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'stretch', flex: 1 }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            const iconColor = isAdmin
              ? isActive ? '#ffffff' : 'var(--color-sidebar-inactive-text)'
              : isActive ? 'var(--color-primary)' : 'var(--color-text-muted)';
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: isActive ? 700 : 400,
                  textDecoration: 'none',
                  color: isAdmin
                    ? isActive ? '#ffffff' : 'var(--color-sidebar-inactive-text)'
                    : isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  backgroundColor: isActive
                    ? isAdmin ? 'var(--color-primary)' : 'var(--color-primary-light)'
                    : 'transparent',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <Icon size={14} color={iconColor} strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout: tidak ada di frame Figma A1, ditambahkan agar aplikasi berfungsi
            Logout: not present in Figma frame A1, added so the app remains usable */}
        <div
          style={{
            borderTop: isAdmin ? '1px solid var(--color-sidebar-admin-border)' : '1px solid var(--color-border)',
            paddingTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {userName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 9px' }}>
              <span
                style={{
                  width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'var(--color-primary)', color: '#ffffff',
                  fontSize: '10px', fontWeight: 700,
                }}
              >
                {userName.charAt(0).toUpperCase()}
              </span>
              <span
                style={{
                  fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  color: isAdmin ? '#ffffff' : 'var(--color-text-main)',
                }}
              >
                {userName}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: isAdmin ? 'var(--color-sidebar-inactive-text)' : 'var(--color-danger)',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '11px',
              fontWeight: 400,
              width: '100%',
            }}
          >
            <LogOut size={14} strokeWidth={2} />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main: padding=24, itemSpacing=16 (node 10:1268) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header berisi menu akun. Tombol keluar sebelumnya hanya ada pada
            sidebar, yang tersembunyi di layar sempit -- sehingga pengguna
            ponsel tidak memiliki jalan keluar sama sekali.

            The header carries the account menu. The sign-out button previously
            lived only in the sidebar, which is hidden on narrow screens --
            leaving phone users with no way out at all. */}
        <header
          className="app-shell-header"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 24px',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: '#ffffff',
          }}
        >
          {/* Menu pengganti sidebar di layar sempit, tampil lewat CSS di bawah 900px.
              The sidebar's stand-in on narrow screens, shown by CSS below 900px. */}
          <nav className="app-shell-mobile-nav" aria-label="Menu">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href} aria-current={isActive ? 'page' : undefined}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <ProfileMenu userName={userName || 'Pengguna'} roleLabel={roleLabel} />
        </header>
        <main className="app-shell-main" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>{children}</main>
      </div>
    </div>
  );
}
