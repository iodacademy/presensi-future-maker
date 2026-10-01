'use client';

import React, { useEffect, useState } from 'react';
import { Trash2, Plus, Settings2, ChevronDown, ChevronRight, X } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { SurveyScopeModal } from './survey-scope-modal';
import { describeScope } from '@/features/survey/policy';
import { SURVEY_QUESTION_LABELS, type SurveyFormDocument, type SurveyQuestionKind } from '@/features/survey/types';
import type { ClassSummary } from '@/features/classes/types';

/**
 * Pengaturan aplikasi.
 *
 * Bertab sejak awal meski baru berisi satu: menambah tab kedua kelak tidak
 * menuntut membongkar halaman yang terlanjur berbentuk satu kolom tunggal.
 *
 * Application settings.
 *
 * Tabbed from the start although it holds only one: adding a second tab later
 * then does not require tearing apart a page already shaped as a single
 * column.
 */
type SettingsTab = 'survei';

const TABS: [SettingsTab, string][] = [['survei', 'Survei Pertemuan']];

export default function AdminPengaturanPage() {
  const [tab, setTab] = useState<SettingsTab>('survei');

  return (
    <AppShell role="admin" userName="Administrator">
      <div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
          Pengaturan
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' }}>
          Survei yang diisi peserta pada kartu pertemuan, setelah kehadirannya tercatat.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map(([value, label]) => {
          const active = tab === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              aria-current={active ? 'page' : undefined}
              style={{
                padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px',
                borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
                fontWeight: active ? 700 : 400,
                color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'survei' && <SurveyTable />}
    </AppShell>
  );
}

/**
 * Daftar survei beserta cakupannya.
 *
 * Berbentuk tabel, bukan satu formulir tunggal: beberapa survei berdampingan,
 * masing-masing mengenai kelas dan pertemuan yang berbeda, dan tabel adalah
 * satu-satunya bentuk yang memperlihatkan cakupan semuanya sekaligus.
 *
 * The survey list with their scopes.
 *
 * A table rather than one single form: several surveys stand side by side, each
 * covering different classes and meetings, and a table is the only shape that
 * shows every scope at once.
 */
function SurveyTable() {
  const [forms, setForms] = useState<SurveyFormDocument[]>([]);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [sessionTitles, setSessionTitles] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [scopeFor, setScopeFor] = useState<SurveyFormDocument | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [f, c] = await Promise.all([fetch('/api/survey/forms'), fetch('/api/classes')]);
      if (f.ok) setForms((await f.json()).forms || []);
      if (c.ok) setClasses((await c.json()).classes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Judul pertemuan dimuat hanya bila ada survei yang menyebut pertemuan
  // tertentu. Survei yang mengenai seluruh pertemuan tidak memerlukannya, dan
  // memuatnya tetap berarti satu permintaan untuk keterangan yang tidak
  // ditampilkan.
  //
  // Meeting titles load only when a survey names specific meetings. A survey
  // covering every meeting needs none, and loading them anyway means a request
  // for a caption that is never shown.
  useEffect(() => {
    const perlu = forms.some((f) => f.scope.sessionIds.length > 0);
    if (!perlu || classes.length === 0) return;

    let cancelled = false;
    Promise.all(
      classes.map((c) =>
        fetch(`/api/sessions?classId=${encodeURIComponent(c.id)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => (d?.sessions ?? []) as { id: string; title: string }[])
          .catch(() => [])
      )
    ).then((hasil) => {
      if (cancelled) return;
      setSessionTitles(new Map(hasil.flat().map((s) => [s.id, s.title])));
    });

    return () => { cancelled = true; };
  }, [forms, classes]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/survey/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat survei');
      setTitle('');
      setCreating(false);
      // Survei baru langsung terbuka: kartu tertutup menyembunyikan formulir
      // pertanyaannya, sehingga survei yang baru dibuat tampak sudah selesai
      // padahal belum memuat satu pertanyaan pun.
      //
      // A new survey opens at once: a closed card hides its question form, so a
      // freshly created survey looks finished although it holds no question.
      setOpenId(data.id);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function patch(formId: string, body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/survey/forms/${formId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError((await res.json()).error || 'Gagal menyimpan');
      return;
    }
    load();
  }

  async function removeForm(form: SurveyFormDocument) {
    if (!confirm(`Hapus ${form.title} beserta seluruh jawaban yang sudah masuk?`)) return;
    await fetch(`/api/survey/forms/${form.id}`, { method: 'DELETE' });
    load();
  }

  const classNames = new Map(classes.map((c) => [c.id, c.canonicalName]));

  if (loading) {
    return <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>Memuat survei...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {error && (
        <div role="alert" style={{ padding: '9px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      {forms.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed var(--color-border)', padding: '36px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>Belum ada survei</div>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px' }}>
            Tambahkan survei, atur cakupannya, lalu terbitkan agar muncul pada kartu pertemuan peserta.
          </p>
        </div>
      ) : (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: 'var(--color-bg-app)', borderBottom: '1px solid var(--color-border)', fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            <span style={{ flex: 1, minWidth: 0 }}>SURVEI</span>
            <span style={{ width: '200px', flexShrink: 0 }}>CAKUPAN</span>
            <span style={{ width: '60px', flexShrink: 0, textAlign: 'center' }}>STATUS</span>
            <span style={{ width: '120px', flexShrink: 0 }} />
          </div>

          {forms.map((form, i) => {
            const isOpen = openId === form.id;
            return (
              <div key={form.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px' }}>
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : form.id)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Tutup' : 'Buka'} ${form.title}`}
                    style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                  >
                    {isOpen
                      ? <ChevronDown size={13} color="var(--color-primary)" strokeWidth={2} style={{ flexShrink: 0 }} />
                      : <ChevronRight size={13} color="var(--color-text-muted)" strokeWidth={2} style={{ flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {form.title}
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                        {form.questions.length} pertanyaan
                      </div>
                    </div>
                  </button>

                  <span style={{ width: '200px', flexShrink: 0, fontSize: '10px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {describeScope(form.scope, classNames, sessionTitles)}
                  </span>

                  <span style={{ width: '60px', flexShrink: 0, textAlign: 'center' }}>
                    <span style={{ fontSize: '8px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', backgroundColor: form.published ? 'var(--color-success)' : 'var(--color-border)', color: form.published ? '#ffffff' : 'var(--color-text-muted)' }}>
                      {form.published ? 'TERBIT' : 'DRAF'}
                    </span>
                  </span>

                  <span style={{ width: '120px', flexShrink: 0, display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      aria-label={`Atur cakupan ${form.title}`}
                      onClick={() => setScopeFor(form)}
                      style={{ padding: '5px 10px', borderRadius: '7px', cursor: 'pointer', border: '1px solid var(--color-border)', backgroundColor: '#ffffff', color: 'var(--color-text-main)', fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Settings2 size={11} strokeWidth={2} /> Cakupan
                    </button>
                    <button
                      type="button"
                      aria-label={`Hapus ${form.title}`}
                      onClick={() => removeForm(form)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
                    >
                      <Trash2 size={13} color="var(--color-danger)" strokeWidth={2} />
                    </button>
                  </span>
                </div>

                {isOpen && (
                  <div style={{ padding: '0 14px 14px 35px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <QuestionList form={form} onChanged={load} />
                    <AddQuestion formId={form.id} onAdded={load} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <Button
                        variant={form.published ? 'secondary' : 'primary'}
                        onClick={() => patch(form.id, { published: !form.published })}
                        style={{ fontSize: '11px', padding: '8px 14px' }}
                      >
                        {form.published ? 'Tarik dari Peserta' : 'Terbitkan'}
                      </Button>
                      <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                        Pertanyaan boleh diubah kapan saja. Jawaban yang sudah masuk menyimpan salinan pertanyaannya sendiri.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {creating ? (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff' }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Umpan Balik Pertemuan"
            aria-label="Judul survei"
            autoFocus
            style={{ flex: '1 1 220px', padding: '9px 11px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px' }}
          />
          <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy} style={{ fontSize: '11px', padding: '9px 12px' }}>Batal</Button>
          <Button variant="primary" onClick={create} disabled={busy || !title.trim()} style={{ fontSize: '11px', padding: '9px 12px' }}>
            {busy ? 'Membuat...' : 'Buat'}
          </Button>
        </div>
      ) : (
        <Button variant="primary" onClick={() => setCreating(true)} style={{ fontSize: '11px', padding: '9px 14px', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <Plus size={13} strokeWidth={2} /> Tambah Survei
        </Button>
      )}

      {scopeFor && (
        <SurveyScopeModal
          form={scopeFor}
          classes={classes}
          onClose={() => setScopeFor(null)}
          onSaved={() => { setScopeFor(null); load(); }}
        />
      )}
    </div>
  );
}

function QuestionList({ form, onChanged }: { form: SurveyFormDocument; onChanged: () => void }) {
  async function remove(questionId: string) {
    await fetch(`/api/survey/forms/${form.id}/questions/${questionId}`, { method: 'DELETE' });
    onChanged();
  }

  if (form.questions.length === 0) {
    return (
      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
        Belum ada pertanyaan. Tambahkan di bawah, lalu terbitkan.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {form.questions.map((q, i) => (
        <div key={q.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '9px 11px', borderRadius: '8px', backgroundColor: 'var(--color-bg-app)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-main)' }}>
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
            aria-label={`Hapus pertanyaan ${i + 1}`}
            onClick={() => remove(q.id)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
          >
            <X size={12} color="var(--color-danger)" strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}

function AddQuestion({ formId, onAdded }: { formId: string; onAdded: () => void }) {
  const [kind, setKind] = useState<SurveyQuestionKind>('rating');
  const [text, setText] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [required, setRequired] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/survey/forms/${formId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, text, options, required }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah pertanyaan');
      setText('');
      setOptions(['', '']);
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field: React.CSSProperties = {
    padding: '8px 10px', borderRadius: '8px',
    border: '1px solid var(--color-border)', fontSize: '11px', width: '100%',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', padding: '11px', borderRadius: '8px', border: '1px dashed var(--color-border)' }}>
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        {(Object.keys(SURVEY_QUESTION_LABELS) as SurveyQuestionKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            style={{
              padding: '5px 11px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontSize: '10px', fontWeight: kind === k ? 700 : 400,
              backgroundColor: kind === k ? 'var(--color-primary)' : 'var(--color-border)',
              color: kind === k ? '#ffffff' : 'var(--color-text-main)',
            }}
          >
            {SURVEY_QUESTION_LABELS[k]}
          </button>
        ))}
      </div>

      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Materi hari ini mudah dipahami?" aria-label="Pertanyaan" style={field} />

      {kind === 'pilihan' && (
        <>
          {options.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              <input
                value={o}
                onChange={(e) => setOptions(options.map((v, j) => (j === i ? e.target.value : v)))}
                placeholder={`Pilihan ${i + 1}`}
                aria-label={`Pilihan ${i + 1}`}
                style={field}
              />
              {options.length > 2 && (
                <button type="button" aria-label={`Hapus pilihan ${i + 1}`} onClick={() => setOptions(options.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}>
                  <X size={12} color="var(--color-danger)" strokeWidth={2} />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setOptions([...options, ''])} style={{ alignSelf: 'flex-start', border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: '10px', fontWeight: 600, color: 'var(--color-primary)' }}>
            + Tambah pilihan
          </button>
        </>
      )}

      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--color-text-main)', cursor: 'pointer' }}>
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} style={{ margin: 0 }} />
        Wajib dijawab
      </label>

      {error && <div role="alert" style={{ fontSize: '10px', color: 'var(--color-danger)' }}>{error}</div>}

      <Button variant="secondary" onClick={add} disabled={busy || !text.trim()} style={{ fontSize: '10px', padding: '7px 12px', alignSelf: 'flex-start' }}>
        {busy ? 'Menyimpan...' : '+ Tambah Pertanyaan'}
      </Button>
    </div>
  );
}
