'use client';

import React, { useState } from 'react';
import { FileText, Presentation, Sheet, File, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MaterialLink } from '@/features/tasks/types';
import type { SessionDocument } from '@/features/attendance/types';

const KIND_ICONS: Record<MaterialLink['kind'], React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  pdf: FileText,
  slide: Presentation,
  sheet: Sheet,
  doc: FileText,
  other: File,
};

interface SessionMaterialsProps {
  session: SessionDocument;
  onChanged: () => void;
}

/**
 * Pengelola bahan praktik sebuah pertemuan.
 *
 * Bahan disimpan sebagai tautan, bukan berkas yang diunggah: pengumpulan tugas
 * pun memakai tautan Drive, dan menambahkan penyimpanan berkas hanya untuk
 * materi akan membuat dua cara berbeda menangani hal yang sama.
 *
 * A meeting's practice material manager.
 *
 * Materials are stored as links rather than uploaded files: submissions already
 * use Drive links, and adding file storage for materials alone would create two
 * different ways of handling the same thing.
 */
export function SessionMaterials({ session, onChanged }: SessionMaterialsProps) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const materials = session.materials ?? [];

  async function handleAdd() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${session.id}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah bahan');
      setLabel('');
      setUrl('');
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(materialId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${session.id}/materials?materialId=${materialId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus bahan');
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {materials.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {materials.map((m) => {
            const Icon = KIND_ICONS[m.kind] ?? File;
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
                  borderRadius: '8px', backgroundColor: 'var(--color-primary-light)',
                }}
              >
                <Icon size={12} color="var(--color-primary)" strokeWidth={2} />
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {m.label}
                </a>
                <button
                  type="button"
                  aria-label={`Hapus bahan ${m.label}`}
                  onClick={() => handleRemove(m.id)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                >
                  <X size={12} color="var(--color-text-muted)" strokeWidth={2} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Instruksi Praktik / Slide Sesi"
          aria-label={`Nama bahan praktik untuk ${session.title}`}
          style={{ flex: '0 1 180px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px' }}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://drive.google.com/..."
          aria-label={`Tautan bahan praktik untuk ${session.title}`}
          style={{ flex: '1 1 200px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px' }}
        />
        <Button
          variant="secondary"
          onClick={handleAdd}
          disabled={busy || !url.trim()}
          style={{ fontSize: '11px', padding: '8px 14px' }}
        >
          {busy ? 'Menyimpan...' : 'Tambah Bahan'}
        </Button>
      </div>

      {error && (
        <div role="alert" style={{ fontSize: '10px', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}
    </div>
  );
}
