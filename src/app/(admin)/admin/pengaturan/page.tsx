'use client';

import React, { useEffect, useState } from 'react';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { SURVEY_QUESTION_LABELS, type SurveyFormDocument, type SurveyQuestionKind } from '@/features/survey/types';

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
          Berlaku untuk seluruh kelas dan seluruh pertemuan.
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

      {tab === 'survei' && <SurveyEditor />}
    </AppShell>
  );
}

/**
 * Penyusun formulir survei.
 *
 * Satu formulir dipakai seluruh kelas dan seluruh pertemuan. Sesi mana yang
 * dinilai tercatat pada jawabannya, sehingga pertanyaannya tidak perlu disalin
 * lima puluh lima kali.
 *
 * The survey form editor.
 *
 * One form serves every class and every meeting. Which session is being rated
 * is recorded on the response, so the questions need not be copied fifty-five
 * times.
 */
function SurveyEditor() {
  const [form, setForm] = useState<SurveyFormDocument | null>(null);
  const [kind, setKind] = useState<SurveyQuestionKind>('skala');
  const [text, setText] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [required, setRequired] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/survey/form');
    if (res.ok) setForm((await res.json()).form);
  }

  useEffect(() => { load(); }, []);

  async function addQuestion() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/survey/form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, text, options, required }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah pertanyaan');
      setText('');
      setOptions(['', '']);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeQuestion(questionId: string) {
    await fetch(`/api/survey/questions/${questionId}`, { method: 'DELETE' });
    load();
  }

  async function patch(body: Record<string, unknown>, pesan: string) {
    setError(null);
    const res = await fetch('/api/survey/form', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError((await res.json()).error || 'Gagal menyimpan');
      return;
    }
    setStatus(pesan);
    load();
  }

  if (!form) {
    return <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>Memuat formulir...</div>;
  }

  const field: React.CSSProperties = {
    padding: '9px 11px', borderRadius: '8px',
    border: '1px solid var(--color-border)', fontSize: '11px', width: '100%',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '640px' }}>
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

      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>{form.title}</div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {form.questions.length} pertanyaan - dipakai seluruh kelas dan pertemuan
            </div>
          </div>
          <span
            style={{
              fontSize: '8px', fontWeight: 700, padding: '4px 10px', borderRadius: '10px', whiteSpace: 'nowrap',
              backgroundColor: form.published ? 'var(--color-success)' : 'var(--color-border)',
              color: form.published ? '#ffffff' : 'var(--color-text-muted)',
            }}
          >
            {form.published ? 'TERBIT' : 'DRAF'}
          </span>
        </div>

        {form.questions.length === 0 ? (
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', padding: '8px 0' }}>
            Belum ada pertanyaan. Tambahkan di bawah, lalu terbitkan agar muncul pada kartu pertemuan peserta.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {form.questions.map((q, i) => (
              <div key={q.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderRadius: '8px', backgroundColor: 'var(--color-bg-app)' }}>
                <GripVertical size={13} color="var(--color-text-faint)" strokeWidth={2} style={{ flexShrink: 0, marginTop: '1px' }} />
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
                  onClick={() => removeQuestion(q.id)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                >
                  <Trash2 size={12} color="var(--color-danger)" strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Perubahan pertanyaan tidak merusak rekap lama: tiap jawaban
            menyimpan salinan pertanyaannya sendiri, sehingga jawaban lama tetap
            terbaca di bawah kalimat yang benar-benar dibacanya.

            Changing the questions does not break old reports: each answer keeps
            its own copy of the question, so an old answer stays readable
            beneath the sentence its author actually read. */}
        <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          Pertanyaan boleh diubah kapan saja. Jawaban yang sudah masuk menyimpan salinan pertanyaannya sendiri, jadi rekap lama tetap terbaca benar.
        </div>

        <Button
          variant={form.published ? 'secondary' : 'primary'}
          onClick={() => patch({ published: !form.published }, form.published ? 'Survei ditarik dari peserta' : 'Survei diterbitkan')}
          style={{ fontSize: '11px', padding: '9px 14px', alignSelf: 'flex-start' }}
        >
          {form.published ? 'Tarik dari Peserta' : 'Terbitkan'}
        </Button>
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)' }}>TAMBAH PERTANYAAN</div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {(Object.keys(SURVEY_QUESTION_LABELS) as SurveyQuestionKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              style={{
                padding: '5px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                fontSize: '10px', fontWeight: kind === k ? 700 : 400,
                backgroundColor: kind === k ? 'var(--color-primary)' : 'var(--color-border)',
                color: kind === k ? '#ffffff' : 'var(--color-text-main)',
              }}
            >
              {SURVEY_QUESTION_LABELS[k]}
            </button>
          ))}
        </div>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Materi hari ini mudah dipahami?"
          aria-label="Pertanyaan"
          style={field}
        />

        {kind === 'pilihan' && (
          <>
            {options.map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  value={o}
                  onChange={(e) => setOptions(options.map((v, j) => (j === i ? e.target.value : v)))}
                  placeholder={`Pilihan ${i + 1}`}
                  aria-label={`Pilihan ${i + 1}`}
                  style={field}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    aria-label={`Hapus pilihan ${i + 1}`}
                    onClick={() => setOptions(options.filter((_, j) => j !== i))}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                  >
                    <Trash2 size={12} color="var(--color-danger)" strokeWidth={2} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setOptions([...options, ''])}
              style={{ alignSelf: 'flex-start', border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: '10px', fontWeight: 600, color: 'var(--color-primary)' }}
            >
              + Tambah pilihan
            </button>
          </>
        )}

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '11px', color: 'var(--color-text-main)', cursor: 'pointer' }}>
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} style={{ margin: 0 }} />
          Wajib dijawab
        </label>

        <Button
          variant="primary"
          onClick={addQuestion}
          disabled={busy || !text.trim()}
          style={{ fontSize: '11px', padding: '9px 14px', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
        >
          <Plus size={12} strokeWidth={2} />
          {busy ? 'Menyimpan...' : 'Tambah Pertanyaan'}
        </Button>
      </div>
    </div>
  );
}
