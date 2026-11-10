'use client';

import React, { useEffect, useState } from 'react';
import { btn, btnSolid, field, label, send } from '../pameran/admin-ui';
import { CATEGORY_LABELS, PLACEHOLDERS, type EmailCategory, type EmailTemplate } from '@/features/email/model';
import { Badge, panel, sub, waktu } from './email-ui';

type Draft = Pick<EmailTemplate, 'name' | 'category' | 'subject' | 'body'>;
const KOSONG: Draft = { name: '', category: 'umum', subject: '', body: '' };

/**
 * Tab Template: daftar template di kiri, formulir sunting di kanan.
 * Kategori menentukan peserta yang tercentang otomatis di tab Kirim.
 *
 * Template tab: template list on the left, edit form on the right.
 * The category decides which participants are pre-checked on the Send tab.
 */
export function TemplatesTab({ templates, onChanged, onError }: { templates: EmailTemplate[]; onChanged: () => void; onError: (m: string | null) => void }) {
  const [id, setId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(KOSONG);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (id === null && templates.length) pilih(templates[0]); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [templates]);

  function pilih(t: EmailTemplate | null) {
    setId(t ? t.id : '');
    setDraft(t ? { name: t.name, category: t.category, subject: t.subject, body: t.body } : KOSONG);
    setSaved(false);
  }

  async function simpan() {
    setBusy(true); onError(null);
    try {
      const r = await send(id ? `/api/email/templates/${id}` : '/api/email/templates', id ? 'PUT' : 'POST', draft);
      setId(r.id); setSaved(true); onChanged();
    } catch (e) { onError((e as Error).message); } finally { setBusy(false); }
  }

  async function hapus() {
    if (!id || !window.confirm(`Hapus template "${draft.name}"? Riwayat email yang sudah terkirim tetap tersimpan.`)) return;
    try { await send(`/api/email/templates/${id}`, 'DELETE', {}); setId(null); onChanged(); } catch (e) { onError((e as Error).message); }
  }

  const ubah = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setDraft({ ...draft, [k]: e.target.value }); setSaved(false); };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(0, 3fr)', gap: '16px', alignItems: 'start' }}>
      <div style={panel}>
        <button type="button" style={btnSolid} onClick={() => pilih(null)}>+ Template baru</button>
        {templates.map((t) => (
          <button key={t.id} type="button" onClick={() => pilih(t)}
            style={{ textAlign: 'left', border: `1px solid ${t.id === id ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: '10px', padding: '10px', backgroundColor: t.id === id ? '#F5F9FE' : '#ffffff', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700 }}>{t.name}</span>
            <Badge category={t.category}>{CATEGORY_LABELS[t.category]}</Badge>
            <span style={sub}>Diubah {waktu(t.updatedAt)}</span>
          </button>
        ))}
      </div>
      <div style={panel}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
          <label style={label}>Nama template<input style={field} value={draft.name} onChange={ubah('name')} /></label>
          <label style={label}>Kategori
            <select style={field} value={draft.category} onChange={ubah('category')}>
              {(Object.keys(CATEGORY_LABELS) as EmailCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </label>
        </div>
        <label style={label}>Subjek<input style={field} value={draft.subject} onChange={ubah('subject')} /></label>
        <label style={label}>Isi email<textarea style={{ ...field, minHeight: '320px', lineHeight: 1.5 }} value={draft.body} onChange={ubah('body')} /></label>
        <div style={{ ...sub, display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
          <span style={{ fontWeight: 700 }}>Isian otomatis:</span>
          {PLACEHOLDERS.map(([k, d]) => <span key={k}><code>{`{${k}}`}</code> {d}</span>)}
        </div>
        <div style={sub}>Kategori menentukan peserta yang otomatis tercentang di tab Kirim. Kategori Umum tidak mencentang siapa pun.</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button type="button" style={btnSolid} disabled={busy} onClick={simpan}>{busy ? 'Menyimpan…' : 'Simpan template'}</button>
          {id && <button type="button" style={{ ...btn, color: '#B42318', borderColor: '#B42318' }} onClick={hapus}>Hapus</button>}
          {saved && <span role="status" style={{ ...sub, color: '#067647' }}>Tersimpan</span>}
        </div>
      </div>
    </div>
  );
}
