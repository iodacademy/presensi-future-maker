'use client';

import React, { useState } from 'react';
import { UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DISABILITY_LABELS,
  ENTRY_STATUS_LABELS,
  GENDER_LABELS,
  type Disability,
  type EntryStatus,
  type Gender,
} from '@/features/users/profile-types';

/**
 * Formulir pelengkapan profil yang muncul sebelum halaman peserta.
 *
 * Ditampilkan sebagai layar penuh, bukan sebagai pengalihan ke halaman lain:
 * pengalihan membuat peserta yang menekan tombol kembali terlempar ke halaman
 * yang tidak dapat ia buka, lalu dialihkan lagi -- lingkaran yang hanya
 * berhenti bila ia menutup aplikasinya.
 *
 * The profile completion form shown before any participant page.
 *
 * Rendered as a full screen rather than a redirect to another page: a redirect
 * leaves a participant who presses back thrown onto a page they cannot open,
 * then redirected again -- a loop that only ends when they close the app.
 */
export function ProfileGate({ onDone }: { onDone: () => void }) {
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [disability, setDisability] = useState<Disability | ''>('');
  const [disabilityNote, setDisabilityNote] = useState('');
  const [entryStatus, setEntryStatus] = useState<EntryStatus | ''>('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthDate, gender, disability, disabilityNote, entryStatus, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan profil');
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const field: React.CSSProperties = {
    width: '100%', padding: '11px 12px', borderRadius: '10px',
    border: '1px solid var(--color-border)', fontSize: '13px',
  };
  const label: React.CSSProperties = {
    fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)',
    display: 'block', marginBottom: '5px',
  };

  const lengkap =
    birthDate && gender && disability && entryStatus && phone.trim() &&
    (disability !== 'lainnya' || disabilityNote.trim());

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-app)', padding: '20px 16px 40px' }}>
      <div style={{ maxWidth: '440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ textAlign: 'center', paddingTop: '12px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <UserCircle size={30} color="var(--color-primary)" strokeWidth={2} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>
            Lengkapi Profil Anda
          </h1>
          {/* Alasannya disebut. Formulir yang menghadang tanpa menjelaskan
              kenapa terbaca sebagai halangan, dan peserta mengisinya asal
              supaya cepat lewat.

              The reason is stated. A form that blocks without explaining why
              reads as an obstacle, and participants fill it carelessly to get
              past. */}
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px', lineHeight: 1.6 }}>
            Data ini dipakai penyelenggara untuk menyiapkan kebutuhan belajar Anda dan menyusun laporan program. Diisi sekali saja.
          </p>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={label} htmlFor="p-lahir">TANGGAL LAHIR</label>
            <input id="p-lahir" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} style={field} />
          </div>

          <div>
            <label style={label} htmlFor="p-gender">JENIS KELAMIN</label>
            <select id="p-gender" value={gender} onChange={(e) => setGender(e.target.value as Gender)} style={field}>
              <option value="">Pilih</option>
              {(Object.keys(GENDER_LABELS) as Gender[]).map((g) => (
                <option key={g} value={g}>{GENDER_LABELS[g]}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={label} htmlFor="p-wa">NOMOR WHATSAPP</label>
            <input
              id="p-wa"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08123456789"
              style={field}
            />
          </div>

          <div>
            <label style={label} htmlFor="p-status">STATUS SAAT MENDAFTAR</label>
            <select id="p-status" value={entryStatus} onChange={(e) => setEntryStatus(e.target.value as EntryStatus)} style={field}>
              <option value="">Pilih</option>
              {(Object.keys(ENTRY_STATUS_LABELS) as EntryStatus[]).map((s) => (
                <option key={s} value={s}>{ENTRY_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={label} htmlFor="p-disabilitas">DISABILITAS</label>
            <select id="p-disabilitas" value={disability} onChange={(e) => setDisability(e.target.value as Disability)} style={field}>
              <option value="">Pilih</option>
              {(Object.keys(DISABILITY_LABELS) as Disability[]).map((d) => (
                <option key={d} value={d}>{DISABILITY_LABELS[d]}</option>
              ))}
            </select>
            <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '5px', lineHeight: 1.5 }}>
              Dipakai untuk menyiapkan akomodasi yang Anda butuhkan selama kelas.
            </p>

            {disability === 'lainnya' && (
              <input
                value={disabilityNote}
                onChange={(e) => setDisabilityNote(e.target.value)}
                placeholder="Sebutkan jenis disabilitasnya"
                aria-label="Jenis disabilitas lainnya"
                maxLength={200}
                style={{ ...field, marginTop: '7px' }}
              />
            )}
          </div>

          {error && (
            <div role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)', padding: '10px 12px', borderRadius: '8px', lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          <Button variant="primary" onClick={save} disabled={busy || !lengkap} style={{ width: '100%' }}>
            {busy ? 'Menyimpan...' : 'Simpan dan Lanjutkan'}
          </Button>
        </div>
      </div>
    </main>
  );
}
