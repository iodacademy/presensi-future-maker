'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase/client';
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
      // 1. Minta custom token dari backend / Request custom token from backend
      const tokenRes = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!tokenRes.ok) {
        const data = await tokenRes.json();
        throw new Error(data.error || 'Email tidak terdaftar atau tidak aktif');
      }

      const { customToken, role } = (await tokenRes.json()) as {
        customToken: string;
        role: Role;
      };

      // 2. Sign in dengan Firebase Client SDK untuk mendapatkan ID token
      // Sign in with Firebase Client SDK to retrieve ID token
      const auth = getClientAuth();
      const userCredential = await signInWithCustomToken(auth, customToken);
      const idToken = await userCredential.user.getIdToken();

      // 3. Tukar ID token menjadi session cookie HttpOnly di backend
      // Exchange ID token for HttpOnly session cookie on backend
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!sessionRes.ok) {
        throw new Error('Gagal membuat sesi masuk');
      }

      // 4. Arahkan ke beranda sesuai peran / Redirect to role destination
      const destination = getRoleRedirectPath(role);
      router.push(destination);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat masuk');
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
