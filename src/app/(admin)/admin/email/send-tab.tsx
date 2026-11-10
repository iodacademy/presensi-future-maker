'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { btn, btnSolid, field, label, send } from '../pameran/admin-ui';
import { CATEGORY_LABELS, emailHtml, renderTemplate, templateVars, type EmailCategory, type EmailTemplate } from '@/features/email/model';
import type { Recipient, SendResult } from '@/features/email/service';
import { Badge, panel, sub, td, th, waktu } from './email-ui';

const SEMUA = 'semua';

/**
 * Tab Kirim: pilih kelas dan template; peserta yang statusnya cocok dengan
 * kategori template langsung tercentang, kecuali yang sudah pernah menerimanya.
 *
 * Send tab: pick a class and a template; participants whose status matches the
 * template category are pre-checked, except those who already received it.
 */
export function SendTab({ recipients, templates, onSent, onError }: {
  recipients: Recipient[] | null; templates: EmailTemplate[]; onSent: () => void; onError: (m: string | null) => void;
}) {
  const kelas = useMemo(() => [...new Set((recipients ?? []).map((r) => r.className))].sort(), [recipients]);
  const [className, setClassName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [filter, setFilter] = useState<EmailCategory | typeof SEMUA>(SEMUA);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [resend, setResend] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [ujiKe, setUjiKe] = useState('');
  const [ujiInfo, setUjiInfo] = useState<string | null>(null);

  useEffect(() => { if (!className && kelas.length) setClassName(kelas[0]); }, [kelas, className]);
  useEffect(() => { if (!templateId && templates.length) setTemplateId(templates[0].id); }, [templates, templateId]);

  const template = templates.find((t) => t.id === templateId) ?? null;
  const dalamKelas = useMemo(() => (recipients ?? []).filter((r) => r.className === className), [recipients, className]);
  const tampil = dalamKelas.filter((r) => filter === SEMUA || r.category === filter);
  const cocok = (r: Recipient) => !!template && r.category === template.category && !r.sent[template.id];

  // Pilihan awal mengikuti kategori template setiap kali kelas atau template berganti
  // The default selection follows the template category whenever the class or template changes
  useEffect(() => {
    setChecked(new Set(dalamKelas.filter(cocok).map((r) => r.studentId)));
    setPreview(null);
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [className, templateId, recipients]);

  const toggle = (id: string) => setChecked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const terpilih = dalamKelas.filter((r) => checked.has(r.studentId));
  const sudahTerima = template ? terpilih.filter((r) => r.sent[template.id]).length : 0;
  const lihat = dalamKelas.find((r) => r.studentId === (preview ?? terpilih[0]?.studentId)) ?? null;

  async function kirim() {
    if (!template || terpilih.length === 0) return;
    const akanDikirim = resend ? terpilih.length : terpilih.length - sudahTerima;
    if (!window.confirm(`Kirim "${template.name}" ke ${akanDikirim} peserta ${className}?`)) return;
    setBusy(true); onError(null); setResult(null);
    try {
      const r: SendResult = await send('/api/email/send', 'POST', { templateId: template.id, studentIds: terpilih.map((x) => x.studentId), resend });
      setResult(`${r.sent} terkirim, ${r.failed} gagal, ${r.skipped} dilewati karena sudah menerima template ini.${r.quota !== null ? ` Sisa kuota email hari ini: ${r.quota}.` : ''}`);
      onSent();
    } catch (e) { onError((e as Error).message); } finally { setBusy(false); }
  }

  async function kirimUji() {
    if (!template || !lihat) return;
    setBusy(true); onError(null); setUjiInfo(null);
    try {
      const r = await send('/api/email/test', 'POST', { templateId: template.id, studentId: lihat.studentId, to: ujiKe });
      setUjiInfo(`Email uji terkirim ke ${ujiKe}.${r.quota !== null ? ` Sisa kuota hari ini: ${r.quota}.` : ''}`);
    } catch (e) { onError((e as Error).message); } finally { setBusy(false); }
  }

  if (!recipients) return <div style={sub}>Memuat peserta…</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(280px, 2fr)', gap: '16px', alignItems: 'start' }}>
      <div style={panel}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
          <label style={label}>Kelas
            <select style={field} value={className} onChange={(e) => setClassName(e.target.value)}>
              {kelas.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label style={label}>Template
            <select style={field} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label style={label}>Tampilkan status
            <select style={field} value={filter} onChange={(e) => setFilter(e.target.value as EmailCategory | typeof SEMUA)}>
              <option value={SEMUA}>Semua status</option>
              {(['lulus-magang', 'lulus-tanpa-magang', 'tidak-lulus'] as const).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" style={btn} onClick={() => setChecked(new Set(dalamKelas.map((r) => r.studentId)))}>Pilih semua di kelas</button>
          <button type="button" style={btn} onClick={() => setChecked(new Set(dalamKelas.filter(cocok).map((r) => r.studentId)))}>Pilih sesuai template</button>
          <button type="button" style={btn} onClick={() => setChecked(new Set())}>Kosongkan</button>
          <span style={sub}>{terpilih.length} dari {dalamKelas.length} peserta dipilih</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th} aria-label="Pilih" />
              <th style={th}>Peserta</th><th style={th}>Status</th><th style={th}>SPA</th><th style={th}>Alasan</th><th style={th}>Template ini</th><th style={th} aria-label="Pratinjau" />
            </tr></thead>
            <tbody>
              {tampil.map((r) => (
                <tr key={r.studentId} style={{ backgroundColor: checked.has(r.studentId) ? '#F5F9FE' : undefined }}>
                  <td style={td}><input type="checkbox" checked={checked.has(r.studentId)} onChange={() => toggle(r.studentId)} aria-label={`Pilih ${r.studentName}`} /></td>
                  <td style={td}><div style={{ fontWeight: 600 }}>{r.studentName}</div><div style={sub}>{r.email || 'tidak ada email'}</div></td>
                  <td style={td}><Badge category={r.category}>{r.label}</Badge></td>
                  <td style={td}>{r.score}</td>
                  <td style={{ ...td, maxWidth: '220px' }}><span style={sub}>{r.placementReasons.join(' · ') || '-'}</span></td>
                  <td style={td}>{template && r.sent[template.id] ? <span style={{ ...sub, color: '#067647', fontWeight: 600 }}>Terkirim {waktu(r.sent[template.id])}</span> : <span style={sub}>Belum</span>}</td>
                  <td style={td}><button type="button" style={{ ...btn, padding: '4px 8px' }} onClick={() => setPreview(r.studentId)}>Pratinjau</button></td>
                </tr>
              ))}
              {tampil.length === 0 && <tr><td style={td} colSpan={7}><span style={sub}>Tidak ada peserta dengan status ini.</span></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ ...panel, position: 'sticky', top: '12px' }}>
        <div style={{ fontWeight: 700, fontSize: '12px' }}>Pratinjau</div>
        {template && lihat ? (
          <>
            <div style={sub}>Untuk {lihat.studentName} · {lihat.email}</div>
            <div style={{ fontSize: '12px', fontWeight: 700 }}>{renderTemplate(template.subject, templateVars(lihat))}</div>
            <iframe title="Pratinjau email" sandbox="" srcDoc={emailHtml(renderTemplate(template.body, templateVars(lihat)))}
              style={{ width: '100%', height: '420px', border: '1px solid var(--color-border)', borderRadius: '8px', backgroundColor: '#F2F5F9' }} />
            <div style={{ display: 'flex', gap: '6px' }}>
              <input style={field} type="email" value={ujiKe} onChange={(e) => setUjiKe(e.target.value)} placeholder="Email untuk uji" aria-label="Email untuk uji" />
              <button type="button" style={{ ...btn, whiteSpace: 'nowrap' }} disabled={busy || !ujiKe.trim()} onClick={kirimUji}>Kirim uji</button>
            </div>
            <div style={sub}>Kirim uji memakai data {lihat.studentName}, subjeknya diberi [UJI], dan tidak tercatat sebagai terkirim.</div>
            {ujiInfo && <div role="status" style={{ ...sub, color: '#067647' }}>{ujiInfo}</div>}
            {lihat.category !== template.category && template.category !== 'umum' && (
              <div style={{ ...sub, color: '#B42318' }}>Status peserta ini ({lihat.label}) tidak sesuai kategori template ({CATEGORY_LABELS[template.category]}).</div>
            )}
          </>
        ) : <div style={sub}>Pilih peserta untuk melihat pratinjau.</div>}
        <label style={{ ...sub, display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input type="checkbox" checked={resend} onChange={(e) => setResend(e.target.checked)} />
          Kirim ulang juga ke peserta yang sudah menerima template ini ({sudahTerima})
        </label>
        <button type="button" style={{ ...btnSolid, padding: '10px' }} disabled={busy || !template || terpilih.length === 0} onClick={kirim}>
          {busy ? 'Mengirim…' : `Kirim ke ${resend ? terpilih.length : terpilih.length - sudahTerima} peserta`}
        </button>
        {result && <div role="status" style={{ fontSize: '11px', color: '#067647', backgroundColor: '#E6F4EA', borderRadius: '8px', padding: '8px 10px' }}>{result}</div>}
        <div style={sub}>Batas kirim Apps Script: 1.500 email per hari (akun Google Workspace).</div>
      </div>
    </div>
  );
}
