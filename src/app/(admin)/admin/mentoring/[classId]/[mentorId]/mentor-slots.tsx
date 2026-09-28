'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Trash2, Upload, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateWib } from '@/lib/time';
import type { Phase } from '@/features/assignments/types';
import type { MentoringSlotDocument } from '@/features/mentoring/types';

interface MentorSlotsProps {
  classId: string;
  mentorId: string;
  mentorName: string;
  phase: Phase;
}

interface ParsedRow {
  date: string;
  startTime: string;
}

/**
 * Membaca jadwal massal dari teks yang ditempel.
 *
 * Satu baris satu sesi, "tanggal, jam" -- bentuk yang keluar apa adanya saat
 * dua kolom disalin dari spreadsheet. Pemisahnya menerima koma, titik koma,
 * tab, atau spasi ganda karena admin menyalin dari Excel, Sheets, dan catatan
 * biasa, dan menolak salah satunya hanya memindahkan pekerjaan merapikan ke
 * orangnya.
 *
 * Parses a bulk schedule from pasted text.
 *
 * One session per line, "date, time" -- what two spreadsheet columns produce
 * when copied as is. The separator accepts a comma, semicolon, tab, or double
 * space because admins paste from Excel, Sheets, and plain notes, and
 * rejecting any one of them only moves the tidying work onto the person.
 */
export function parseBulkSlots(text: string): { rows: ParsedRow[]; errors: string[] } {
  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  text.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const parts = trimmed.split(/[,;\t]|\s{2,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) {
      errors.push(`Baris ${i + 1}: butuh tanggal dan jam, contoh "2026-10-05, 16:00"`);
      return;
    }

    const [date, startTime] = parts;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`Baris ${i + 1}: tanggal harus YYYY-MM-DD, bukan "${date}"`);
      return;
    }
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(startTime)) {
      errors.push(`Baris ${i + 1}: jam harus HH:mm, bukan "${startTime}"`);
      return;
    }

    // Baris kembar dalam satu tempelan akan menjadi dua slot pada jam yang
    // sama; peserta melihatnya dua kali dan satu di antaranya pasti kosong.
    //
    // A duplicate line in one paste becomes two slots at the same hour;
    // participants see it twice and one of them is bound to stay empty.
    const key = `${date} ${startTime}`;
    if (seen.has(key)) {
      errors.push(`Baris ${i + 1}: ${key} sudah ada di baris sebelumnya`);
      return;
    }
    seen.add(key);
    rows.push({ date, startTime });
  });

  return { rows, errors };
}

/**
 * Jadwal mentoring seorang mentor.
 *
 * Berada pada halaman mentornya sendiri, bersama daftar peserta bimbingannya:
 * halaman slot terpisah menanyakan ulang mentor mana yang dimaksud, padahal
 * admin baru saja memilihnya untuk menugaskan peserta.
 *
 * A mentor's mentoring schedule.
 *
 * It lives on that mentor's own page, beside the list of participants they
 * guide: a separate slot page asked again which mentor was meant, although the
 * admin had just picked them to assign participants.
 */
