'use client';

import React, { useEffect, useState } from 'react';
import { X, Check, Plus } from 'lucide-react';

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Mentor {
  uid: string;
  name: string;
  email: string;
  currentClassName?: string; // "Sudah handle: ..." (node 10:1506)
}

const PRESET_CITIES = ['Jakarta', 'Semarang', 'Surabaya', 'Yogyakarta'];

// Modal dibangun presisi mengikuti node Figma 10:1457 (w=480, radius=16, padding=24, itemSpacing=16)
// Modal built precisely following Figma node 10:1457
export function CreateClassModal({ isOpen, onClose, onSuccess }: CreateClassModalProps) {
  const [selectedCity, setSelectedCity] = useState(PRESET_CITIES[1]); // default Semarang (sesuai contoh Figma)
  const [customCity, setCustomCity] = useState('');
  const [isCustomCity, setIsCustomCity] = useState(false);
  const [programName, setProgramName] = useState('');
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [selectedMentorIds, setSelectedMentorIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/mentors')
      .then((r) => r.json())
      .then((d) => setMentors(d.mentors || []))
      .catch(() => setMentors([]));
  }, [isOpen]);

  if (!isOpen) return null;

  const city = isCustomCity ? customCity : selectedCity;

  function toggleMentor(uid: string) {
    setSelectedMentorIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city,
          programName,
          mentorIds: selectedMentorIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal membuat kelas');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedNames = mentors
    .filter((m) => selectedMentorIds.includes(m.uid))
    .map((m) => m.name.split(' ')[0]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px',
      }}
    >
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header: judul Poppins Bold 15px + tombol X (node 10:1458) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)' }}>
            Buat Kelas Baru
          </h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <X size={18} color="var(--color-text-faint)" strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* KOTA (node 10:1462): label 10px bold uppercase #999999, pill radius=20 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-faint)' }}>KOTA</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              {PRESET_CITIES.map((c) => {
                const active = !isCustomCity && selectedCity === c;
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => { setSelectedCity(c); setIsCustomCity(false); }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '10px',
                      fontWeight: active ? 700 : 400,
                      border: 'none',
                      backgroundColor: active ? 'var(--color-primary)' : 'var(--color-border)',
                      color: active ? '#ffffff' : 'var(--color-text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    {c}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setIsCustomCity(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '6px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 400,
                  border: isCustomCity ? '1px solid var(--color-primary)' : '1px solid var(--color-text-faint)',
                  backgroundColor: '#ffffff',
                  color: isCustomCity ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                }}
              >
                + Kota Baru
              </button>
            </div>
            {isCustomCity && (
              <input
                placeholder="Ketik nama kota baru..."
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                required
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px', outline: 'none' }}
              />
            )}
          </div>

          {/* NAMA KELAS (node 10:1475): outline biru radius=8 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-faint)' }}>NAMA KELAS</label>
            <input
              placeholder="Contoh: Web Programming, Data Analyst"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              required
              style={{
                padding: '10px', borderRadius: '8px', border: '1px solid var(--color-primary)',
                fontSize: '11px', color: 'var(--color-text-main)', outline: 'none',
              }}
            />
          </div>

          {/* PILIH MENTOR (node 10:1479): list dengan checkbox + avatar bulat 24px */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-faint)' }}>
              PILIH MENTOR (bisa lebih dari 1)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
              {mentors.length === 0 && (
                <div style={{ fontSize: '10px', color: 'var(--color-text-faint)', padding: '9px' }}>
                  Belum ada mentor terdaftar. Tambahkan mentor melalui menu Peserta dan Mentor.
                </div>
              )}
              {mentors.map((mentor) => {
                const checked = selectedMentorIds.includes(mentor.uid);
                const isTaken = Boolean(mentor.currentClassName);
                return (
                  <button
                    type="button"
                    key={mentor.uid}
                    onClick={() => toggleMentor(mentor.uid)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '9px',
                      borderRadius: '8px', textAlign: 'left', cursor: 'pointer',
                      backgroundColor: checked ? 'var(--color-primary-light)' : 'transparent',
                      border: checked ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    }}
                  >
                    {/* Checkbox 16x16 radius=4 */}
                    <span
                      style={{
                        width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: checked ? 'var(--color-primary)' : 'transparent',
                        border: checked ? 'none' : '2px solid var(--color-border)',
                      }}
                    >
                      {checked && <Check size={11} color="#ffffff" strokeWidth={3} />}
                    </span>
                    {/* Avatar inisial 24x24 radius=full */}
                    <span
                      style={{
                        width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-border)',
                        color: checked ? '#ffffff' : 'var(--color-text-main)',
                        fontSize: '9px', fontWeight: 700,
                      }}
                    >
                      {mentor.name.charAt(0).toUpperCase()}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        {mentor.name}
                      </span>
                      <span style={{ fontSize: '8px', color: isTaken ? 'var(--color-text-faint)' : 'var(--color-text-muted)' }}>
                        {isTaken ? `Sudah handle: ${mentor.currentClassName}` : mentor.email}
                      </span>
                    </span>
                  </button>
                );
              })}
              {/* Tombol tambah mentor baru (node 10:1507) */}
              <a
                href="/admin/akun"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  padding: '9px', borderRadius: '8px', border: '1px solid var(--color-text-faint)',
                  fontSize: '10px', color: 'var(--color-text-muted)', textDecoration: 'none',
                }}
              >
                <Plus size={12} strokeWidth={2} />
                Tambah Mentor Baru
              </a>
            </div>

            {/* Ringkasan pilihan (node 10:1509): background biru muda radius=6 */}
            {selectedNames.length > 0 && (
              <div style={{ padding: '7px', borderRadius: '6px', backgroundColor: 'var(--color-primary-light)' }}>
                <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--color-primary)' }}>
                  {selectedNames.length} mentor dipilih: {selectedNames.join(' and ')}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '8px 12px', borderRadius: '6px', fontSize: '11px' }}>
              {error}
            </div>
          )}

          {/* Footer tombol (node 10:1511): Batal abu + Simpan biru, radius=8 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                backgroundColor: 'var(--color-border)', color: 'var(--color-text-main)',
                fontSize: '11px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                backgroundColor: 'var(--color-primary)', color: '#ffffff',
                fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
