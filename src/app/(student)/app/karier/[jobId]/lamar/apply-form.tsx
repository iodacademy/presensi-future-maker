'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, FileText, Upload } from 'lucide-react';
import {
  PERSONAL_LABELS, type AttachedTask, type AttachedWork, type CvFile, type CvKind, type JobDocuments, type JobQuestion, type Personal,
} from '@/features/careers/model';
import { BLUE, btnGhost, btnOutline, btnPrimary, card, errorBox, fieldLabel, getJson, heading, hint, input, LINE, MUTED } from '../../ui';

type Ctx = {
  job: { id: string; title: string; partnerName: string; documents: JobDocuments; questions: JobQuestion[] };
  personal: Personal; className: string; cvs: CvFile[]; covers: CvFile[]; works: AttachedWork[]; tasks: AttachedTask[];
};
type Draft = { personal: Personal; cvId: string; coverLetterId: string; portfolioUrl: string; workIds: string[]; submissionIds: string[]; answers: Record<string, string> };
type Step = 'data' | 'dokumen' | 'pertanyaan' | 'periksa';

const TASK_KIND: Record<string, string> = { daily: 'Tugas harian', 'working-paper': 'Working paper', capstone: 'Capstone' };
const FIELDS: [keyof Personal, string, string?][] = [
  ['fullName', 'Nama lengkap'], ['email', 'Email'], ['phone', 'No. WhatsApp aktif', '08xxxxxxxxxx'], ['city', 'Domisili (kota)', 'mis. Jakarta Selatan'],
  ['school', 'Asal sekolah / kampus'], ['major', 'Jurusan'],
];
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Draf disimpan di peramban; akses penyimpanan bisa gagal di jendela privat / The draft lives in the browser; storage can fail in a private window
const store = {
  get(key: string): Partial<Draft> | null { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } },
  set(key: string, v: Draft) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* abaikan / ignore */ } },
  drop(key: string) { try { localStorage.removeItem(key); } catch { /* abaikan / ignore */ } },
};

/**
 * Formulir lamaran bertahap. Server tetap memeriksa ulang semuanya; pemeriksaan
 * di sini hanya agar siswa tahu apa yang kurang sebelum menekan kirim.
 *
 * Step-by-step application form. The server re-checks everything; the checks
 * here only tell the student what is missing before they press send.
 */
