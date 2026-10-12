'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ClassSummary } from '@/features/classes/types';
import type { UserListItem } from '@/features/users/list-service';
import {
  DISABILITY_LABELS,
  ENTRY_STATUS_LABELS,
  GENDER_LABELS,
  type Disability,
  type EntryStatus,
  type Gender,
  type ProfileInput,
} from '@/features/users/profile-types';

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
  const [isTest, setIsTest] = useState(user.isTest);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profil hanya untuk peserta. undefined berarti masih dimuat, null berarti
  // peserta belum mengisinya.
  // A profile is for participants only. undefined means still loading, null
  // means the participant has not filled it in.
  const [savedProfile, setSavedProfile] = useState<ProfileInput | null | undefined>(user.role === 'student' ? undefined : null);
  const [profile, setProfile] = useState<ProfileInput | null>(null);

  useEffect(() => {
    if (user.role !== 'student') return;
    fetch(`/api/users/${user.uid}/profile`)
      .then((res) => res.json())
      .then((data) => {
        const p: ProfileInput | null = data.profile
          ? { birthDate: data.profile.birthDate, gender: data.profile.gender, disability: data.profile.disability, disabilityNote: data.profile.disabilityNote ?? '', entryStatus: data.profile.entryStatus, phone: data.profile.phone }
          : null;
        setSavedProfile(p);
        setProfile(p);
      })
      .catch(() => setSavedProfile(null));
  }, [user.uid, user.role]);

  const profileChanged = !!profile && JSON.stringify(profile) !== JSON.stringify(savedProfile);
  const setField = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) =>
    setProfile((cur) => (cur ? { ...cur, [key]: value } : cur));

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

      if (profileChanged) {
        const pres = await fetch(`/api/users/${user.uid}/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile),
        });
        const pdata = await pres.json();
        if (!pres.ok) throw new Error(`Akun tersimpan, tetapi profil belum: ${pdata.error || 'gagal menyimpan profil'}`);
      }

      if (isTest !== user.isTest) {
        const tres = await fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid, isTest }),
        });
        const tdata = await tres.json();
        if (!tres.ok) throw new Error(tdata.error || 'Gagal mengubah tanda akun test');
      }

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
        style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: user.role === 'student' ? '520px' : '420px', maxHeight: '90vh', overflowY: 'auto', padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}
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

        {user.role === 'student' && (
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>Profil peserta</h3>
              <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>Data yang diisi peserta sendiri saat pertama masuk</p>
            </div>
            {savedProfile === undefined ? (
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>Memuat profil...</p>
            ) : !profile ? (
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-app)', padding: '9px 11px', borderRadius: '8px', margin: 0 }}>
                Peserta belum mengisi profil. Profil diisi sendiri oleh peserta saat masuk berikutnya.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '12px' }}>
                <div>
                  <label style={label} htmlFor="edit-lahir">TANGGAL LAHIR</label>
                  <input id="edit-lahir" type="date" value={profile.birthDate} onChange={(e) => setField('birthDate', e.target.value)} style={field} />
                </div>
                <div>
                  <label style={label} htmlFor="edit-gender">JENIS KELAMIN</label>
                  <select id="edit-gender" value={profile.gender} onChange={(e) => setField('gender', e.target.value as Gender)} style={field}>
                    {(Object.keys(GENDER_LABELS) as Gender[]).map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label} htmlFor="edit-wa">NOMOR WHATSAPP</label>
                  <input id="edit-wa" type="tel" inputMode="tel" value={profile.phone} onChange={(e) => setField('phone', e.target.value)} style={field} />
                </div>
                <div>
                  <label style={label} htmlFor="edit-status">STATUS SAAT MENDAFTAR</label>
                  <select id="edit-status" value={profile.entryStatus} onChange={(e) => setField('entryStatus', e.target.value as EntryStatus)} style={field}>
                    {(Object.keys(ENTRY_STATUS_LABELS) as EntryStatus[]).map((k) => <option key={k} value={k}>{ENTRY_STATUS_LABELS[k]}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={label} htmlFor="edit-disabilitas">DISABILITAS</label>
                  <select id="edit-disabilitas" value={profile.disability} onChange={(e) => setField('disability', e.target.value as Disability)} style={field}>
                    {(Object.keys(DISABILITY_LABELS) as Disability[]).map((d) => <option key={d} value={d}>{DISABILITY_LABELS[d]}</option>)}
                  </select>
                  {profile.disability === 'lainnya' && (
                    <input
                      value={profile.disabilityNote}
                      onChange={(e) => setField('disabilityNote', e.target.value)}
                      placeholder="Sebutkan jenis disabilitasnya"
                      aria-label="Jenis disabilitas lainnya"
                      maxLength={200}
                      style={{ ...field, marginTop: '7px' }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Akun test tetap dapat masuk dan memakai aplikasi seperti biasa; yang
            berubah hanya angkanya tidak ikut dihitung di dashboard.

            A test account still signs in and uses the app as usual; only its
            figures stop counting on the dashboard. */}
        <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${isTest ? 'var(--color-warning)' : 'var(--color-border)'}`, backgroundColor: isTest ? 'var(--color-warning-light)' : '#ffffff', cursor: 'pointer' }}>
          <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} style={{ marginTop: '2px', width: '15px', height: '15px', flexShrink: 0 }} />
          <span>
            <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>Akun test</span>
            <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: 1.5, marginTop: '2px' }}>
              Tidak dihitung di dashboard: presensi, tugas, pre/post test, kuis, feedback, mentoring, ranking, dan login. Akunnya tetap bisa masuk seperti biasa.
            </span>
          </span>
        </label>

        {error && (
          <div role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)', padding: '8px 10px', borderRadius: '6px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose} disabled={busy} style={{ fontSize: '11px', padding: '9px 14px' }}>
            Batal
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={busy || !name.trim() || !email.trim() || savedProfile === undefined} style={{ fontSize: '11px', padding: '9px 14px' }}>
            {busy ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </div>
    </div>
  );
}
