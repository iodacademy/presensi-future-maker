'use client';

import React, { useEffect, useState } from 'react';
import { ClipboardList, Trash2, Calendar, ChevronDown, ChevronRight, Link2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTimeWib } from '@/lib/time';
import type { SessionDocument } from '@/features/attendance/types';
import type { TaskSummary } from '@/features/tasks/types';
import { SubmissionRoster } from './submission-roster';

interface SessionWorkingPaperProps {
  session: SessionDocument;
  classId: string;
  /** Working paper yang sudah terikat pada pertemuan ini / Working papers already tied to this meeting */
  papers: TaskSummary[];
  onChanged: () => void;
  onDelete: (task: TaskSummary) => void;
}

/**
 * Memecah ISO UTC menjadi tanggal dan jam WIB untuk formulir.
 *
 * Memotong string ISO dengan slice menampilkan waktu UTC: batas pukul 23.59
 * WIB tersimpan sebagai 16.59 UTC di hari yang sama, sehingga formulir akan
 * menampilkan jam yang salah dan menyimpannya kembali akan menggeser batasnya
 * tujuh jam setiap kali disunting.
 *
 * Splits an ISO UTC instant into a WIB date and time for the form.
 *
 * Slicing an ISO string shows UTC: a 23:59 WIB deadline is stored as 16:59 UTC
 * the same day, so the form would show the wrong time and saving it back would
 * shift the deadline seven hours on every edit.
 */
function toWibParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };

  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    timeZone: 'Asia/Jakarta',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';

  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

interface PaperFormValues {
  title: string;
  description: string;
  briefUrl: string;
  dueDate: string;
  dueTime: string;
}

/**
 * Formulir isi sebuah working paper.
 *
 * Dipakai untuk menambah maupun menyunting: keduanya meminta field yang sama,
 * dan dua formulir terpisah akan berarti dua tempat memperbaiki setiap kali
 * fieldnya berubah.
 *
 * The body form for a working paper.
 *
 * Used for both adding and editing: both ask for the same fields, and two
 * separate forms would mean two places to fix whenever a field changes.
 */