export function MentorSlots({ classId, mentorId, mentorName, phase }: MentorSlotsProps) {
  const [slots, setSlots] = useState<MentoringSlotDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'none' | 'single' | 'bulk'>('none');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('16:00');
  const [bulkText, setBulkText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/mentoring/slots?classId=${encodeURIComponent(classId)}&phase=${phase}`);
      if (res.ok) {
        const all: MentoringSlotDocument[] = (await res.json()).slots || [];
        // Disaring di sini, bukan lewat kueri: satu kelas punya segelintir
        // mentor, dan menambah indeks gabungan untuk itu tidak sepadan.
        //
        // Filtered here rather than in the query: a class has a handful of
        // mentors, and adding a composite index for that is not worth it.
        setSlots(all.filter((s) => s.mentorId === mentorId));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, mentorId, phase]);

  async function createOne(d: string, t: string): Promise<string | null> {
    const res = await fetch('/api/mentoring/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, phase, mentorId, date: d, startTime: t }),
    });
    if (res.ok) return null;
    return (await res.json()).error || 'Gagal membuat slot';
  }

  async function handleSingle() {
    setBusy(true);
    setStatus(null);
    const err = await createOne(date, startTime);
    setBusy(false);
    if (err) {
      setStatus({ type: 'error', text: err });
      return;
    }
    setMode('none');
    setStatus({ type: 'success', text: 'Slot mentoring ditambahkan' });
    load();
  }

  async function handleBulk() {
    const { rows, errors } = parseBulkSlots(bulkText);
    if (errors.length > 0) {
      setStatus({ type: 'error', text: errors.slice(0, 3).join(' | ') });
      return;
    }
    if (rows.length === 0) {
      setStatus({ type: 'error', text: 'Tidak ada baris jadwal yang terbaca' });
      return;
    }

    setBusy(true);
    setStatus(null);

    // Dikirim berurutan, bukan serentak: tiap slot menulis ke dokumen kelas
    // yang sama, dan penulisan bersamaan akan saling menimpa.
    //
    // Sent one after another rather than all at once: each slot writes to the
    // same class document, and concurrent writes would clobber each other.
    const gagal: string[] = [];
    for (const r of rows) {
      const err = await createOne(r.date, r.startTime);
      if (err) gagal.push(`${r.date} ${r.startTime}: ${err}`);
    }

    setBusy(false);
    setBulkText('');
    setMode('none');
    setStatus(
      gagal.length > 0
        ? { type: 'error', text: `${rows.length - gagal.length} slot dibuat, ${gagal.length} gagal. ${gagal[0]}` }
        : { type: 'success', text: `${rows.length} slot mentoring dibuat` }
    );
    load();
  }

  async function handleDelete(slot: MentoringSlotDocument) {
    if (slot.status !== 'available') {
      setStatus({ type: 'error', text: 'Slot yang sudah dipesan peserta tidak dapat dihapus. Batalkan pemesanannya lebih dulu.' });
      return;
    }
    if (!confirm(`Hapus slot ${slot.date} ${slot.startTime}?`)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/mentoring/slots/${slot.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal menghapus slot');
      load();
    } catch (e) {
      setStatus({ type: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const field: React.CSSProperties = {
    padding: '8px 10px', borderRadius: '8px',
    border: '1px solid var(--color-border)', fontSize: '11px',
  };

  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Judulnya sudah ada pada tab; mengulanginya di sini hanya menambah
          baris yang mendorong isinya turun.

          The heading is already on the tab; repeating it here only adds a line
          that pushes the content down. */}
      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
        Slot yang dibuka {mentorName}. Peserta bimbingannya memesan salah satunya.
      </div>

      {status && (
        <div
          role="alert"
          style={{
            padding: '9px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 600,
            backgroundColor: status.type === 'success' ? 'var(--color-success-light)' : 'var(--color-danger-light)',
            color: status.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
          }}
        >
          {status.text}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', padding: '12px 0' }}>Memuat jadwal...</div>
      ) : slots.length === 0 ? (
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', padding: '12px 0' }}>
          Belum ada slot. Peserta bimbingannya belum dapat memesan sesi.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {slots.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 11px',
                borderRadius: '8px',
                backgroundColor: s.status === 'available' ? 'var(--color-bg-app)' : 'var(--color-success-light)',
              }}
            >
              <Calendar size={12} color={s.status === 'available' ? 'var(--color-text-muted)' : 'var(--color-success)'} strokeWidth={2} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-main)' }}>
                  {formatDateWib(s.startsAt)} - {s.startTime} s.d. {s.endTime} WIB
                </div>
                <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                  {s.status === 'available' ? 'Belum dipesan' : `Dipesan ${s.studentName ?? 'peserta'}`}
                </div>
              </div>
              {s.status === 'available' && (
                <button
                  type="button"
                  aria-label={`Hapus slot ${s.date} ${s.startTime}`}
                  onClick={() => handleDelete(s)}
                  disabled={busy}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '3px', flexShrink: 0 }}
                >
                  <Trash2 size={12} color="var(--color-danger)" strokeWidth={2} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {mode === 'single' && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Tanggal mentoring"
            style={{ ...field, flex: '1 1 140px' }}
          />
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            aria-label="Jam mulai mentoring"
            style={{ ...field, width: '104px' }}
          />
          <Button variant="secondary" onClick={() => setMode('none')} disabled={busy} style={{ fontSize: '11px', padding: '8px 12px' }}>
            Batal
          </Button>
          <Button variant="primary" onClick={handleSingle} disabled={busy || !date} style={{ fontSize: '11px', padding: '8px 12px' }}>
            {busy ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      )}

      {mode === 'bulk' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            SATU BARIS SATU SESI: TANGGAL, JAM
          </div>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={'2026-10-05, 16:00\n2026-10-05, 17:00\n2026-10-12, 16:00'}
            rows={6}
            aria-label="Tempel jadwal mentoring"
            style={{ ...field, resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.6 }}
          />
          <div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
            Dapat ditempel langsung dari spreadsheet. Tanggal YYYY-MM-DD, jam HH:mm.
          </div>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setMode('none')} disabled={busy} style={{ fontSize: '11px', padding: '8px 12px' }}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleBulk} disabled={busy || !bulkText.trim()} style={{ fontSize: '11px', padding: '8px 12px' }}>
              {busy ? 'Membuat slot...' : 'Buat Semua'}
            </Button>
          </div>
        </div>
      )}

      {mode === 'none' && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => setMode('single')} style={{ fontSize: '11px', padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Plus size={12} strokeWidth={2} />
            Tambah Satu
          </Button>
          <Button variant="secondary" onClick={() => setMode('bulk')} style={{ fontSize: '11px', padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Upload size={12} strokeWidth={2} />
            Tempel Banyak
          </Button>
        </div>
      )}
    </div>
  );
}
