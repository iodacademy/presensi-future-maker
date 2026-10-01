'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Pencil, X, Check, Settings2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { SurveyScopeModal } from '../../survey-scope-modal';
import { describeScope } from '@/features/survey/policy';
import {
  SURVEY_QUESTION_LABELS,
  type SurveyFormDocument,
  type SurveyQuestion,
  type SurveyQuestionKind,
} from '@/features/survey/types';
import type { ClassSummary } from '@/features/classes/types';

interface Draft {
  kind: SurveyQuestionKind;
  text: string;
  options: string[];
  required: boolean;
}

const KOSONG: Draft = { kind: 'skala', text: '', options: ['', ''], required: true };

/**
 * Penyunting sebuah survei.
 *
 * Berhalaman sendiri, bukan di dalam baris tabel: dua puluh empat pertanyaan
 * tidak muat pada baris yang melebar, dan menyunting teks panjang di dalam
 * ruang selebar kolom membuat kalimatnya tidak terbaca utuh saat diperiksa.
 *
 * A survey's editor.
 *
 * On its own page rather than inside a table row: twenty-four questions do not
 * fit in an expanding row, and editing long text in a column's width leaves the
 * sentence unreadable while it is being checked.
 */
export default function SurveyEditorPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = React.use(params);
  const router = useRouter();

  const [form, setForm] = useState<SurveyFormDocument | null>(null);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(KOSONG);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, c] = await Promise.all([
        fetch(`/api/survey/forms/${formId}`),
        fetch('/api/classes'),
      ]);
      if (!f.ok) throw new Error((await f.json()).error || 'Survei tidak ditemukan');
      const data = (await f.json()).form as SurveyFormDocument;
      setForm(data);
      setTitle(data.title);
      setDescription(data.description);
      if (c.ok) setClasses((await c.json()).classes || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => { load(); }, [load]);

  async function patchForm(body: Record<string, unknown>, pesan?: string) {
    setError(null);
    const res = await fetch(`/api/survey/forms/${formId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError((await res.json()).error || 'Gagal menyimpan');
      return false;
    }
    if (pesan) setStatus(pesan);
    await load();
    return true;
  }

  async function saveMeta() {
    setSavingMeta(true);
    await patchForm({ title, description }, 'Judul dan deskripsi tersimpan');
    setSavingMeta(false);
  }

  async function saveQuestion() {
    setBusy(true);
    setError(null);
    try {
      const url = editingId
        ? `/api/survey/forms/${formId}/questions/${editingId}`
        : `/api/survey/forms/${formId}/questions`;
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal menyimpan pertanyaan');
      setDraft(KOSONG);
      setEditingId(null);
      setAdding(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function move(questionId: string, direction: 'up' | 'down') {
    await fetch(`/api/survey/forms/${formId}/questions/${questionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    });
    load();
  }

  async function removeQuestion(q: SurveyQuestion) {
    if (!confirm(`Hapus pertanyaan "${q.text}"?`)) return;
    await fetch(`/api/survey/forms/${formId}/questions/${q.id}`, { method: 'DELETE' });
    load();
  }

  function startEdit(q: SurveyQuestion) {
    setEditingId(q.id);
    setAdding(false);
    setDraft({
      kind: q.kind,
      text: q.text,
      options: q.options.length >= 2 ? q.options : ['', ''],
      required: q.required,
    });
  }

  if (loading) {
    return (
      <AppShell role="admin" userName="Administrator">
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          Memuat survei...
        </div>
      </AppShell>
    );
  }

  if (!form) {
    return (
      <AppShell role="admin" userName="Administrator">
        <div role="alert" style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--color-danger)' }}>
          {error ?? 'Survei tidak ditemukan'}
        </div>
        <Link href="/admin/pengaturan" style={{ textDecoration: 'none', alignSelf: 'flex-start' }}>
          <Button variant="secondary" style={{ fontSize: '11px', padding: '9px 14px' }}>Kembali</Button>
        </Link>
      </AppShell>
    );
  }

  const classNames = new Map(classes.map((c) => [c.id, c.canonicalName]));
  const field: React.CSSProperties = {
    padding: '9px 11px', borderRadius: '8px',
    border: '1px solid var(--color-border)', fontSize: '12px', width: '100%',
  };

  return (
    <AppShell role="admin" userName="Administrator">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Link href="/admin/pengaturan" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)', textDecoration: 'none', fontSize: '11px', fontWeight: 600, alignSelf: 'flex-start' }}>
          <ArrowLeft size={12} strokeWidth={2} /> Kembali ke Pengaturan
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
              {form.title}
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' }}>
              {form.questions.length} pertanyaan - {describeScope(form.scope, classNames, new Map())}
            </p>
          </div>
          <span style={{ fontSize: '8px', fontWeight: 700, padding: '4px 10px', borderRadius: '10px', whiteSpace: 'nowrap', backgroundColor: form.published ? 'var(--color-success)' : 'var(--color-border)', color: form.published ? '#ffffff' : 'var(--color-text-muted)' }}>
            {form.published ? 'TERBIT' : 'DRAF'}
          </span>
        </div>
      </div>

      {status && (
        <div role="status" style={{ padding: '9px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)' }}>
          {status}
        </div>
      )}
      {error && (
        <div role="alert" style={{ padding: '9px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '720px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)' }}>JUDUL DAN PENGANTAR</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Judul survei" style={field} />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label="Pengantar survei"
          placeholder="Kalimat pembuka yang dibaca peserta sebelum mengisi."
          rows={2}
          style={{ ...field, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55 }}
        />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={saveMeta} disabled={savingMeta || !title.trim()} style={{ fontSize: '11px', padding: '9px 14px' }}>
            {savingMeta ? 'Menyimpan...' : 'Simpan'}
          </Button>
          <Button variant="secondary" onClick={() => setScopeOpen(true)} style={{ fontSize: '11px', padding: '9px 14px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Settings2 size={12} strokeWidth={2} /> Atur Cakupan
          </Button>
        </div>
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '720px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)' }}>PERTANYAAN</div>

        {form.questions.length === 0 ? (
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', padding: '6px 0' }}>
            Belum ada pertanyaan. Tambahkan di bawah.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {[...form.questions].sort((a, b) => a.order - b.order).map((q, i, arr) => {
              if (editingId === q.id) {
                return (
                  <QuestionForm
                    key={q.id}
                    draft={draft}
                    setDraft={setDraft}
                    busy={busy}
                    submitLabel="Simpan Perubahan"
                    onCancel={() => { setEditingId(null); setDraft(KOSONG); }}
                    onSubmit={saveQuestion}
                  />
                );
              }

              return (
                <div key={q.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '11px 12px', borderRadius: '8px', backgroundColor: 'var(--color-bg-app)' }}>
                  {/* Naik-turun sebagai tombol, bukan seret: seret menuntut
                      kursor dan tidak terjangkau dari papan ketik maupun layar
                      sentuh yang sempit.

                      Up and down as buttons rather than dragging: dragging
                      demands a pointer and is out of reach from a keyboard or a
                      narrow touch screen. */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }}>
                    <button
                      type="button"
                      aria-label={`Naikkan pertanyaan ${i + 1}`}
                      onClick={() => move(q.id, 'up')}
                      disabled={i === 0}
                      style={{ border: 'none', background: 'none', cursor: i === 0 ? 'default' : 'pointer', padding: '1px', opacity: i === 0 ? 0.25 : 1 }}
                    >
                      <ChevronUp size={13} color="var(--color-text-muted)" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Turunkan pertanyaan ${i + 1}`}
                      onClick={() => move(q.id, 'down')}
                      disabled={i === arr.length - 1}
                      style={{ border: 'none', background: 'none', cursor: i === arr.length - 1 ? 'default' : 'pointer', padding: '1px', opacity: i === arr.length - 1 ? 0.25 : 1 }}
                    >
                      <ChevronDown size={13} color="var(--color-text-muted)" strokeWidth={2} />
                    </button>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: 1.5 }}>
                      {i + 1}. {q.text}
                      {q.required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {SURVEY_QUESTION_LABELS[q.kind]}
                      {q.options.length > 0 && ` - ${q.options.join(', ')}`}
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label={`Ubah pertanyaan ${i + 1}`}
                    onClick={() => startEdit(q)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '3px', flexShrink: 0 }}
                  >
                    <Pencil size={12} color="var(--color-text-main)" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus pertanyaan ${i + 1}`}
                    onClick={() => removeQuestion(q)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '3px', flexShrink: 0 }}
                  >
                    <Trash2 size={12} color="var(--color-danger)" strokeWidth={2} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {adding ? (
          <QuestionForm
            draft={draft}
            setDraft={setDraft}
            busy={busy}
            submitLabel="Tambah"
            onCancel={() => { setAdding(false); setDraft(KOSONG); }}
            onSubmit={saveQuestion}
          />
        ) : (
          <Button
            variant="secondary"
            onClick={() => { setAdding(true); setEditingId(null); setDraft(KOSONG); }}
            style={{ fontSize: '11px', padding: '9px 14px', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <Plus size={12} strokeWidth={2} /> Tambah Pertanyaan
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', maxWidth: '720px' }}>
        <Button
          variant={form.published ? 'secondary' : 'primary'}
          onClick={() => patchForm({ published: !form.published }, form.published ? 'Survei ditarik dari peserta' : 'Survei diterbitkan')}
          style={{ fontSize: '11px', padding: '9px 14px' }}
        >
          {form.published ? 'Tarik dari Peserta' : 'Terbitkan'}
        </Button>
        <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', lineHeight: 1.5, flex: 1, minWidth: '240px' }}>
          Pertanyaan boleh diubah kapan saja. Jawaban yang sudah masuk menyimpan salinan pertanyaannya sendiri, jadi rekap lama tetap menampilkan kalimat yang benar-benar dibaca penjawabnya.
        </span>
        <button
          type="button"
          onClick={async () => {
            if (!confirm(`Hapus ${form.title} beserta seluruh jawaban yang sudah masuk?`)) return;
            await fetch(`/api/survey/forms/${formId}`, { method: 'DELETE' });
            router.push('/admin/pengaturan');
          }}
          style={{ padding: '9px 14px', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--color-danger)', backgroundColor: '#ffffff', color: 'var(--color-danger)', fontSize: '11px', fontWeight: 700 }}
        >
          Hapus Survei
        </button>
      </div>

      {scopeOpen && (
        <SurveyScopeModal
          form={form}
          classes={classes}
          onClose={() => setScopeOpen(false)}
          onSaved={() => { setScopeOpen(false); setStatus('Cakupan tersimpan'); load(); }}
        />
      )}
    </AppShell>
  );
}

/**
 * Formulir isi sebuah pertanyaan.
 *
 * Dipakai untuk menambah maupun menyunting: keduanya meminta field yang sama,
 * dan dua formulir terpisah berarti dua tempat memperbaiki setiap kali
 * fieldnya berubah.
 *
 * The body form for one question.
 *
 * Used for both adding and editing: both ask for the same fields, and two
 * separate forms would mean two places to fix whenever a field changes.
 */
function QuestionForm({
  draft,
  setDraft,
  busy,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  busy: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const field: React.CSSProperties = {
    padding: '9px 11px', borderRadius: '8px',
    border: '1px solid var(--color-border)', fontSize: '12px', width: '100%',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '13px', borderRadius: '10px', border: '1px solid var(--color-primary)', backgroundColor: '#ffffff' }}>
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        {(Object.keys(SURVEY_QUESTION_LABELS) as SurveyQuestionKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setDraft({ ...draft, kind: k })}
            aria-pressed={draft.kind === k}
            style={{
              padding: '5px 11px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontSize: '10px', fontWeight: draft.kind === k ? 700 : 400,
              backgroundColor: draft.kind === k ? 'var(--color-primary)' : 'var(--color-border)',
              color: draft.kind === k ? '#ffffff' : 'var(--color-text-main)',
            }}
          >
            {SURVEY_QUESTION_LABELS[k]}
          </button>
        ))}
      </div>

      <textarea
        value={draft.text}
        onChange={(e) => setDraft({ ...draft, text: e.target.value })}
        placeholder="Materi hari ini mudah dipahami?"
        aria-label="Pertanyaan"
        rows={2}
        autoFocus
        style={{ ...field, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55 }}
      />

      {draft.kind === 'pilihan' && (
        <>
          {draft.options.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              <input
                value={o}
                onChange={(e) => setDraft({ ...draft, options: draft.options.map((v, j) => (j === i ? e.target.value : v)) })}
                placeholder={`Pilihan ${i + 1}`}
                aria-label={`Pilihan ${i + 1}`}
                style={field}
              />
              {draft.options.length > 2 && (
                <button
                  type="button"
                  aria-label={`Hapus pilihan ${i + 1}`}
                  onClick={() => setDraft({ ...draft, options: draft.options.filter((_, j) => j !== i) })}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                >
                  <X size={12} color="var(--color-danger)" strokeWidth={2} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDraft({ ...draft, options: [...draft.options, ''] })}
            style={{ alignSelf: 'flex-start', border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: '10px', fontWeight: 600, color: 'var(--color-primary)' }}
          >
            + Tambah pilihan
          </button>
        </>
      )}

      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '11px', color: 'var(--color-text-main)', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={draft.required}
          onChange={(e) => setDraft({ ...draft, required: e.target.checked })}
          style={{ margin: 0 }}
        />
        Wajib dijawab
      </label>

      <div style={{ display: 'flex', gap: '7px', justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onCancel} disabled={busy} style={{ fontSize: '11px', padding: '8px 13px' }}>
          Batal
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={busy || !draft.text.trim()}
          style={{ fontSize: '11px', padding: '8px 13px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
        >
          <Check size={12} strokeWidth={2.5} />
          {busy ? 'Menyimpan...' : submitLabel}
        </Button>
      </div>
    </div>
  );
}
