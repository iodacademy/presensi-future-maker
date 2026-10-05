'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getRoleRedirectPath } from '@/features/auth/paths';
import type { Role } from '@/features/auth/types';

// Halaman Masuk Aplikasi (Email-Only) / Application Login Page (Email-Only)
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Satu permintaan: server menukar email menjadi sesi seluruhnya. Peramban
      // tidak lagi menghubungi server Google, sehingga jaringan yang
      // memblokirnya tidak dapat menggagalkan login.
      //
      // One request: the server turns the email into a session entirely. The
      // browser no longer contacts Google's servers, so a network blocking them
      // cannot fail the login.
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { role?: Role; error?: string };
      if (!res.ok || !data.role) {
        throw new Error(data.error || 'Email tidak terdaftar atau tidak aktif');
      }
      const role = data.role;

      // 4. Arahkan ke beranda sesuai peran / Redirect to role destination
      const destination = getRoleRedirectPath(role);
      router.push(destination);
      router.refresh();
    } catch (err) {
      setError(pesanGagal(err));
    } finally {
      setLoading(false);
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
          maxWidth: '420px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid var(--color-border)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          padding: '32px',
        }}
      >
        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
            <Image src="/logos/plan-international.png" alt="Plan International" width={100} height={72} style={{ objectFit: 'contain', height: '48px', width: 'auto' }} priority />
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '8px' }}>
            Future Innovators Bootcamp
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            Masukkan email terdaftar Anda untuk masuk ke sistem
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Input
            type="email"
            label="Alamat Email"
            placeholder="nama@email.com (email terdaftar)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />

          {error && (
            <div
              style={{
                backgroundColor: 'var(--color-danger-light)',
                color: 'var(--color-danger)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                lineHeight: 1.4,
              }}
            >
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Memproses...' : 'Masuk ke Aplikasi'}
          </Button>
        </form>
      </div>
    </main>
  );
}

/**
 * Pesan untuk kegagalan yang terjadi sebelum server sempat menjawab.
 *
 * fetch melempar TypeError ("Failed to fetch") saat koneksi peserta sendiri
 * putus. Menampilkannya apa adanya tidak memberi tahu peserta apa yang harus
 * dilakukan.
 *
 * The message for a failure that happens before the server could answer.
 *
 * fetch throws a TypeError ("Failed to fetch") when the participant's own
 * connection drops. Showing it verbatim tells them nothing about what to do.
 */
function pesanGagal(err: unknown): string {
  if (err instanceof TypeError) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda, lalu coba lagi.';
  }
  return (err as Error)?.message || 'Terjadi kesalahan saat masuk';
}
