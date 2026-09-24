'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Calendar, Users, FileText, LogOut } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/app', icon: Home },
  { label: 'Jadwal', href: '/app/jadwal', icon: Calendar },
  { label: 'Mentoring', href: '/app/mentoring', icon: Users },
  { label: 'Tugas', href: '/app/tugas', icon: FileText },
];

interface StudentShellProps {
  userName?: string;
  children: React.ReactNode;
}

// Shell peserta: sidebar putih (desktop, node 15:2/15:3) + bottom nav (mobile, node 11:2773).
// Kedua nav dirender bersamaan, ditoggle lewat class CSS (.student-sidebar/.student-bottom-nav
// di globals.css) sesuai keputusan "1 komponen responsif" -- bukan duplikasi children/state,
// nav ini statis (cuma Link) jadi aman dirender dobel.
//
// Student shell: white sidebar (desktop, node 15:2/15:3) + bottom nav (mobile, node 11:2773).
// Both navs render together, toggled via CSS class (.student-sidebar/.student-bottom-nav in
// globals.css) per the "1 responsive component" decision -- not children/state duplication,
// this nav is static (just Links) so dual-rendering is safe.
export function StudentShell({ userName, children }: StudentShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      window.location.href = '/login';
    }
  }

  function isActive(href: string) {
    return href === '/app' ? pathname === '/app' : pathname.startsWith(href);
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--color-bg-student)' }}>
      {/* Sidebar desktop (node 15:3), disembunyikan di mobile lewat CSS / hidden on mobile via CSS */}
      <aside
        className="student-sidebar"
        style={{
          width: '220px',
          flexShrink: 0,
          backgroundColor: '#ffffff',
          borderRight: '1px solid var(--color-student-border)',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '20px', borderBottom: '1px solid var(--color-student-border)' }}>
          <span style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--color-primary)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
            B
          </span>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-main)' }}>Future Innovators</div>
            <div style={{ fontSize: '8px', color: 'var(--color-text-faint)' }}>Bootcamp</div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 12px', flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
                  borderRadius: '8px', fontSize: '12px', fontWeight: active ? 700 : 400,
                  textDecoration: 'none',
                  color: active ? 'var(--color-primary)' : 'var(--color-student-inactive)',
                  backgroundColor: active ? 'var(--color-primary-light)' : 'transparent',
                }}
              >
                <Icon size={16} color={active ? 'var(--color-primary)' : 'var(--color-student-inactive)'} strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', borderTop: '1px solid var(--color-student-border)' }}>
          <span style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: 'var(--color-avatar-cyan)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
            {(userName || 'P').charAt(0).toUpperCase()}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName || 'Peserta'}</div>
            <div style={{ fontSize: '9px', color: 'var(--color-text-faint)' }}>Peserta</div>
          </div>
          <button type="button" onClick={handleLogout} aria-label="Keluar" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}>
            <LogOut size={15} color="var(--color-text-faint)" strokeWidth={2} />
          </button>
        </div>
      </aside>

      {/* Kolom konten: berisi topbar desktop (diisi tiap halaman) + children */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, paddingBottom: '73px' }}>
        {children}
      </div>

      {/* Bottom nav mobile (node 11:2773), disembunyikan di desktop lewat CSS / hidden on desktop via CSS */}
      <nav
        className="student-bottom-nav"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          backgroundColor: '#ffffff', borderTop: '1px solid #eeeeee',
          padding: '10px 8px 26px 8px', justifyContent: 'space-around', zIndex: 40,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textDecoration: 'none', flex: 1 }}
            >
              <Icon size={20} color={active ? 'var(--color-primary)' : 'var(--color-text-faint)'} strokeWidth={2} />
              <span style={{ fontSize: '9px', fontWeight: active ? 700 : 400, color: active ? 'var(--color-primary)' : 'var(--color-text-faint)' }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
