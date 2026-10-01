'use client';

import React, { useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ClassSummary } from '@/features/classes/types';
import type { SessionDocument } from '@/features/attendance/types';
import type { SurveyFormDocument } from '@/features/survey/types';

interface ScopeModalProps {
  form: SurveyFormDocument;
  classes: ClassSummary[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Pengaturan cakupan sebuah survei.
 *
 * Kosong berarti seluruhnya, bukan tidak sama sekali. Menyimpan seluruh id
 * kelas saat admin memilih "semua kelas" akan membekukan daftarnya pada saat
 * penyimpanan, sehingga kelas yang dibuat kemudian tidak pernah mendapat
 * surveinya -- kesalahan yang baru ketahuan saat angkatan berikutnya dibuka.
 *
 * A survey's scope settings.
 *
 * Empty means all, not none. Storing every class id when an admin picks "all
 * classes" would freeze the list at save time, so a class created later would
 * never receive the survey -- a mistake that only surfaces when the next cohort
 * opens.
 */
export function SurveyScopeModal({ form, classes, onClose, onSaved }: ScopeModalProps) {
  const [classIds, setClassIds] = useState<string[]>(form.scope.classIds);
  const [sessionIds, setSessionIds] = useState<string[]>(form.scope.sessionIds);
  const [sessions, setSessions] = useState<SessionDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pertemuan dimuat untuk kelas yang dipilih saja. Memuat seluruh pertemuan
  // dari empat kelas menghasilkan daftar dua ratus baris yang tidak dapat
  // dipindai.
  //
  // Meetings are loaded for the chosen classes only. Loading every meeting from
  // four classes yields a two-hundred-row list nobody can scan.
  useEffect(() => {
    const target = classIds.length > 0 ? classIds : classes.map((c) => c.id);
    if (target.length === 0) { setSessions([]); return; }

    let cancelled = false;
    Promise.all(
      target.map((id) =>
        fetch(`/api/sessions?classId=${encodeURIComponent(id)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => (d?.sessions ?? []) as SessionDocument[])
          .catch(() => [])
      )
    ).then((hasil) => {
      if (cancelled) return;
      const semua = hasil.flat();
      // Pertemuan gabungan muncul pada beberapa kelas sekaligus; tanpa
      // penyaringan ini judulnya tampil berulang.
      //
      // A merged meeting appears under several classes at once; without this
      // its title would show more than once.
      const unik = new Map(semua.map((s) => [s.id, s]));
      setSessions([...unik.values()].sort((a, b) => a.date.localeCompare(b.date)));
    });

    return () => { cancelled = true; };
  }, [classIds, classes]);

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/survey/forms/${form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: { classIds, sessionIds } }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal menyimpan cakupan');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const pil = (aktif: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
    fontSize: '10px', fontWeight: aktif ? 700 : 400,
    backgroundColor: aktif ? 'var(--color-primary)' : 'var(--color-border)',
    color: aktif ? '#ffffff' : 'var(--color-text-main)',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
      <div role="dialog" aria-modal="true" aria-label={`Cakupan ${form.title}`} style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '88vh', overflowY: 'auto', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>
              Cakupan Survei
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{form.title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={16} color="var(--color-text-muted)" strokeWidth={2} />
          </button>
        </div>

        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '7px' }}>KELAS</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setClassIds([])} aria-pressed={classIds.length === 0} style={pil(classIds.length === 0)}>
              Semua Kelas
            </button>
            {classes.map((c) => (
              <button key={c.id} type="button" onClick={() => setClassIds(toggle(classIds, c.id))} aria-pressed={classIds.includes(c.id)} style={pil(classIds.includes(c.id))}>
                {c.canonicalName}
              </button>
            ))}
          </div>
          {classIds.length === 0 && (
            <p style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
              Termasuk kelas yang dibuat kemudian. Memilih kelas satu per satu membekukan daftarnya pada hari ini.
            </p>
          )}
        </div>

        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '7px' }}>PERTEMUAN</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <button type="button" onClick={() => setSessionIds([])} aria-pressed={sessionIds.length === 0} style={pil(sessionIds.length === 0)}>
              Semua Pertemuan
            </button>
          </div>

          {sessions.length === 0 ? (
            <p style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Memuat daftar pertemuan...</p>
          ) : (
            <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '8px' }}>
              {sessions.map((s) => {
                const dipilih = sessionIds.includes(s.id);
                return (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', backgroundColor: dipilih ? 'var(--color-primary-light)' : 'transparent' }}>
                    <input type="checkbox" checked={dipilih} onChange={() => setSessionIds(toggle(sessionIds, s.id))} style={{ margin: 0, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: '10px', color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.date} - {s.title}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {sessionIds.length === 0 && (
            <p style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
              Termasuk pertemuan yang dijadwalkan kemudian.
            </p>
          )}
        </div>

        {error && (
          <div role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)', padding: '9px 11px', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose} disabled={busy} style={{ fontSize: '11px', padding: '9px 14px' }}>
            Batal
          </Button>
          <Button variant="primary" onClick={save} disabled={busy} style={{ fontSize: '11px', padding: '9px 14px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Check size={13} strokeWidth={2.5} />
            {busy ? 'Menyimpan...' : 'Simpan Cakupan'}
          </Button>
        </div>
      </div>
    </div>
  );
}
