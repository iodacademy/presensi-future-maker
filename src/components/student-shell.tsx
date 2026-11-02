'use client';

import React, { createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Users, FileText, BookOpen, Briefcase } from 'lucide-react';
import { ProfileMenu } from '@/components/ui/profile-menu';
import { NotificationBell, ReminderToast } from '@/components/reminders';
import type { StudentReminders } from '@/features/dashboard/types';

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
  { label: 'Program', href: '/app/program', icon: BookOpen },
  { label: 'Karier', href: '/app/karier', icon: Briefcase },
];

interface StudentShellProps {
  userName?: string;
  children: React.ReactNode;
}

/**
 * Nama peserta dan pengingatnya, diisi oleh layout server dari sesinya.
 *
 * Tanpa ini setiap halaman harus mengambil nama sendiri, dan halaman yang
 * lupa menampilkan "Peserta" pada menu profilnya. Pengingat ikut di sini agar
 * angka pada menu dan banner di halaman membaca sumber yang sama.
 *
 * The participant's name and reminders, filled by the server layout from the
 * session.
 *
 * Without it every page would fetch the name itself, and a page that forgot
 * would show "Peserta" in its profile menu. Reminders ride along so the menu
 * count and the in-page banner read the same source.
 */
interface StudentContextValue {
  name: string;
  reminders: StudentReminders;
}

const StudentContext = createContext<StudentContextValue | null>(null);

export function StudentContextProvider({ value, children }: { value: StudentContextValue; children: React.ReactNode }) {
  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudentReminders(): StudentReminders {
  return useContext(StudentContext)?.reminders ?? { surveys: [], exams: [] };
}

function ReminderCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      aria-label={`${count} belum dikerjakan`}
      style={{
        minWidth: '16px', height: '16px', padding: '0 4px', borderRadius: '8px', backgroundColor: 'var(--color-danger)',
        color: '#ffffff', fontSize: '9px', fontWeight: 700, lineHeight: '16px', textAlign: 'center',
      }}
    >
      {count}
    </span>
  );
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
  const context = useContext(StudentContext);
  const reminderCount = (context?.reminders.surveys.length ?? 0) + (context?.reminders.exams.length ?? 0);

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
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.href === '/app/jadwal' && <ReminderCount count={reminderCount} />}
                {item.href === '/app/karier' && (
                  <span style={{ backgroundColor: '#FFD200', color: '#243c4b', fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '999px' }}>Baru</span>
                )}
              </Link>
            );
          })}
        </nav>
        {/* Profil dan tombol keluar hanya ada di ProfileMenu kanan atas; salinan
            kedua di sini menampilkan identitas yang sama dua kali.

            Profile and sign-out live only in the top-right ProfileMenu; a second
            copy here showed the same identity twice. */}
      </aside>

      {/* Kolom konten: berisi topbar desktop (diisi tiap halaman) + children */}
      <div className="student-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        {/* Menu akun diletakkan di shell, bukan pada tiap halaman: lima halaman
            peserta menyusun headernya masing-masing, sehingga menaruhnya di sana
            berarti lima salinan yang harus dijaga tetap sama.

            Posisinya mengambang di sudut kanan atas agar menumpang di atas
            header biru mobile maupun topbar putih desktop -- keduanya saling
            bergantian tampil menurut lebar layar.

            The account menu lives in the shell rather than in each page: five
            participant pages build their own headers, so placing it there would
            mean five copies to keep in step.

            It floats at the top-right so it rides over both the blue mobile
            header and the white desktop topbar -- which alternate by screen
            width. */}
        <div className="student-account" style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 30 }}>
          {/* Varian terang dipakai untuk seluruh halaman. Latar di belakangnya
              berbeda-beda -- header biru, topbar putih, dan header putih pada
              halaman mentoring -- sedangkan pil putih bergaris tetap terbaca di
              atas ketiganya.

              The light variant is used on every page. The backdrop varies --
              blue header, white topbar, and the white header on the mentoring
              page -- while a bordered white pill stays legible over all three. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {context && <NotificationBell reminders={context.reminders} />}
            <ProfileMenu userName={context?.name || userName || 'Peserta'} roleLabel="Peserta" />
          </div>
        </div>
        {children}
      </div>

      {/* Halaman jadwal punya pop-up tagihan wajib sendiri; toast di sana hanya mengulangnya.
          The schedule page has its own mandatory-task pop-up; a toast there only repeats it. */}
      {context && !pathname.startsWith('/app/jadwal') && <ReminderToast reminders={context.reminders} />}

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
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textDecoration: 'none', flex: 1, position: 'relative' }}
            >
              <Icon size={20} color={active ? 'var(--color-primary)' : 'var(--color-text-faint)'} strokeWidth={2} />
              {item.href === '/app/jadwal' && reminderCount > 0 && (
                <span style={{ position: 'absolute', top: '-6px', left: 'calc(50% + 6px)' }}>
                  <ReminderCount count={reminderCount} />
                </span>
              )}
              {/* Lima menu pada layar 360px menyisakan sekitar 66px per tombol.
                  Tanpa penjagaan ini "Mentoring" terpotong di tengah kata;
                  menyusut sedikit lebih terbaca daripada terpenggal.

                  Five items on a 360px screen leave roughly 66px per button.
                  Without this guard "Mentoring" breaks mid-word; shrinking
                  slightly reads better than being cut off. */}
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: active ? 700 : 400,
                  color: active ? 'var(--color-primary)' : 'var(--color-text-faint)',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
