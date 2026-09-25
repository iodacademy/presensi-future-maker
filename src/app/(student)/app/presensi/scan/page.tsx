'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X, Zap, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import QrCamera, { extractToken } from './qr-camera';

// Frame node 11:2933 (Scan QR - Kamera Aktif). Kamera memakai html5-qrcode;
// kolom token manual tetap ada untuk perangkat yang menolak izin kamera.
//
// Frame node 11:2933 (Scan QR - Camera Active). Camera uses html5-qrcode; the
// manual token field remains for devices that deny camera permission.
export default function StudentScanCameraPage() {
  const router = useRouter();
  const [manualToken, setManualToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goToPresensi(token: string) {
    setLoading(true);
    router.push(`/presensi?token=${encodeURIComponent(token)}`);
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = extractToken(manualToken);
    if (!token) {
      setError('Masukkan kode presensi atau tautan QR');
      return;
    }
    setError(null);
    goToPresensi(token);
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#0a0a0f', color: '#ffffff', display: 'flex', flexDirection: 'column' }}>
      {/* Header (node 11:2934) */}
      <div style={{ padding: '24px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/app/jadwal" style={{ color: '#ffffff', display: 'flex' }}>
          <X size={22} strokeWidth={2} />
        </Link>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, margin: 0 }}>Scan QR Hadir</h1>
        <Zap size={20} color="#ffffff" strokeWidth={2} />
      </div>

      {/* Viewport kamera (node 11:2940) / Camera viewport (node 11:2940) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
        <div style={{ position: 'relative' }}>
          <QrCamera onToken={goToPresensi} />
          {/* 4 sudut penanda scan area (node 11:2943-2954) */}
          <div style={{ position: 'absolute', top: -2, left: -2, width: '4px', height: '44px', backgroundColor: 'var(--color-primary)', borderRadius: '4px' }} />
          <div style={{ position: 'absolute', top: -2, left: -2, width: '44px', height: '4px', backgroundColor: 'var(--color-primary)', borderRadius: '4px' }} />
          <div style={{ position: 'absolute', top: -2, right: -2, width: '4px', height: '44px', backgroundColor: 'var(--color-primary)', borderRadius: '4px' }} />
          <div style={{ position: 'absolute', top: -2, right: -2, width: '44px', height: '4px', backgroundColor: 'var(--color-primary)', borderRadius: '4px' }} />
          <div style={{ position: 'absolute', bottom: -2, left: -2, width: '4px', height: '44px', backgroundColor: 'var(--color-primary)', borderRadius: '4px' }} />
          <div style={{ position: 'absolute', bottom: -2, left: -2, width: '44px', height: '4px', backgroundColor: 'var(--color-primary)', borderRadius: '4px' }} />
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: '4px', height: '44px', backgroundColor: 'var(--color-primary)', borderRadius: '4px' }} />
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: '44px', height: '4px', backgroundColor: 'var(--color-primary)', borderRadius: '4px' }} />
        </div>

        <div style={{ textAlign: 'center', maxWidth: '260px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Arahkan kamera ke kode QR</div>
          <div style={{ fontSize: '10px', color: '#9e9ea0', marginTop: '4px' }}>Presensi tercatat otomatis setelah QR terbaca</div>
        </div>
      </div>

      {/* Info rotasi QR + fallback manual (node 11:2959) */}
      <div style={{ padding: '0 20px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px', borderRadius: '12px', backgroundColor: '#1a1a22', marginBottom: '14px' }}>
          <Info size={14} color="var(--color-info)" strokeWidth={2} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span style={{ fontSize: '9px', color: '#d4d4d8' }}>Kamera tidak terbaca? Ketik saja kode 6 karakter yang ditampilkan admin.</span>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', backgroundColor: 'rgba(212, 13, 21, 0.2)', color: '#ff6b6b', borderRadius: '6px', fontSize: '11px', marginBottom: '10px' }}>{error}</div>
        )}

        <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Input
            placeholder="Kode presensi, misal K7M2QX"
            value={manualToken}
            // Kode ditampilkan admin dalam huruf kapital; peserta yang
            // mengetiknya kecil di ponsel akan tetap cocok.
            //
            // The code is shown in capitals; a participant typing it lower
            // case on a phone still matches.
            onChange={(e) => setManualToken(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            style={{ backgroundColor: '#1a1a22', color: '#ffffff', border: '1px solid #333333' }}
          />
          <Button type="submit" variant="primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Memvalidasi...' : 'Verifikasi Kehadiran'}
          </Button>
        </form>
      </div>
    </main>
  );
}
