'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithCustomToken } from 'firebase/auth';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getClientAuth } from '@/lib/firebase/client';

function PresensiContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [successData, setSuccessData] = useState<{ sessionTitle: string; recordedAt: string; source: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Peserta yang memindai QR dari kamera bawaan ponsel tiba di sini tanpa sesi.
  // Meminta mereka masuk lebih dulu lewat halaman lain memutus alurnya justru
  // saat sesi sedang berlangsung, sehingga surel diminta di tempat ini.
  //
  // A participant scanning the QR with their phone's built-in camera arrives
  // here without a session. Sending them to sign in elsewhere first breaks the
  // flow precisely while the session is running, so the address is asked for
  // right here.
  const [needsEmail, setNeedsEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  async function recordAttendance(): Promise<void> {
    const res = await fetch('/api/attendance/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, source: 'camera' }),
    });

    const data = await res.json();

    // 401 berarti belum ada sesi, bukan token yang salah -- token diperiksa
    // hanya setelah pemanggilnya dikenali. 403 berarti sudah masuk tetapi
    // sebagai admin atau mentor, dan mengisi surel tidak akan menolong; galat
    // itu ditampilkan apa adanya.
    //
    // A 401 means there is no session yet, not a bad token -- the token is only
    // checked once the caller is known. A 403 means signed in but as an admin
    // or mentor, where the email form would not help; that error is shown as
    // it is.
    if (res.status === 401) {
      setNeedsEmail(true);
      return;
    }

    if (!res.ok) {
      throw new Error(data.error || 'Presensi gagal dicatat.');
    }

    setSuccessData({
      sessionTitle: data.sessionTitle,
      recordedAt: data.recordedAt,
      source: 'Scan QR',
    });
  }

  useEffect(() => {
    async function processScan() {
      if (!token) {
        setError('Token presensi tidak ditemukan pada link ini.');
        setLoading(false);
        return;
      }

      try {
        await recordAttendance();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    processScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /**
   * Masuk memakai alur yang sama dengan halaman login, lalu langsung mencatat
   * kehadiran.
   *
   * Alur login dipakai apa adanya, bukan endpoint presensi yang menerima surel
   * langsung: surel bukan rahasia, sehingga jalur yang mencatat kehadiran hanya
   * berbekal surel akan memungkinkan siapa pun menitipkan absen atas nama orang
   * lain. Di sini surel tetap ditukar menjadi sesi bertanda tangan lebih dulu.
   *
   * Signs in through the same flow as the login page, then records attendance
   * straight away.
   *
   * The login flow is reused rather than an attendance endpoint that takes an
   * address directly: an address is not a secret, so a path recording
   * attendance from one alone would let anyone mark someone else present. Here
   * the address is still exchanged for a signed session first.
   */
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSigningIn(true);
    setError(null);

    try {
      const tokenRes = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error || 'Email tidak terdaftar atau tidak aktif');

      const credential = await signInWithCustomToken(getClientAuth(), tokenData.customToken);
      const idToken = await credential.user.getIdToken();

      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!sessionRes.ok) throw new Error('Gagal membuat sesi masuk');

      setNeedsEmail(false);
      await recordAttendance();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'var(--color-bg-app)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid var(--color-border)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          padding: '32px 24px',
          textAlign: 'center',
        }}
      >
        {loading ? (
          <div>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Memverifikasi Kehadiran...</h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
              Memvalidasi token rotasi QR dan mencatat data kehadiran Anda...
            </p>
          </div>
        ) : needsEmail ? (
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>
              Konfirmasi Kehadiran
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '8px 0 20px', lineHeight: 1.5 }}>
              Masukkan email terdaftar Anda untuk mencatat kehadiran pada sesi ini.
            </p>

            <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
              <Input
                label="ALAMAT EMAIL"
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />

              {error && (
                <div role="alert" style={{ fontSize: '12px', color: 'var(--color-danger)' }}>
                  {error}
                </div>
              )}

              <Button variant="primary" type="submit" disabled={signingIn} style={{ width: '100%' }}>
                {signingIn ? 'Memproses...' : 'Catat Kehadiran'}
              </Button>
            </form>

            {/* Token QR berganti setiap 30 detik. Peserta yang memakai waktu
                terlalu lama di sini akan ditolak, dan perlu memindai ulang.

                The QR token rotates every 30 seconds. A participant who lingers
                here will be refused and needs to scan the fresh code. */}
            <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '14px' }}>
              Kode QR berganti tiap 30 detik. Bila gagal, pindai ulang kode terbaru di layar.
            </p>
          </div>
        ) : error ? (
          <div>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>❌</div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-danger)' }}>
              Presensi Gagal
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '12px 0 24px', lineHeight: 1.5 }}>
              {error}
            </p>
            <Link href="/app/jadwal" style={{ textDecoration: 'none' }}>
              <Button variant="primary" style={{ width: '100%' }}>
                Kembali ke Jadwal
              </Button>
            </Link>
          </div>
        ) : (
          /* Tampilan Sukses (node 11:3237 Peserta Mobile / Scan QR - Sukses) */
          <div>
            <div
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-success-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={36} color="#ffffff" strokeWidth={2.5} />
              </div>
            </div>

            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700, color: 'var(--color-text-main)' }}>
              Presensi Berhasil
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '24px' }}>
              Kamu tercatat hadir di sesi ini
            </p>

            <div
              style={{
                backgroundColor: '#f8fafb',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                padding: '16px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '24px',
                fontSize: '13px',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>SESI</div>
                <div style={{ fontWeight: 700, color: 'var(--color-text-main)', marginTop: '2px' }}>
                  {successData?.sessionTitle}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>WAKTU HADIR</div>
                <div style={{ fontWeight: 700, color: 'var(--color-text-main)', marginTop: '2px' }}>
                  {successData?.recordedAt ? new Date(successData.recordedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'} WIB
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>METODE</div>
                <div style={{ fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>
                  Scan QR (Kamera HP)
                </div>
              </div>
            </div>

            <Link href="/app/jadwal" style={{ textDecoration: 'none' }}>
              <Button variant="primary" style={{ width: '100%' }}>
                Kembali ke Jadwal
              </Button>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default function PresensiPage() {
  return (
    <Suspense fallback={<div style={{ padding: '48px', textAlign: 'center' }}>Memuat...</div>}>
      <PresensiContent />
    </Suspense>
  );
}
