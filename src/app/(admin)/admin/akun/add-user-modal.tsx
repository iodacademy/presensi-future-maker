'use client';

import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { X, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ClassSummary } from '@/features/classes/types';
import type { ImportPreviewResult } from '@/features/users/import-types';
import type { Role } from '@/features/auth/types';

interface AddUserModalProps {
  classes: ClassSummary[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

type Step = 'role' | 'method' | 'single' | 'bulk';
/**
 * Peran yang dapat dibuat dari layar ini.
 *
 * Admin termasuk: tanpa itu, admin baru hanya dapat dibuat lewat skrip
 * bootstrap di mesin pengembang, dan satu-satunya admin yang kehilangan
 * aksesnya tidak punya jalan kembali.
 *
 * Roles that can be created from this screen.
 *
 * Admin is included: without it a new admin can only be made through the
 * bootstrap script on a developer machine, and the only admin who loses access
 * has no way back.
 */
type AddableRole = Role;

const labelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: 'var(--color-text-faint)' };

/**
 * Dialog tambah akun.
 *
 * Seluruh penyimpanan melewati endpoint impor yang sudah ada, termasuk untuk
 * satu akun yang dikirim sebagai larik berisi satu baris. Pemeriksaan surel
 * ganda, pencocokan kelas, dan pembaruan penghitung kelas sudah lengkap di
 * sana; menulis ulang jalurnya akan membuat dua aturan yang harus dijaga tetap
 * sama.
 *
 * Add account dialog.
 *
 * Every save goes through the existing import endpoints, including a single
 * account sent as a one-row array. Duplicate-address checks, class matching,
 * and class counter updates are already complete there; rewriting that path
 * would create two sets of rules to keep in step.
 */
export function AddUserModal({ classes, onClose, onSuccess }: AddUserModalProps) {
  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<AddableRole>('student');
  const [className, setClassName] = useState(classes[0]?.canonicalName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function chooseRole(next: AddableRole) {
    setRole(next);
    setError(null);
    setStep('method');
  }

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const row = { nama: name, email, role, kelas: className };

    try {
      const previewRes = await fetch('/api/users/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [row] }),
      });
      const previewData = await previewRes.json();
      if (!previewRes.ok) throw new Error(previewData.error || 'Gagal memvalidasi data');

      const rowErrors: string[] = previewData.rows?.[0]?.errors ?? [];
      if (rowErrors.length > 0) throw new Error(rowErrors.join('; '));

      const commitRes = await fetch('/api/users/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [row] }),
      });
      const commitData = await commitRes.json();
      if (!commitRes.ok) throw new Error(commitData.error || 'Gagal menyimpan akun');

      onSuccess(`${roleLabel} "${name}" berhasil ditambahkan`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const workbook = XLSX.read(evt.target?.result, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

        if (rows.length === 0) {
          setError('Berkas Excel tidak memuat baris apa pun');
          return;
        }

        // Peran dan kelas diambil dari pilihan pada dialog, bukan dari isi
        // berkas: berkas yang disusun orang lain kerap memuat kolom peran yang
        // salah eja atau kosong, dan admin sudah menyatakan keduanya di sini.
        //
        // Role and class come from the dialog's selections rather than the
        // file's contents: a file assembled by someone else often carries a
        // misspelt or empty role column, and the admin has already stated both
        // here.
        const withRole = rows.map((r) => ({ ...r, role, kelas: className }));
        setRawRows(withRole);

        const res = await fetch('/api/users/import/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: withRole }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memproses pratinjau');
        setPreview(data);
      } catch (err) {
        setError('Gagal membaca berkas: ' + (err as Error).message);
      }
    };
    reader.readAsBinaryString(file);
  }