export function ApplyForm({ jobId }: { jobId: string }) {
  const key = `karier-draf-${jobId}`;
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState<Step>('data');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    getJson<Ctx>(`/api/karier/lamar?jobId=${encodeURIComponent(jobId)}`).then((c) => {
      const saved = store.get(key);
      setCtx(c);
      setDraft({
        personal: { ...c.personal, ...Object.fromEntries(Object.entries(saved?.personal ?? {}).filter(([, v]) => v)) } as Personal,
        cvId: saved?.cvId && c.cvs.some((x) => x.id === saved.cvId) ? saved.cvId : c.cvs[0]?.id ?? '',
        coverLetterId: saved?.coverLetterId && c.covers.some((x) => x.id === saved.coverLetterId) ? saved.coverLetterId : '',
        portfolioUrl: saved?.portfolioUrl ?? '',
        workIds: (saved?.workIds ?? []).filter((id) => c.works.some((w) => w.id === id)),
        submissionIds: (saved?.submissionIds ?? []).filter((id) => c.tasks.some((t) => t.submissionId === id)),
        answers: saved?.answers ?? {},
      });
    }).catch((e) => setError(e.message));
  }, [jobId, key]);

  useEffect(() => { if (draft && !done) store.set(key, draft); }, [draft, key, done]);

  if (done) {
    return (
      <div style={{ ...card, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px 24px' }}>
        <CheckCircle2 size={48} color="#067647" aria-hidden />
        <h2 style={{ ...heading, fontSize: '22px' }}>Lamaran terkirim</h2>
        <p style={{ margin: 0, maxWidth: '520px' }}>
          Lamaranmu untuk <b>{ctx?.job.title}</b> sudah masuk ke PIC <b>{ctx?.job.partnerName}</b>. Pantau statusnya di tab Lamaran Saya.
        </p>
        <p style={{ margin: 0, color: MUTED, fontSize: '13px' }}>No. lamaran: {done}</p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/app/karier?tab=lamaran" style={btnPrimary}>Lihat status lamaran</Link>
          <Link href="/app/karier" style={btnOutline}>Cari lowongan lain</Link>
        </div>
      </div>
    );
  }
  if (!ctx || !draft) return error ? <div role="alert" style={errorBox}>{error}</div> : <p style={{ color: MUTED }}>Memuat formulir…</p>;

  const { documents: docs, questions } = ctx.job;
  const steps: Step[] = questions.length ? ['data', 'dokumen', 'pertanyaan', 'periksa'] : ['data', 'dokumen', 'periksa'];
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const setP = (patch: Partial<Personal>) => set({ personal: { ...draft.personal, ...patch } });
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  function check(s: Step): string | null {
    if (s === 'data') {
      const miss = PERSONAL_LABELS.find(([k]) => !draft!.personal[k].trim());
      return miss ? `Lengkapi data diri: ${miss[1]}` : null;
    }
    if (s === 'dokumen') {
      if (!draft!.cvId) return 'Pilih atau unggah CV';
      if (docs.portfolio === 'required' && !draft!.portfolioUrl.trim()) return 'Link portofolio wajib diisi';
      if (docs.works === 'required' && draft!.workIds.length + draft!.submissionIds.length === 0) return 'Lampirkan minimal satu karya atau tugas';
      if (docs.coverLetter === 'required' && !draft!.coverLetterId) return 'Surat lamaran wajib diunggah';
    }
    if (s === 'pertanyaan') {
      const miss = questions.find((q) => q.required && !(draft!.answers[q.id] ?? '').trim());
      if (miss) return `Jawab pertanyaan: ${miss.label}`;
    }
    return null;
  }
  function next() {
    const msg = check(step);
    setError(msg);
    if (!msg) setStep(steps[steps.indexOf(step) + 1]);
  }
  function back() { setError(null); setStep(steps[Math.max(0, steps.indexOf(step) - 1)]); }

  async function upload(kind: CvKind, file: File) {
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.append('file', file); form.append('kind', kind);
      const { cv } = await getJson<{ cv: CvFile }>('/api/karier/cv', { method: 'POST', body: form });
      if (kind === 'cv') { setCtx({ ...ctx!, cvs: [cv, ...ctx!.cvs] }); set({ cvId: cv.id }); } else { setCtx({ ...ctx!, covers: [cv, ...ctx!.covers] }); set({ coverLetterId: cv.id }); }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove(kind: CvKind, id: string) {
    if (!window.confirm('Hapus berkas ini dari daftarmu? Lamaran yang sudah terkirim tetap memakai berkasnya.')) return;
    try {
      await getJson(`/api/karier/cv/${id}`, { method: 'DELETE' });
      if (kind === 'cv') { setCtx({ ...ctx!, cvs: ctx!.cvs.filter((c) => c.id !== id) }); if (draft!.cvId === id) set({ cvId: '' }); } else { setCtx({ ...ctx!, covers: ctx!.covers.filter((c) => c.id !== id) }); if (draft!.coverLetterId === id) set({ coverLetterId: '' }); }
    } catch (e) { setError((e as Error).message); }
  }
  async function submit() {
    setBusy(true); setError(null);
    try {
      const r = await getJson<{ number: string }>('/api/karier/lamar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, ...draft, coverLetterId: draft!.coverLetterId || null }),
      });
      store.drop(key);
      setDone(r.number);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const docLabel = (rule: string) => (rule === 'required' ? ' · wajib' : ' (opsional)');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <ol aria-label="Langkah lamaran" style={{ display: 'flex', gap: '8px', listStyle: 'none', padding: 0, margin: 0, flexWrap: 'wrap' }}>
        {steps.map((s, i) => (
          <li key={s} aria-current={s === step ? 'step' : undefined}
            style={{ padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, backgroundColor: s === step ? BLUE : '#EEF2F5', color: s === step ? '#fff' : MUTED }}>
            {i + 1}. {{ data: 'Data diri', dokumen: 'Dokumen', pertanyaan: 'Pertanyaan', periksa: 'Periksa' }[s]}
          </li>
        ))}
      </ol>

      {error && <div role="alert" style={errorBox}>{error}</div>}

      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {step === 'data' && (
          <>
            <div><h2 style={{ ...heading, fontSize: '18px' }}>Data diri</h2><p style={{ ...hint, margin: '4px 0 0' }}>Diisi otomatis dari profil Future Makers. Periksa dan lengkapi.</p></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              {FIELDS.map(([k, l, ph]) => (
                <label key={k} style={fieldLabel}>{l}
                  <input value={draft.personal[k]} onChange={(e) => setP({ [k]: e.target.value })} placeholder={ph} style={input} type={k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text'} />
                </label>
              ))}
              <label style={fieldLabel}>Kelas Future Makers<input value={ctx.className} readOnly style={{ ...input, backgroundColor: '#F8FAFB' }} /></label>
              <label style={fieldLabel}>LinkedIn <span style={hint}>(opsional)</span>
                <input value={draft.personal.linkedin} onChange={(e) => setP({ linkedin: e.target.value })} placeholder="linkedin.com/in/…" style={input} />
              </label>
            </div>
          </>
        )}

        {step === 'dokumen' && (
          <>
            <div><h2 style={{ ...heading, fontSize: '18px' }}>Dokumen</h2><p style={{ ...hint, margin: '4px 0 0' }}>Yang bertanda wajib harus diisi sebelum lanjut.</p></div>
            <FilePicker title="CV · wajib" kind="cv" files={ctx.cvs} selected={draft.cvId} busy={busy}
              onSelect={(id) => set({ cvId: id })} onUpload={(f) => upload('cv', f)} onRemove={(id) => remove('cv', id)} />
            {docs.portfolio !== 'off' && (
              <label style={fieldLabel}>Link portofolio{docLabel(docs.portfolio)}
                <input value={draft.portfolioUrl} onChange={(e) => set({ portfolioUrl: e.target.value })} placeholder="behance.net/…, github.com/…, atau Google Drive" style={input} />
              </label>
            )}
            {docs.works !== 'off' && (
              <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <legend style={{ ...fieldLabel, marginBottom: '8px' }}>Lampirkan karya dari Pameran dan tugas{docLabel(docs.works)}</legend>
                {ctx.works.length + ctx.tasks.length === 0 && <p style={{ ...hint, margin: 0 }}>Belum ada karya terbit atau tugas berkas yang bisa dilampirkan.</p>}
                {ctx.works.map((w) => (
                  <label key={w.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', border: `1px solid ${LINE}`, borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={draft.workIds.includes(w.id)} onChange={() => set({ workIds: toggle(draft.workIds, w.id) })} aria-label={`${w.title} · ${w.type}`} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {w.cover ? <img src={w.cover} alt="" style={{ width: 56, height: 40, objectFit: 'cover', borderRadius: 6 }} /> : <span style={{ width: 56, height: 40, borderRadius: 6, backgroundColor: '#EEF2F5' }} />}
                    <span><b style={{ fontSize: '13px' }}>{w.title}</b><br /><span style={hint}>Karya pameran · {w.type}</span></span>
                  </label>
                ))}
                {ctx.tasks.map((t) => (
                  <label key={t.submissionId} style={{ display: 'flex', gap: '10px', alignItems: 'center', border: `1px solid ${LINE}`, borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={draft.submissionIds.includes(t.submissionId)} onChange={() => set({ submissionIds: toggle(draft.submissionIds, t.submissionId) })} aria-label={`${t.title} · tugas`} />
                    <FileText size={18} color={MUTED} aria-hidden />
                    <span><b style={{ fontSize: '13px' }}>{t.title}</b><br /><span style={hint}>{TASK_KIND[t.kind] ?? 'Tugas'}</span></span>
                  </label>
                ))}
              </fieldset>
            )}
            {docs.coverLetter !== 'off' && (
              <FilePicker title={`Surat lamaran${docLabel(docs.coverLetter)}`} kind="surat" files={ctx.covers} selected={draft.coverLetterId} busy={busy} optional={docs.coverLetter !== 'required'}
                onSelect={(id) => set({ coverLetterId: id })} onUpload={(f) => upload('surat', f)} onRemove={(id) => remove('surat', id)} />
            )}
          </>
        )}

        {step === 'pertanyaan' && (
          <>
            <div><h2 style={{ ...heading, fontSize: '18px' }}>Pertanyaan dari {ctx.job.partnerName}</h2></div>
            {questions.map((q) => (
              q.kind === 'long' ? (
                <label key={q.id} style={fieldLabel}>{q.label}{q.required ? '' : ' (opsional)'}
                  <textarea rows={5} value={draft.answers[q.id] ?? ''} onChange={(e) => set({ answers: { ...draft.answers, [q.id]: e.target.value } })} style={input} placeholder="Ceritakan singkat, 50–300 kata" />
                </label>
              ) : (
                <fieldset key={q.id} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <legend style={{ ...fieldLabel, marginBottom: '6px' }}>{q.label}{q.required ? '' : ' (opsional)'}</legend>
                  {(q.kind === 'yes-no' ? ['Ya', 'Tidak'] : q.options).map((o) => (
                    <label key={o} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '14px' }}>
                      <input type="radio" name={q.id} checked={draft.answers[q.id] === o} onChange={() => set({ answers: { ...draft.answers, [q.id]: o } })} /> {o}
                    </label>
                  ))}
                </fieldset>
              )
            ))}
          </>
        )}

        {step === 'periksa' && (
          <>
            <div><h2 style={{ ...heading, fontSize: '18px' }}>Periksa lamaran</h2><p style={{ ...hint, margin: '4px 0 0' }}>Setelah dikirim, lamaran tidak bisa diubah.</p></div>
            <Review title="Data diri" onEdit={() => setStep('data')}>
              {FIELDS.map(([k, l]) => <Row key={k} k={l} v={draft.personal[k]} />)}
              <Row k="Kelas" v={ctx.className} />
              {draft.personal.linkedin && <Row k="LinkedIn" v={draft.personal.linkedin} />}
            </Review>
            <Review title="Dokumen" onEdit={() => setStep('dokumen')}>
              <Row k="CV" v={ctx.cvs.find((c) => c.id === draft.cvId)?.fileName ?? '–'} />
              {draft.portfolioUrl && <Row k="Portofolio" v={draft.portfolioUrl} />}
              {draft.coverLetterId && <Row k="Surat lamaran" v={ctx.covers.find((c) => c.id === draft.coverLetterId)?.fileName ?? '–'} />}
              <Row k="Lampiran" v={[...ctx.works.filter((w) => draft.workIds.includes(w.id)).map((w) => w.title), ...ctx.tasks.filter((t) => draft.submissionIds.includes(t.submissionId)).map((t) => t.title)].join(', ') || '–'} />
            </Review>
            {questions.length > 0 && (
              <Review title="Jawaban" onEdit={() => setStep('pertanyaan')}>
                {questions.map((q) => <Row key={q.id} k={q.label} v={draft.answers[q.id] || '–'} />)}
              </Review>
            )}
            <p style={{ ...hint, margin: 0 }}>Kamu melamar <b>{ctx.job.title}</b> di <b>{ctx.job.partnerName}</b>.</p>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', borderTop: `1px solid ${LINE}`, paddingTop: '14px' }}>
          {step === 'data' ? <Link href={`/app/karier/${jobId}`} style={btnGhost}>Batal, kembali ke detail</Link> : <button type="button" style={btnOutline} onClick={back}>Sebelumnya</button>}
          {step === 'periksa'
            ? <button type="button" style={btnPrimary} onClick={submit} disabled={busy}>{busy ? 'Mengirim…' : 'Kirim lamaran'}</button>
            : <button type="button" style={btnPrimary} onClick={next} disabled={busy}>Lanjut</button>}
        </div>
        <p style={{ ...hint, margin: 0 }}>Draf tersimpan otomatis di perangkat ini. Kamu bisa lanjutkan nanti sebelum lowongan ditutup.</p>
      </div>
    </div>
  );
}

function FilePicker({ title, kind, files, selected, busy, optional, onSelect, onUpload, onRemove }: {
  title: string; kind: CvKind; files: CvFile[]; selected: string; busy: boolean; optional?: boolean;
  onSelect: (id: string) => void; onUpload: (f: File) => void; onRemove: (id: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <legend style={{ ...fieldLabel, marginBottom: '8px' }}>{title} <span style={hint}>PDF, maks. 2 MB</span></legend>
      {files.map((f) => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', border: `1px solid ${f.id === selected ? BLUE : LINE}`, borderRadius: '8px', padding: '10px 12px', backgroundColor: f.id === selected ? '#F3F8FD' : '#fff' }}>
          <input type="radio" name={`pilih-${kind}`} checked={f.id === selected} onChange={() => onSelect(f.id)} aria-label={f.fileName} />
          <span style={{ padding: '4px 6px', borderRadius: '4px', backgroundColor: '#FDECEA', color: '#B42318', fontSize: '11px', fontWeight: 700 }}>PDF</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <a href={`/api/karier/cv/${f.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', fontWeight: 600, color: '#243c4b', wordBreak: 'break-all' }}>{f.fileName}</a>
            <br /><span style={hint}>{kb(f.size)}</span>
          </span>
          <button type="button" style={{ ...btnGhost, color: '#B42318' }} onClick={() => onRemove(f.id)}>Hapus</button>
        </div>
      ))}
      {optional && files.length > 0 && selected && <button type="button" style={{ ...btnGhost, alignSelf: 'flex-start' }} onClick={() => onSelect('')}>Jangan lampirkan</button>}
      <input ref={ref} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
      <button type="button" style={{ ...btnOutline, alignSelf: 'flex-start' }} disabled={busy} onClick={() => ref.current?.click()}>
        <Upload size={16} aria-hidden /> {busy ? 'Mengunggah…' : files.length ? `Unggah ${kind === 'cv' ? 'CV' : 'surat'} baru` : `Pilih file ${kind === 'cv' ? 'CV' : 'surat lamaran'}`}
      </button>
    </fieldset>
  );
}

function Review({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section style={{ border: `1px solid ${LINE}`, borderRadius: '10px', padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <b style={{ fontSize: '12px', letterSpacing: '.06em', color: MUTED }}>{title.toUpperCase()}</b>
        <button type="button" style={btnGhost} onClick={onEdit}>Ubah</button>
      </div>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(120px, 200px) 1fr', gap: '4px 12px', fontSize: '13px' }}>{children}</dl>
    </section>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (<><dt style={{ color: MUTED }}>{k}</dt><dd style={{ margin: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{v}</dd></>);
