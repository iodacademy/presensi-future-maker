'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './button';

export interface DeletionImpact {
  label: string;
  cascade: { collection: string; count: number; destroysWork: boolean }[];
}

interface DeleteDialogProps {
  /** Endpoint yang melayani ringkasan dampak (GET) dan penghapusan (DELETE) */
  endpoint: string;
  /** Query tambahan bila ringkasan dilayani endpoint yang sama, misal '?impact=1' */
  impactQuery?: string;
  entityLabel: string;
  onClose: () => void;
  onDeleted: () => void;
}

/**
 * Dialog konfirmasi penghapusan.
 *
 * Menampilkan lebih dulu berapa banyak data yang ikut terhapus, lalu meminta
 * admin mengetik ulang nama entitasnya. Penghapusan ini memusnahkan hasil kerja
 * peserta yang tidak punya salinan lain, dan satu klik keliru tidak dapat
 * dibatalkan -- mengetik ulang memaksa mata membaca apa yang sedang dihapus.
 *
 * Deletion confirmation dialog.
 *
 * Shows how much data goes with it first, then asks the admin to retype the
 * entity's name. These deletions destroy participant work that has no other
 * copy, and one wrong click cannot be undone -- retyping forces the eye to read
 * what is being deleted.
 */
export function DeleteDialog({ endpoint, impactQuery = '', entityLabel, onClose, onDeleted }: DeleteDialogProps) {
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${endpoint}${impactQuery}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Gagal memuat ringkasan dampak'))))
      .then((d) => !cancelled && setImpact(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [endpoint, impactQuery]);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  const label = impact?.label ?? entityLabel;
  const confirmed = typed.trim() === label.trim();
  const destructive = impact?.cascade.filter((c) => c.destroysWork && c.count > 0) ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '440px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '14px' }}>
          <AlertTriangle size={20} color="var(--color-danger)" strokeWidth={2} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <h2 id="delete-dialog-title" style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-text-main)' }}>
              Hapus {label}?
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
              Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
        </div>

        {!impact && !error && (
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Memeriksa data yang akan ikut terhapus...</p>
        )}

        {impact && (
          <>
            {destructive.length > 0 && (
              <div style={{ backgroundColor: 'var(--color-danger-light)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-danger)', margin: '0 0 6px' }}>
                  Hasil kerja peserta ikut terhapus
                </p>
                {destructive.map((c) => (
                  <div key={c.collection} style={{ fontSize: '11px', color: 'var(--color-text-main)' }}>
                    {c.count} {c.collection.toLowerCase()}
                  </div>
                ))}
              </div>
            )}

            {impact.cascade.filter((c) => !c.destroysWork && c.count > 0).length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', margin: '0 0 4px' }}>
                  Ikut terhapus
                </p>
                {impact.cascade
                  .filter((c) => !c.destroysWork && c.count > 0)
                  .map((c) => (
                    <div key={c.collection} style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {c.count} {c.collection.toLowerCase()}
                    </div>
                  ))}
              </div>
            )}

            {impact.cascade.every((c) => c.count === 0) && (
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                Belum ada data lain yang terkait.
              </p>
            )}

            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '6px' }}>
              Ketik <strong>{label}</strong> untuk mengonfirmasi
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                fontSize: '12px',
                marginBottom: '14px',
              }}
            />
          </>
        )}

        {error && (
          <p role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)', marginBottom: '12px' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            Batal
          </Button>
          <Button
            variant="primary"
            onClick={handleDelete}
            disabled={!confirmed || deleting || !impact}
            style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
          >
            {deleting ? 'Menghapus...' : 'Hapus permanen'}
          </Button>
        </div>
      </div>
    </div>
  );
}
