'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FileCheck2, Upload } from 'lucide-react';

type Doc = { id: string; fileName: string; uploadedAt: string };

const when = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });

/**
 * Unggah letter of acceptance atau kontrak magang. Wajib bagi peserta yang
 * sudah ditempatkan; kotaknya tetap berwarna peringatan sampai dokumen ada.
 *
 * Upload of the internship letter of acceptance or contract. Required for
 * placed participants; the box stays in a warning colour until a document exists.
 */
export function AcceptanceUpload() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/karier/cv').then((r) => r.json()).then((d) => setDocs(d.acceptance ?? [])).catch(() => setDocs([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function upload() {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'penerimaan');
      const r = await fetch('/api/karier/cv', { method: 'POST', body: form });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Gagal mengunggah');
      setFile(null);
      load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (!docs) return null;
  const latest = docs[0];
  const done = !!latest;
  return (
    <section aria-label="Dokumen penerimaan" style={{ borderRadius: '14px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: done ? '#ECFDF3' : '#FFFAEB', border: `1px solid ${done ? '#ABEFC6' : '#FEC84B'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: done ? '#067647' : '#93370D' }}>
        <FileCheck2 size={16} aria-hidden />
        {done ? 'Dokumen penerimaan sudah diunggah' : 'Wajib unggah letter of acceptance atau kontrak magang'}
      </div>
      {done ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '12px' }}>
          <b>{latest.fileName}</b>
          <span style={{ color: 'var(--color-text-muted)' }}>{when(latest.uploadedAt)}</span>
          <a href={`/api/karier/cv/${latest.id}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>Lihat</a>
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: '#93370D' }}>Unggah dokumen dari mitra tempat kamu magang, format PDF maksimal 2 MB.</div>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="file" accept="application/pdf,.pdf" aria-label="Pilih dokumen penerimaan (PDF)" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: '12px', maxWidth: '100%' }} />
        <button type="button" disabled={!file || busy} onClick={upload}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', minHeight: '40px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '12px', fontWeight: 700, cursor: !file || busy ? 'not-allowed' : 'pointer', opacity: !file || busy ? 0.6 : 1 }}>
          <Upload size={14} aria-hidden /> {busy ? 'Mengunggah…' : done ? 'Ganti dokumen' : 'Unggah dokumen'}
        </button>
      </div>
      {error && <div role="alert" style={{ fontSize: '12px', color: '#B42318' }}>{error}</div>}
    </section>
  );
}
