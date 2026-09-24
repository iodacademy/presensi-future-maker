'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

function PresensiContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [successData, setSuccessData] = useState<{ sessionTitle: string; recordedAt: string; source: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function processScan() {
      if (!token) {
        setError('Token presensi tidak ditemukan pada link ini.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/attendance/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            source: 'camera',
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Presensi gagal dicatat.');
        }

        setSuccessData({
          sessionTitle: data.sessionTitle,
          recordedAt: data.recordedAt,
          source: 'Scan QR',
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    processScan();
  }, [token]);

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
