'use client';

import React, { useEffect, useState } from 'react';
import { X, FileUp, Video, MapPin } from 'lucide-react';
import type { SessionMode, SessionDocument } from '@/features/attendance/types';

interface CreateSessionModalProps {
  classId: string;
  classNameTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /**
   * Bila diisi, modal menyunting sesi tersebut alih-alih membuat yang baru.
   * Formulirnya sama persis, sehingga menduplikasinya hanya akan membuat dua
   * tempat yang harus diperbaiki setiap kali aturan validasi berubah.
   *
   * When provided, the modal edits that session instead of creating a new one.
   * The form is identical, so duplicating it would only create two places to
   * fix whenever a validation rule changes.
   */
  editSession?: SessionDocument | null;
}

// Modal dibangun presisi mengikuti node Figma 10:1793 (w=560, radius=16, padding=24, itemSpacing=14)
// Modal built precisely following Figma node 10:1793
export function CreateSessionModal({
  classId,
  classNameTitle,
  isOpen,
  onClose,
  onSuccess,
  editSession = null,
}: CreateSessionModalProps) {
  const isEdit = Boolean(editSession);
  const [entryMode, setEntryMode] = useState<'manual' | 'import'>('manual');
  const [title, setTitle] = useState(editSession?.title ?? '');
  const [mode, setMode] = useState<SessionMode>(editSession?.mode ?? 'online');
  const [date, setDate] = useState(editSession?.date ?? '');
  const [startTime, setStartTime] = useState(editSession?.startTime ?? '19:00');
  const [endTime, setEndTime] = useState(editSession?.endTime ?? '22:00');
  const [zoomUrl, setZoomUrl] = useState(editSession?.zoomUrl ?? '');
  const [address, setAddress] = useState(editSession?.address ?? '');
  const [mapsUrl, setMapsUrl] = useState(editSession?.mapsUrl ?? '');
  // Kelas lain yang ikut sesi ini. Onboarding dihadiri beberapa kelas dalam
  // satu ruang Zoom, sehingga satu kode QR harus berlaku bagi semuanya.
  //
  // Other classes joining this session. Onboarding is attended by several
  // classes in one Zoom room, so a single QR code must work for all of them.
  const [extraClassIds, setExtraClassIds] = useState<string[]>(
    (editSession?.classIds ?? []).filter((id) => id !== classId)
  );
  const [otherClasses, setOtherClasses] = useState<{ id: string; canonicalName: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hook dipanggil sebelum early return: memanggilnya setelah akan mengubah
  // jumlah hook antar-render dan React menolaknya.
  //
  // The hook runs before the early return: calling it after would change the
  // hook count between renders and React refuses that.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/classes')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setOtherClasses((d.classes ?? []).filter((c: { id: string }) => c.id !== classId));
      })
      .catch(() => {
        // Gagal memuat daftar kelas tidak boleh menghalangi pembuatan sesi
        // biasa; pilihan kelas tambahan hanya tidak muncul.
        //
        // Failing to load the class list must not block creating an ordinary
        // session; the additional-class picker simply does not appear.
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, classId]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(isEdit ? `/api/sessions/${editSession!.id}` : '/api/sessions', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId, classIds: extraClassIds, title, date, startTime, endTime, mode,
          zoomUrl: mode === 'online' ? zoomUrl : null,
          address: mode === 'offline' ? address : null,
          mapsUrl: mode === 'offline' ? mapsUrl : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (isEdit ? 'Gagal mengubah pertemuan' : 'Gagal membuat sesi pertemuan'));

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const labelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: 'var(--color-text-faint)' };
  const inputStyle: React.CSSProperties = {
    padding: '10px', borderRadius: '8px', border: '1px solid var(--color-primary)',
    fontSize: '11px', color: 'var(--color-text-main)', outline: 'none', width: '100%',
    boxSizing: 'border-box', fontFamily: 'inherit',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '560px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header (node 10:1794) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)' }}>
              {isEdit ? 'Ubah Pertemuan' : 'Tambah Pertemuan'}
            </h2>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{classNameTitle}</span>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <X size={18} color="var(--color-text-faint)" strokeWidth={2} />
          </button>
        </div>

        {/* Tab Import Excel / Tambah Manual (node 10:1800) */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setEntryMode('import')}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: '10px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
              border: entryMode === 'import' ? 'none' : '1px solid var(--color-border)',
              backgroundColor: entryMode === 'import' ? 'var(--color-primary)' : '#ffffff',
              color: entryMode === 'import' ? '#ffffff' : 'var(--color-text-main)',
            }}
          >
            <FileUp size={13} strokeWidth={2} />
            Import Excel
          </button>
          <button
            type="button"
            onClick={() => setEntryMode('manual')}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: '10px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
              border: entryMode === 'manual' ? 'none' : '1px solid var(--color-border)',
              backgroundColor: entryMode === 'manual' ? 'var(--color-primary)' : '#ffffff',
              color: entryMode === 'manual' ? '#ffffff' : 'var(--color-text-main)',
            }}
          >
            Tambah Manual
          </button>
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--color-border)' }} />

        {entryMode === 'import' ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '11px', border: '1px dashed var(--color-border)', borderRadius: '8px' }}>
            Fitur import Excel jadwal dapat ditambahkan pada tahap berikutnya.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* NAMA PERTEMUAN (node 10:1810) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={labelStyle}>NAMA PERTEMUAN</label>
              <input style={inputStyle} placeholder="State Management Lanjutan" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            {/* MODA (node 10:1814): pill terisi biru untuk Online, abu untuk Offline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={labelStyle}>MODA</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setMode('online')}
                  style={{
                    padding: '9px 20px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: mode === 'online' ? 700 : 400, cursor: 'pointer',
                    backgroundColor: mode === 'online' ? 'var(--color-primary)' : 'var(--color-border)',
                    color: mode === 'online' ? '#ffffff' : 'var(--color-text-main)',
                  }}
                >
                  Online
                </button>
                <button
                  type="button"
                  onClick={() => setMode('offline')}
                  style={{
                    padding: '9px 20px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: mode === 'offline' ? 700 : 400, cursor: 'pointer',
                    backgroundColor: mode === 'offline' ? 'var(--color-primary)' : 'var(--color-border)',
                    color: mode === 'offline' ? '#ffffff' : 'var(--color-text-main)',
                  }}
                >
                  Offline
                </button>
              </div>
            </div>

            {otherClasses.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={labelStyle}>KELAS LAIN YANG IKUT (OPSIONAL)</label>
                <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: 0 }}>
                  Untuk sesi gabungan seperti onboarding. Satu kode QR berlaku bagi seluruh kelas yang dipilih.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                  {otherClasses.map((c) => {
                    const checked = extraClassIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                          borderRadius: '8px', cursor: 'pointer', fontSize: '11px',
                          border: checked ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                          backgroundColor: checked ? 'var(--color-primary-light)' : '#ffffff',
                          color: checked ? 'var(--color-primary)' : 'var(--color-text-main)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setExtraClassIds((prev) =>
                              e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                            )
                          }
                          style={{ margin: 0 }}
                        />
                        {c.canonicalName}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {mode === 'online' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={labelStyle}>LINK ZOOM (OPSIONAL)</label>
                <div style={{ position: 'relative' }}>
                  <Video size={13} color="var(--color-primary)" strokeWidth={2} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input style={{ ...inputStyle, paddingLeft: '32px' }} type="url" placeholder="https://zoom.us/j/1234567890" value={zoomUrl} onChange={(e) => setZoomUrl(e.target.value)} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={labelStyle}>ALAMAT GEDUNG / RUANG</label>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={13} color="var(--color-primary)" strokeWidth={2} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input style={{ ...inputStyle, paddingLeft: '32px' }} placeholder="Gedung Rektorat Lt 3, Kampus Semarang" value={address} onChange={(e) => setAddress(e.target.value)} required />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={labelStyle}>LINK GOOGLE MAPS (OPSIONAL)</label>
                  <input style={inputStyle} type="url" placeholder="https://maps.google.com/?q=..." value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} />
                </div>
              </div>
            )}

            {/* TANGGAL DAN JAM (node 10:1829) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={labelStyle}>TANGGAL DAN JAM</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input style={{ ...inputStyle, border: '1px solid var(--color-border)' }} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input style={{ ...inputStyle, border: '1px solid var(--color-border)', width: '48%' }} placeholder="19:00" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                  <span style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>-</span>
                  <input style={{ ...inputStyle, border: '1px solid var(--color-border)', width: '48%' }} placeholder="22:00" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                </div>
              </div>
            </div>

            {/* Info box kuning (node 10:1836) */}
            {mode === 'online' && (
              <div style={{ backgroundColor: 'var(--color-warning-light)', padding: '10px', borderRadius: '8px', fontSize: '9px', color: '#7c2d12', lineHeight: 1.4 }}>
                Karena Online: presensi otomatis buka 19:00 dan tutup 22:00, QR aktif sepanjang jam itu.
              </div>
            )}

            {error && (
              <div style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '10px', borderRadius: '6px', fontSize: '11px' }}>{error}</div>
            )}

            {/* Footer tombol (node 10:1838): rata kanan */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-border)', color: 'var(--color-text-main)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '11px', fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan dan Buat Presensi'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
