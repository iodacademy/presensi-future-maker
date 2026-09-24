'use client';

import React, { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Globe, School, FileSpreadsheet, ChevronDown, UserPlus, X } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ClassSummary } from '@/features/classes/types';
import type { ImportPreviewResult } from '@/features/users/import-types';
import type { Role } from '@/features/auth/types';

export default function AdminAkunPage() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [activeMode, setActiveMode] = useState<'global' | 'per-class'>('global');
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isSingleAddOpen, setIsSingleAddOpen] = useState(false);
  const [singleName, setSingleName] = useState('');
  const [singleEmail, setSingleEmail] = useState('');
  const [singleRole, setSingleRole] = useState<Role>('student');
  const [singleClassName, setSingleClassName] = useState('');
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleSubmitting, setSingleSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await fetch('/api/classes');
        if (res.ok) {
          const data = await res.json();
          setClasses(data.classes || []);
          if (data.classes?.length > 0) {
            setSelectedClassId(data.classes[0].canonicalName);
            setSingleClassName(data.classes[0].canonicalName);
          }
        }
      } catch (e) { console.error(e); }
    }
    loadClasses();
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMessage(null);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
        if (rows.length === 0) { setStatusMessage({ type: 'error', text: 'File Excel kosong' }); return; }
        setRawRows(rows);
        await runPreview(rows);
      } catch (err: any) { setStatusMessage({ type: 'error', text: 'Gagal membaca file: ' + err.message }); }
    };
    reader.readAsBinaryString(file);
  }

  async function runPreview(rowsToPreview: any[]) {
    setLoading(true);
    setStatusMessage(null);
    try {
      const forcedClassName = activeMode === 'per-class' ? selectedClassId : undefined;
      const res = await fetch('/api/users/import/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rowsToPreview, forcedClassName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memproses pratinjau');
      setPreview(data);
    } catch (err: any) { setStatusMessage({ type: 'error', text: err.message }); setPreview(null); } finally { setLoading(false); }
  }

  async function handleCommit() {
    if (!preview || !preview.isValid) return;
    setLoading(true);
    setStatusMessage(null);
    try {
      const forcedClassName = activeMode === 'per-class' ? selectedClassId : undefined;
      const res = await fetch('/api/users/import/commit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rawRows, forcedClassName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan akun');
      setStatusMessage({ type: 'success', text: `Berhasil menyimpan ${data.createdCount} akun peserta/mentor!` });
      setPreview(null); setRawRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) { setStatusMessage({ type: 'error', text: err.message }); } finally { setLoading(false); }
  }

  function handleCancel() {
    setPreview(null); setRawRows([]); setStatusMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openSingleAdd() {
    setSingleName('');
    setSingleEmail('');
    setSingleRole('student');
    setSingleClassName(classes[0]?.canonicalName || '');
    setSingleError(null);
    setIsSingleAddOpen(true);
  }

  async function handleSingleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSingleError(null);
    setSingleSubmitting(true);

    // Pakai ulang endpoint import (array 1 baris) -- logika validasi dan
    // penyimpanan (cek email duplikat, cek kelas terdaftar, update counter
    // kelas) sudah lengkap di sana, tidak perlu duplikasi logic.
    //
    // Reuse the import endpoint (1-row array) -- validation and save logic
    // (duplicate email check, registered class check, class counter update)
    // is already complete there, no need to duplicate the logic.
    const row = { nama: singleName, email: singleEmail, role: singleRole, kelas: singleClassName };

    try {
      const previewRes = await fetch('/api/users/import/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [row] }),
      });
      const previewData = await previewRes.json();
      if (!previewRes.ok) throw new Error(previewData.error || 'Gagal memvalidasi data');

      const errors = previewData.rows?.[0]?.errors || [];
      if (errors.length > 0) throw new Error(errors.join('; '));

      const commitRes = await fetch('/api/users/import/commit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [row] }),
      });
      const commitData = await commitRes.json();
      if (!commitRes.ok) throw new Error(commitData.error || 'Gagal menyimpan akun');

      setIsSingleAddOpen(false);
      setStatusMessage({ type: 'success', text: `${singleRole === 'student' ? 'Peserta' : 'Mentor'} "${singleName}" berhasil ditambahkan!` });
    } catch (err: any) {
      setSingleError(err.message);
    } finally {
      setSingleSubmitting(false);
    }
  }

  const labelStyle: React.CSSProperties = { fontSize: '9px', fontWeight: 700, color: 'var(--color-text-faint)' };

  return (
    <AppShell role="admin" userName="Administrator">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>Peserta dan Mentor</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginTop: '2px' }}>Upload akun peserta dan mentor</p>
        </div>
        <button
          type="button"
          onClick={openSingleAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px',
            borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)',
            color: '#ffffff', fontSize: '11px', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
          }}
        >
          <UserPlus size={14} strokeWidth={2} />
          Tambah 1 Peserta/Mentor
        </button>
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx,.xls,.csv" style={{ display: 'none' }} />

      {statusMessage && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, backgroundColor: statusMessage.type === 'success' ? 'var(--color-success-light)' : 'var(--color-danger-light)', color: statusMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {statusMessage.text}
        </div>
      )}

      {/* 2 kotak import (node 10:2578): Global 509px border biru 2px, Per Kelas 507px border abu */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {/* Upload Global */}
        <div style={{ flex: '1 1 400px', backgroundColor: '#ffffff', borderRadius: '14px', border: '2px solid var(--color-primary)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '34px', height: '34px', borderRadius: '9px', backgroundColor: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Globe size={16} color="var(--color-primary)" strokeWidth={2} />
            </span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>Upload Global</div>
              <div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>Satu file untuk seluruh kelas</div>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--color-warning-light)', padding: '10px', borderRadius: '8px', fontSize: '9px', color: '#7c2d12', lineHeight: 1.4 }}>
            Wajib ada kolom &quot;Kelas&quot; dan nilainya harus persis sama dengan nama kelas yang sudah dibuat. Jika ada satu saja tidak cocok, seluruh upload ditolak.
          </div>

          <div
            onClick={() => { setActiveMode('global'); fileInputRef.current?.click(); }}
            style={{ backgroundColor: '#f8fbff', border: '1px solid var(--color-primary)', borderRadius: '8px', padding: '16px', textAlign: 'center', cursor: 'pointer' }}
          >
            <FileSpreadsheet size={22} color="var(--color-primary)" strokeWidth={1.5} style={{ margin: '0 auto 6px' }} />
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-primary)' }}>Tarik file Excel atau tap untuk pilih</div>
            <div style={{ fontSize: '9px', color: 'var(--color-text-faint)', marginTop: '2px' }}>Kolom wajib: Nama, Email, Kelas</div>
          </div>
        </div>

        {/* Upload Per Kelas (node 10:2598): border abu, aksen hijau */}
        <div style={{ flex: '1 1 400px', backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '34px', height: '34px', borderRadius: '9px', backgroundColor: 'var(--color-success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <School size={16} color="var(--color-success)" strokeWidth={2} />
            </span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>Upload Per Kelas</div>
              <div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>Pilih kelas dulu, lalu upload</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={labelStyle}>1. PILIH KELAS</label>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-primary)', fontSize: '10px', outline: 'none', appearance: 'none', boxSizing: 'border-box' }}
              >
                {classes.map((c) => <option key={c.id} value={c.canonicalName}>{c.canonicalName}</option>)}
              </select>
              <ChevronDown size={14} color="var(--color-text-faint)" strokeWidth={2} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={labelStyle}>2. UPLOAD FILE</label>
            <div
              onClick={() => { setActiveMode('per-class'); fileInputRef.current?.click(); }}
              style={{ backgroundColor: 'var(--color-success-light)', border: '1px solid var(--color-success)', borderRadius: '8px', padding: '14px', textAlign: 'center', cursor: 'pointer' }}
            >
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-success)' }}>Tarik file Excel atau tap untuk pilih</div>
              <div style={{ fontSize: '9px', color: 'var(--color-text-faint)', marginTop: '2px' }}>Kolom &quot;Kelas&quot; tidak wajib ada</div>
            </div>
          </div>

          <div style={{ padding: '9px', borderRadius: '8px', backgroundColor: 'var(--color-border)', textAlign: 'center', fontSize: '10px', fontWeight: 600, color: 'var(--color-text-main)' }}>
            3. Lihat Preview
          </div>
        </div>
      </div>

      {/* Preview (node 10:2618) */}
      {preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ height: '1px', backgroundColor: 'var(--color-border)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>Preview Sebelum Simpan</h2>
            {!preview.isValid && <span style={{ color: 'var(--color-danger)', fontSize: '11px', fontWeight: 700 }}>Seluruh upload ditolak karena terdapat kesalahan.</span>}
          </div>

          <div style={{ display: 'flex', padding: '10px', borderRadius: '8px', backgroundColor: 'var(--color-border)', fontSize: '9px', fontWeight: 700, color: 'var(--color-text-main)' }}>
            <span style={{ width: '25%' }}>NAMA</span>
            <span style={{ width: '30%' }}>EMAIL</span>
            <span style={{ width: '15%' }}>KELAS</span>
            <span style={{ flex: 1 }}>STATUS</span>
          </div>

          {preview.rows.map((row) => {
            const isValid = row.status === 'VALID';
            return (
              <div
                key={row.rowNumber}
                style={{ display: 'flex', alignItems: 'center', padding: '11px 12px', borderRadius: '8px', backgroundColor: isValid ? '#ffffff' : '#fff8f5', border: `1px solid ${isValid ? 'var(--color-border)' : 'var(--color-warning)'}` }}
              >
                <span style={{ width: '25%', fontSize: '10px', color: 'var(--color-text-main)' }}>{row.name}</span>
                <span style={{ width: '30%', fontSize: '10px', color: 'var(--color-text-muted)' }}>{row.email}</span>
                <span style={{ width: '15%', fontSize: '10px', color: isValid ? 'var(--color-text-main)' : 'var(--color-warning)' }}>{row.className || '-'}</span>
                <span style={{ flex: 1 }}>
                  {isValid ? (
                    <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '8px', fontWeight: 700, backgroundColor: 'var(--color-success)', color: '#ffffff' }}>VALID</span>
                  ) : (
                    <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '8px', fontWeight: 700, backgroundColor: 'var(--color-warning)', color: '#ffffff' }}>DITOLAK</span>
                  )}
                </span>
              </div>
            );
          })}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={handleCancel} disabled={loading} style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-border)', color: 'var(--color-text-main)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Batal</button>
            <button type="button" onClick={handleCommit} disabled={loading || !preview.isValid} style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '11px', fontWeight: 700, cursor: 'pointer', opacity: !preview.isValid ? 0.5 : 1 }}>
              {loading ? 'Menyimpan...' : 'Simpan Akun Valid'}
            </button>
          </div>
        </div>
      )}

      {/* Modal Tambah 1 Peserta/Mentor manual */}
      {isSingleAddOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '420px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)' }}>Tambah 1 Peserta/Mentor</h2>
              <button type="button" onClick={() => setIsSingleAddOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={18} color="var(--color-text-faint)" strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSingleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Input label="NAMA LENGKAP" placeholder="Contoh: Budi Santoso" value={singleName} onChange={(e) => setSingleName(e.target.value)} required />
              <Input label="EMAIL" type="email" placeholder="nama@email.com" value={singleEmail} onChange={(e) => setSingleEmail(e.target.value)} required />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-faint)' }}>PERAN</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['student', 'mentor'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSingleRole(r)}
                      style={{
                        flex: 1, padding: '9px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                        fontSize: '11px', fontWeight: singleRole === r ? 700 : 400,
                        backgroundColor: singleRole === r ? 'var(--color-primary)' : 'var(--color-border)',
                        color: singleRole === r ? '#ffffff' : 'var(--color-text-main)',
                      }}
                    >
                      {r === 'student' ? 'Peserta' : 'Mentor'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-faint)' }}>
                  KELAS {singleRole === 'mentor' && '(kelas yang ditangani)'}
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={singleClassName}
                    onChange={(e) => setSingleClassName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-primary)', fontSize: '11px', outline: 'none', appearance: 'none', boxSizing: 'border-box' }}
                  >
                    {classes.length === 0 && <option value="">Belum ada kelas terdaftar</option>}
                    {classes.map((c) => <option key={c.id} value={c.canonicalName}>{c.canonicalName}</option>)}
                  </select>
                  <ChevronDown size={14} color="var(--color-text-faint)" strokeWidth={2} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </div>

              {singleError && (
                <div style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '8px 12px', borderRadius: '6px', fontSize: '11px' }}>
                  {singleError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <Button type="button" variant="secondary" onClick={() => setIsSingleAddOpen(false)} disabled={singleSubmitting} style={{ flex: 1 }}>Batal</Button>
                <Button type="submit" variant="primary" disabled={singleSubmitting || classes.length === 0} style={{ flex: 1 }}>
                  {singleSubmitting ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
