'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ChevronDown } from 'lucide-react';

interface ProfileMenuProps {
  userName: string;
  roleLabel: string;
  /** Tampilan pada latar gelap, misalnya header biru peserta / On a dark background, e.g. the blue participant header */
  onDark?: boolean;
}

/**
 * Tombol profil dengan menu keluar.
 *
 * Sebelumnya tombol keluar hanya ada pada sidebar desktop, sedangkan sidebar
 * disembunyikan di layar sempit -- sehingga pengguna ponsel tidak memiliki jalan
 * keluar sama sekali. Komponen ini dipasang pada header, yang tampil di kedua
 * ukuran layar.
 *
 * Profile button with a sign-out menu.
 *
 * The sign-out button previously lived only in the desktop sidebar, and that
 * sidebar is hidden on narrow screens -- leaving phone users with no way out at
 * all. This component sits in the header, which shows at both sizes.
 */
export function ProfileMenu({ userName, roleLabel, onDark = false }: ProfileMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Menu ditutup oleh klik di luar dan oleh Escape. Tanpa keduanya menu
  // menggantung terbuka setelah perhatian berpindah, dan pengguna papan ketik
  // tidak punya cara membatalkannya.
  //
  // The menu closes on an outside click and on Escape. Without both it hangs
  // open after attention moves elsewhere, and keyboard users have no way to
  // dismiss it.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Kegagalan jaringan tidak boleh menahan pengguna di dalam aplikasi;
      // cookie sesi tetap dihapus peramban saat berpindah ke halaman masuk.
      //
      // A network failure must not trap the user inside the app; the browser
      // still drops the session cookie when moving to the sign-in page.
    }
    router.push('/login');
    router.refresh();
  }

  const initial = (userName || '?').charAt(0).toUpperCase();

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu akun ${userName}`}
        className="profile-menu-trigger"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '5px 9px 5px 5px',
          borderRadius: '20px',
          border: onDark ? '1px solid rgba(255,255,255,0.25)' : '1px solid var(--color-border)',
          backgroundColor: onDark ? 'var(--color-header-pill)' : '#ffffff',
          cursor: 'pointer',
        }}
      >
        <span
          aria-hidden
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            backgroundColor: onDark ? '#ffffff' : 'var(--color-primary)',
            color: onDark ? 'var(--color-primary)' : '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initial}
        </span>
        <span
          className="profile-menu-name"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: onDark ? '#ffffff' : 'var(--color-text-main)',
            maxWidth: '110px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {userName}
        </span>
        <ChevronDown
          className="profile-menu-chevron"
          size={13}
          strokeWidth={2}
          color={onDark ? '#ffffff' : 'var(--color-text-muted)'}
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: '190px',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid var(--color-border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            zIndex: 70,
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userName}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{roleLabel}</div>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={busy}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '11px 14px',
              border: 'none',
              background: 'none',
              cursor: busy ? 'wait' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-danger)',
              textAlign: 'left',
            }}
          >
            <LogOut size={14} strokeWidth={2} />
            {busy ? 'Keluar...' : 'Keluar'}
          </button>
        </div>
      )}
    </div>
  );
}