function PaperForm({
  initial,
  submitLabel,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  initial: PaperFormValues;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (values: PaperFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const set = <K extends keyof PaperFormValues>(k: K, v: PaperFormValues[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const field: React.CSSProperties = {
    padding: '8px 10px', borderRadius: '8px',
    border: '1px solid var(--color-border)', fontSize: '11px', width: '100%',
  };
  const label: React.CSSProperties = {
    fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)',
    display: 'block', marginBottom: '3px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-app)' }}>
      <div>
        <label style={label} htmlFor="wp-title">JUDUL</label>
        <input
          id="wp-title"
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Working Paper Praktik 2"
          autoFocus
          style={field}
        />
      </div>

      <div>
        <label style={label} htmlFor="wp-desc">INSTRUKSI PENGERJAAN</label>
        <textarea
          id="wp-desc"
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Langkah pengerjaan, hal yang dinilai, format pengumpulan."
          rows={4}
          style={{ ...field, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
        />
      </div>

      <div>
        <label style={label} htmlFor="wp-url">TAUTAN TEMPLATE ATAU BAHAN</label>
        <input
          id="wp-url"
          type="url"
          value={values.briefUrl}
          onChange={(e) => set('briefUrl', e.target.value)}
          placeholder="https://docs.google.com/..."
          style={field}
        />
      </div>

      <div>
        <label style={label}>BATAS PENGUMPULAN</label>
        {/* Tanggal dan jam terpisah agar keduanya dapat diurai. Satu kolom teks
            bebas menghasilkan batas yang tidak pernah berlaku.

            A separate date and time so both can be parsed. A single free-text
            field produced deadlines that never took effect. */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="date"
            value={values.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
            aria-label="Tanggal batas pengumpulan"
            style={{ ...field, flex: 1 }}
          />
          <input
            type="time"
            value={values.dueTime}
            onChange={(e) => set('dueTime', e.target.value)}
            aria-label="Jam batas pengumpulan"
            style={{ ...field, width: '104px' }}
          />
        </div>
        <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '3px' }}>
          Kosongkan tanggalnya bila tidak ada batas.
        </div>
      </div>

      {error && (
        <div role="alert" style={{ fontSize: '10px', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onCancel} disabled={busy} style={{ fontSize: '11px', padding: '8px 14px' }}>
          Batal
        </Button>
        <Button
          variant="primary"
          onClick={() => onSubmit(values)}
          disabled={busy || !values.title.trim()}
          style={{ fontSize: '11px', padding: '8px 14px' }}
        >
          {busy ? 'Menyimpan...' : submitLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * Working paper sebuah pertemuan.
 *
 * Diletakkan pada kartu pertemuan bersama rekaman dan bahan praktiknya, bukan
 * pada tab tersendiri: seluruhnya melekat pada satu pertemuan, dan memisahkan
 * salah satunya membuat admin maupun peserta memeriksa dua tempat untuk sesi
 * yang sama.
 *
 * A meeting's working paper.
 *
 * It sits on the meeting card alongside its recordings and practice materials
 * rather than on a tab of its own: all of them belong to one meeting, and
 * separating any of them makes both admins and participants check two places
 * for the same session.
 */
export function SessionWorkingPaper({
  session,
  classId,
  papers,
  onChanged,
  onDelete,
}: SessionWorkingPaperProps) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(url: string, method: 'POST' | 'PATCH', body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan working paper');
      setAdding(false);
      setEditingId(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {papers.map((p) => {
        const isEditing = editingId === p.id;
        const isOpen = expandedId === p.id;

        if (isEditing) {
          const { date, time } = toWibParts(p.dueAt);
          return (
            <PaperForm
              key={p.id}
              initial={{
                title: p.title,
                description: p.description ?? '',
                briefUrl: p.briefUrl ?? '',
                dueDate: date,
                dueTime: time,
              }}
              submitLabel="Simpan Perubahan"
              busy={busy}
              error={error}
              onCancel={() => { setEditingId(null); setError(null); }}
              onSubmit={(v) =>
                send(`/api/tasks/${p.id}`, 'PATCH', {
                  title: v.title,
                  description: v.description,
                  briefUrl: v.briefUrl || null,
                  dueDate: v.dueDate || null,
                  dueTime: v.dueTime || null,
                })
              }
            />
          );
        }

        return (
          <div
            key={p.id}
            style={{
              borderRadius: '10px', backgroundColor: 'var(--color-warning-light)',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' }}>
              <button
                type="button"
                onClick={() => setExpandedId(isOpen ? null : p.id)}
                aria-expanded={isOpen}
                aria-label={`${isOpen ? 'Tutup' : 'Buka'} detail ${p.title}`}
                style={{
                  flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px',
                  border: 'none', background: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
                }}
              >
                {isOpen
                  ? <ChevronDown size={13} color="#7c2d12" strokeWidth={2} style={{ flexShrink: 0 }} />
                  : <ChevronRight size={13} color="#7c2d12" strokeWidth={2} style={{ flexShrink: 0 }} />}
                <ClipboardList size={13} color="#7c2d12" strokeWidth={2} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c2d12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                    {p.dueAt ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', color: '#7c2d12' }}>
                        <Calendar size={9} strokeWidth={2} />
                        Batas {formatDateTimeWib(p.dueAt)} WIB
                      </span>
                    ) : (
                      <span style={{ fontSize: '9px', color: '#7c2d12', opacity: 0.75 }}>Tanpa batas waktu</span>
                    )}
                    {p.briefUrl && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', color: '#7c2d12' }}>
                        <Link2 size={9} strokeWidth={2} />
                        Ada tautan
                      </span>
                    )}
                  </div>
                </div>
              </button>

              <button
                type="button"
                aria-label={`Ubah working paper ${p.title}`}
                onClick={() => { setEditingId(p.id); setExpandedId(p.id); setError(null); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
              >
                <Pencil size={13} color="#7c2d12" strokeWidth={2} />
              </button>
              <button
                type="button"
                aria-label={`Hapus working paper ${p.title}`}
                onClick={() => onDelete(p)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
              >
                <Trash2 size={13} color="var(--color-danger)" strokeWidth={2} />
              </button>
            </div>

            {isOpen && (
              <div style={{ padding: '0 12px 12px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ height: '1px', backgroundColor: 'rgba(124, 45, 18, 0.15)' }} />

                <div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#7c2d12', marginBottom: '3px' }}>INSTRUKSI</div>
                  {p.description?.trim() ? (
                    // whiteSpace pre-wrap mempertahankan baris baru yang diketik
                    // admin; tanpa itu instruksi berlangkah-langkah menyatu jadi
                    // satu paragraf.
                    //
                    // pre-wrap keeps the line breaks an admin typed; without it a
                    // step-by-step instruction collapses into one paragraph.
                    <div style={{ fontSize: '11px', color: 'var(--color-text-main)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                      {p.description}
                    </div>
                  ) : (
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      Belum ada instruksi. Peserta hanya melihat judulnya.
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#7c2d12', marginBottom: '4px' }}>PENGUMPULAN</div>
                  <SubmissionRoster taskId={p.id} />
                </div>

                {p.briefUrl && (
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: '#7c2d12', marginBottom: '3px' }}>TAUTAN</div>
                    <a
                      href={p.briefUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--color-primary)', wordBreak: 'break-all' }}
                    >
                      <Link2 size={11} strokeWidth={2} style={{ flexShrink: 0 }} />
                      {p.briefUrl}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {adding ? (
        <PaperForm
          initial={{
            title: '',
            description: '',
            briefUrl: '',
            // Batas paling lazim adalah akhir hari pertemuannya sendiri.
            // The most common deadline is the end of the meeting's own day.
            dueDate: session.date,
            dueTime: '23:59',
          }}
          submitLabel="Simpan"
          busy={busy}
          error={error}
          onCancel={() => { setAdding(false); setError(null); }}
          onSubmit={(v) =>
            send(`/api/classes/${classId}/tasks`, 'POST', {
              title: v.title,
              kind: 'working-paper',
              sessionId: session.id,
              description: v.description,
              briefUrl: v.briefUrl || null,
              dueDate: v.dueDate || null,
              dueTime: v.dueTime || null,
              order: papers.length + 1,
            })
          }
        />
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)} style={{ fontSize: '11px', padding: '8px 14px', alignSelf: 'flex-start' }}>
          Tambah Working Paper
        </Button>
      )}
    </div>
  );
}