  async function handleBulkCommit() {
    if (!preview?.isValid) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/users/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rawRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan akun');
      onSuccess(`${data.createdCount} akun berhasil ditambahkan`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  const roleLabel = role === 'student' ? 'Peserta' : role === 'mentor' ? 'Mentor' : 'Admin';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-user-title"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 60,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px',
          width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h2 id="add-user-title" style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-text-main)' }}>
            {step === 'role' ? 'Tambah Akun' : `Tambah ${roleLabel}`}
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={16} color="var(--color-text-muted)" strokeWidth={2} />
          </button>
        </div>

        {step === 'role' && (
          <>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '0 0 14px' }}>
              Pilih peran akun yang akan ditambahkan.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {([['student', 'Peserta', 'Mengikuti kelas, mengumpulkan tugas, dan presensi'],
                 ['mentor', 'Mentor', 'Membimbing peserta dan mengisi slot mentoring'],
                 ['admin', 'Admin', 'Mengelola seluruh kelas, akun, nilai, dan pengaturan']] as const).map(([value, title, desc]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => chooseRole(value)}
                  style={{
                    textAlign: 'left', padding: '14px', borderRadius: '10px',
                    border: `1px solid ${value === 'admin' ? 'var(--color-warning)' : 'var(--color-border)'}`,
                    backgroundColor: '#ffffff', cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)' }}>{title}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{desc}</div>
                </button>
              ))}
            </div>

            {/* Admin yang dibuat di sini memegang kuasa yang sama dengan yang
                membuatnya, termasuk membuat admin berikutnya dan menonaktifkan
                akun siapa pun. Menyebutkannya di muka lebih baik daripada
                membiarkannya ditemukan belakangan.

                An admin created here holds the same powers as whoever created
                them, including making further admins and deactivating anyone's
                account. Saying so up front beats leaving it to be discovered
                later. */}
            <p style={{ fontSize: '10px', color: '#7c2d12', backgroundColor: 'var(--color-warning-light)', padding: '9px 11px', borderRadius: '8px', margin: '14px 0 0', lineHeight: 1.55 }}>
              Admin memegang kuasa penuh: mengelola seluruh kelas dan nilai, menambah admin lain, serta
              menonaktifkan akun siapa pun. Berikan hanya kepada orang yang memang menjalankan program ini.
            </p>
          </>
        )}

        {step === 'method' && (
          <>
            {/* Admin tidak terikat kelas mana pun, sehingga pemilihnya
                disembunyikan. Dibiarkan, tombol lanjutnya mati menunggu kelas
                yang tidak pernah relevan baginya.

                An admin belongs to no class, so the picker is hidden. Left in
                place, the continue button stays dead waiting for a class that
                never applies to them. */}
            {role !== 'admin' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>KELAS</label>
                <select
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  style={{
                    width: '100%', padding: '10px', borderRadius: '8px', marginTop: '6px',
                    border: '1px solid var(--color-border)', fontSize: '12px',
                  }}
                >
                  {classes.length === 0 && <option value="">Belum ada kelas</option>}
                  {classes.map((c) => (
                    <option key={c.id} value={c.canonicalName}>{c.canonicalName}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setStep('single')}
                disabled={role !== 'admin' && !className}
                style={{
                  textAlign: 'left', padding: '14px', borderRadius: '10px', cursor: role === 'admin' || className ? 'pointer' : 'not-allowed',
                  border: '1px solid var(--color-border)', backgroundColor: '#ffffff', opacity: role === 'admin' || className ? 1 : 0.5,
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)' }}>Satu akun</div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Ketik nama dan surel langsung</div>
              </button>
              <button
                type="button"
                onClick={() => setStep('bulk')}
                disabled={role !== 'admin' && !className}
                style={{
                  textAlign: 'left', padding: '14px', borderRadius: '10px', cursor: role === 'admin' || className ? 'pointer' : 'not-allowed',
                  border: '1px solid var(--color-border)', backgroundColor: '#ffffff', opacity: role === 'admin' || className ? 1 : 0.5,
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)' }}>Impor Excel</div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Unggah berkas berisi kolom Nama dan Email</div>
              </button>
            </div>

            <Button variant="secondary" onClick={() => setStep('role')} style={{ marginTop: '16px', fontSize: '11px' }}>
              Kembali
            </Button>
          </>
        )}

        {step === 'single' && (
          <form onSubmit={handleSingleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {roleLabel} pada kelas <strong>{className}</strong>
            </div>
            <Input label="NAMA LENGKAP" placeholder="Contoh: Budi Santoso" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="EMAIL" type="email" placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />

            {error && <div role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => { setStep('method'); setError(null); }} disabled={submitting}>
                Kembali
              </Button>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        )}

        {step === 'bulk' && (
          <>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
              {roleLabel} pada kelas <strong>{className}</strong>. Kolom peran dan kelas pada berkas diabaikan;
              keduanya mengikuti pilihan di atas.
            </div>

            <label
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                padding: '28px', borderRadius: '10px', border: '1px dashed var(--color-border)', cursor: 'pointer',
              }}
            >
              <FileSpreadsheet size={22} color="var(--color-primary)" strokeWidth={2} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)' }}>Pilih berkas Excel</span>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Kolom yang dibaca: Nama, Email</span>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: 'none' }} />
            </label>

            {preview && (
              <div style={{ marginTop: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '6px' }}>
                  {preview.validCount} baris sah, {preview.invalidCount} ditolak
                </div>
                <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                  {preview.rows.map((r) => (
                    <div
                      key={r.rowNumber}
                      style={{
                        padding: '8px 10px', borderBottom: '1px solid var(--color-border)', fontSize: '10px',
                        backgroundColor: r.status === 'VALID' ? '#ffffff' : 'var(--color-danger-light)',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{r.name || '(tanpa nama)'}</div>
                      <div style={{ color: 'var(--color-text-muted)' }}>{r.email}</div>
                      {r.errors.length > 0 && (
                        <div style={{ color: 'var(--color-danger)', marginTop: '2px' }}>{r.errors.join('; ')}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <div role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)', marginTop: '10px' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <Button variant="secondary" onClick={() => { setStep('method'); setPreview(null); setError(null); }} disabled={submitting}>
                Kembali
              </Button>
              <Button variant="primary" onClick={handleBulkCommit} disabled={!preview?.isValid || submitting}>
                {submitting ? 'Menyimpan...' : `Simpan ${preview?.validCount ?? 0} akun`}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
