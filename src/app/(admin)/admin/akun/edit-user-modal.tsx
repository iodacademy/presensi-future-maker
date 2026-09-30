'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ClassSummary } from '@/features/classes/types';
import type { UserListItem } from '@/features/users/list-service';

interface EditUserModalProps {
  user: UserListItem;
  classes: ClassSummary[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

/**
 * Menyunting nama, surel, dan kelas sebuah akun.
 *
 * Surel adalah satu-satunya cara peserta masuk: tidak ada kata sandi yang
 * dapat dipakai sebagai cadangan. Karena itu perubahannya diperingatkan alih-
 * alih disimpan diam-diam, sebab salah ketik satu huruf mengunci peserta dari
 * akunnya sampai seorang admin memperbaikinya.
 *
 * Edits an account's name, email, and class.
 *
 * The email is the only way a participant signs in: there is no password to
 * fall back on. The change is therefore flagged rather than saved quietly,
 * since one mistyped character locks a participant out of their account until
 * an admin corrects it.
 */
export function EditUserModal({ user, classes, onClose, onSaved }: EditUserModalProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [classId, setClassId] = useState(user.classId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailChanged = email.trim().toLowerCase() !== user.email.trim().toLowerCase();
  const classChanged = user.role === 'student' && (classId || null) !== (user.classId || null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          name,
          email,
          // Kelas hanya dikirim untuk peserta. Mentor terhubung ke kelas lewat
          // mentorIds pada dokumen kelasnya, dan admin tidak terikat kelas.
          //
          // The class is sent for participants only. Mentors are linked through
          // their class's mentorIds, and an admin belongs to no class.
          ...(user.role === 'student' ? { classId: classId || null } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan perubahan');
      onSaved(`Akun ${name.trim()} diperbarui`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const field: React.CSSProperties = {
    width: '100%', padding: '9px 11px', borderRadius: '8px',
    border: '1px solid var(--color-border)', fontSize: '12px',
  };
  const label: React.CSSProperties = {
    fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)',
    display: 'block', marginBottom: '4px',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Ubah akun ${user.name}`}
        style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '420px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}
      >
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)' }}>
            Ubah Akun
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {user.role === 'student' ? 'Peserta' : user.role === 'mentor' ? 'Mentor' : 'Admin'}
          </p>
        </div>

        <div>
          <label style={label} htmlFor="edit-name">NAMA</label>
          <input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus style={field} />
        </div>

        <div>
          <label style={label} htmlFor="edit-email">SUREL</label>
          <input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={field} />
          {emailChanged && (
            <div style={{ fontSize: '10px', color: '#7c2d12', backgroundColor: 'var(--color-warning-light)', padding: '7px 9px', borderRadius: '6px', marginTop: '5px', lineHeight: 1.45 }}>
              Surel adalah satu-satunya cara masuk. Setelah disimpan, <strong>{user.email}</strong> tidak lagi dapat membuka akun ini.
            </div>
          )}
        </div>

        {user.role === 'student' && (
          <div>
            <label style={label} htmlFor="edit-class">KELAS</label>
            <select id="edit-class" value={classId} onChange={(e) => setClassId(e.target.value)} style={field}>
              <option value="">Tanpa kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.canonicalName}</option>
              ))}
            </select>
            {classChanged && (
              <div style={{ fontSize: '10px', color: '#7c2d12', backgroundColor: 'var(--color-warning-light)', padding: '7px 9px', borderRadius: '6px', marginTop: '5px', lineHeight: 1.45 }}>
                Penugasan mentoringnya dilepas, sebab mentornya membimbing kelas lama. Tugaskan ulang di menu Mentoring.
                <br />
                Kehadiran dan pengumpulan yang sudah tercatat tetap pada kelas lamanya.
              </div>
            )}
          </div>
        )}

        {error && (
          <div role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)', padding: '8px 10px', borderRadius: '6px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose} disabled={busy} style={{ fontSize: '11px', padding: '9px 14px' }}>
            Batal
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={busy || !name.trim() || !email.trim()} style={{ fontSize: '11px', padding: '9px 14px' }}>
            {busy ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </div>
    </div>
  );
}
