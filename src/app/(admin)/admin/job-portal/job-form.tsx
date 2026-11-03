'use client';

import React, { useEffect, useState } from 'react';
import { alertBox, api, btn, btnSolid, card, field, label, send } from '../pameran/admin-ui';
import type { PartnerRow } from '@/features/careers/admin-service';
import { JobCard } from '@/features/careers/job-card';
import {
  CATEGORY_LABELS, DOC_RULE_LABELS, EMPLOYMENT_LABELS, isoToWib, QUESTION_KIND_LABELS, salaryUnit, SCHEME_LABELS, WORK_MODE_LABELS,
  type Category, type DocRule, type Employment, type Job, type JobDocuments, type QuestionKind, type Scheme, type WorkMode,
} from '@/features/careers/model';

type Q = { id: string; label: string; kind: QuestionKind; optionsText: string; required: boolean };
type ClassOpt = { id: string; canonicalName: string };

const DOCS: [keyof JobDocuments, string][] = [['portfolio', 'Link portofolio'], ['works', 'Karya pameran & tugas'], ['coverLetter', 'Surat lamaran']];
const section: React.CSSProperties = { fontSize: '12px', fontWeight: 700, margin: '8px 0 0', color: 'var(--color-text-main)' };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' };
const muted: React.CSSProperties = { fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '10px' };

function options<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((k) => <option key={k} value={k}>{labels[k]}</option>);
}

/**
 * Formulir tambah dan ubah lowongan, dengan pratinjau kartu seperti tampil di portal siswa.
 *
 * Add and edit form for a job, with a card preview as it appears in the student portal.
 */
export function JobForm({ id, onDone }: { id: string | null; onDone: () => void }) {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [title, setTitle] = useState('');
  const [employment, setEmployment] = useState<Employment>('magang-3');
  const [category, setCategory] = useState<Category>('teknologi');
  const [scheme, setScheme] = useState<Scheme>('project');
  const [location, setLocation] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode>('hybrid');
  const [quota, setQuota] = useState(1);
  const [salary, setSalary] = useState('');
  const [description, setDescription] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [eligMode, setEligMode] = useState<'all' | 'classes' | 'min-score'>('all');
  const [classIds, setClassIds] = useState<string[]>([]);
  const [minScore, setMinScore] = useState(70);
  const [opens, setOpens] = useState({ date: '', time: '08:00' });
  const [closes, setCloses] = useState({ date: '', time: '23:59' });
  const [documents, setDocuments] = useState<JobDocuments>({ portfolio: 'optional', works: 'optional', coverLetter: 'off' });
  const [questions, setQuestions] = useState<Q[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    api('/api/karier/partners').then((d) => setPartners(d.partners)).catch((e) => setError(e.message));
    api('/api/classes').then((d) => setClasses(d.classes)).catch(() => setClasses([]));
    if (!id) return;
    api(`/api/karier/jobs/${id}`).then(({ job: j }: { job: Job }) => {
      setPartnerId(j.partnerId); setTitle(j.title); setEmployment(j.employment); setCategory(j.category); setScheme(j.scheme ?? 'project');
      setLocation(j.location); setWorkMode(j.workMode); setQuota(j.quota); setDescription(j.description);
      setSalary(j.salary ? String(j.salary) : '');
      setQualifications(j.qualifications.join('\n')); setEligMode(j.eligibility.mode);
      if (j.eligibility.mode === 'classes') setClassIds(j.eligibility.classIds);
      if (j.eligibility.mode === 'min-score') setMinScore(j.eligibility.minScore);
      setOpens(isoToWib(j.opensAt)); setCloses(isoToWib(j.closesAt)); setDocuments(j.documents);
      setQuestions(j.questions.map((q) => ({ ...q, optionsText: q.options.join('\n') })));
    }).catch((e) => setError(e.message));
  }, [id]);

  const setQ = (i: number, patch: Partial<Q>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const partnerName = partners.find((p) => p.id === partnerId)?.name ?? '';
  const partnerLogo = partners.find((p) => p.id === partnerId)?.logoThumb || null;
  const previewClose = closes.date ? new Date(`${closes.date}T${closes.time || '23:59'}:00+07:00`).toISOString() : now.toISOString();

  async function save(status: 'draft' | 'published') {
    setBusy(true); setError(null);
    try {
      const body = {
        partnerId, title, employment, category, scheme, location, workMode, quota, description, qualifications, salary,
        eligibility: eligMode === 'classes' ? { mode: 'classes', classIds } : eligMode === 'min-score' ? { mode: 'min-score', minScore } : { mode: 'all' },
        opensAt: opens, closesAt: closes, documents, status,
        questions: questions.map((q) => ({ id: q.id, label: q.label, kind: q.kind, options: q.optionsText, required: q.required })),
      };
      if (id) await send(`/api/karier/jobs/${id}`, 'PATCH', body);
      else await send('/api/karier/jobs', 'POST', body);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <form onSubmit={(e) => { e.preventDefault(); save('published'); }} style={{ ...card, flex: '1 1 480px' }}>
        <button type="button" onClick={onDone} style={{ ...btn, alignSelf: 'flex-start', border: 'none', padding: 0 }}>← Kembali ke daftar lowongan</button>
        <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>{id ? 'Ubah lowongan' : 'Tambah lowongan'}</h2>
        {error && <div role="alert" style={alertBox}>{error}</div>}

        <h3 style={section}>1. Perusahaan</h3>
        <label style={label}>Nama perusahaan (mitra)
          <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} style={field} required>
            <option value="">Pilih mitra</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {partnerId && <span style={muted}>Semua lamaran untuk lowongan ini masuk ke PIC {partnerName}.</span>}
        </label>

        <h3 style={section}>2. Detail posisi</h3>
        <label style={label}>Nama posisi / role<input value={title} onChange={(e) => setTitle(e.target.value)} style={field} placeholder="mis. UI/UX Designer Intern" required /></label>
        <div style={grid}>
          <label style={label}>Jenis<select value={employment} onChange={(e) => setEmployment(e.target.value as Employment)} style={field}>{options(EMPLOYMENT_LABELS)}</select></label>
          <label style={label}>Bidang<select value={category} onChange={(e) => setCategory(e.target.value as Category)} style={field}>{options(CATEGORY_LABELS)}</select></label>
          <label style={label}>Skema magang
            <select value={scheme} onChange={(e) => setScheme(e.target.value as Scheme)} style={field}>{options(SCHEME_LABELS)}</select>
            <span style={muted}>{scheme === 'full' ? 'Hanya kandidat Full Internship.' : 'Peserta Project Based dan Full Internship.'}</span>
          </label>
          <label style={label}>Lokasi<input value={location} onChange={(e) => setLocation(e.target.value)} style={field} placeholder="mis. Jakarta Selatan" required /></label>
          <label style={label}>Mode kerja<select value={workMode} onChange={(e) => setWorkMode(e.target.value as WorkMode)} style={field}>{options(WORK_MODE_LABELS)}</select></label>
          <label style={label}>Kuota diterima<input type="number" min={1} value={quota} onChange={(e) => setQuota(Number(e.target.value))} style={field} /></label>
          <label style={label}>{`Gaji (Rp/${salaryUnit(scheme)})`}<input type="number" min={1} step={1} value={salary} onChange={(e) => setSalary(e.target.value)} style={field} placeholder="mis. 2000000" />
            <span style={muted}>Kosongkan bila gaji dirahasiakan.</span>
          </label>
        </div>
        <label style={label}>Deskripsi pekerjaan<textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} style={field} placeholder="Apa yang dikerjakan, dengan tim siapa" /></label>
        <label style={label}>Kualifikasi<textarea rows={4} value={qualifications} onChange={(e) => setQualifications(e.target.value)} style={field} placeholder="Satu kualifikasi per baris" /></label>

        <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <legend style={{ ...label, marginBottom: '4px' }}>Bisa dilamar oleh</legend>
          {([['all', 'Semua peserta & alumni'], ['classes', 'Kelas tertentu saja'], ['min-score', 'Peserta dengan nilai akhir minimal …']] as const).map(([k, l]) => (
            <label key={k} style={{ fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input type="radio" name="elig" checked={eligMode === k} onChange={() => setEligMode(k)} /> {l}
            </label>
          ))}
          {eligMode === 'classes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '20px' }}>
              {classes.map((c) => (
                <label key={c.id} style={{ fontSize: '12px', display: 'flex', gap: '6px' }}>
                  <input type="checkbox" checked={classIds.includes(c.id)}
                    onChange={(e) => setClassIds(e.target.checked ? [...classIds, c.id] : classIds.filter((x) => x !== c.id))} /> {c.canonicalName}
                </label>
              ))}
            </div>
          )}
          {eligMode === 'min-score' && (
            <label style={{ ...label, paddingLeft: '20px', maxWidth: '200px' }}>Nilai akhir minimal
              <input type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} style={field} />
            </label>
          )}
        </fieldset>

        <h3 style={section}>3. Periode & isian lamaran</h3>
        <div style={grid}>
          <label style={label}>Dibuka (WIB)
            <span style={{ display: 'flex', gap: '6px' }}>
              <input type="date" value={opens.date} onChange={(e) => setOpens({ ...opens, date: e.target.value })} style={field} required />
              <input type="time" value={opens.time} onChange={(e) => setOpens({ ...opens, time: e.target.value })} style={field} />
            </span>
          </label>
          <label style={label}>Ditutup (WIB, dasar hitung mundur siswa)
            <span style={{ display: 'flex', gap: '6px' }}>
              <input type="date" value={closes.date} onChange={(e) => setCloses({ ...closes, date: e.target.value })} style={field} required />
              <input type="time" value={closes.time} onChange={(e) => setCloses({ ...closes, time: e.target.value })} style={field} />
            </span>
          </label>
        </div>

        <div style={label}>Dokumen yang diminta
          <span style={muted}>CV selalu wajib.</span>
          <div style={grid}>
            {DOCS.map(([k, l]) => (
              <label key={k} style={label}>{l}
                <select value={documents[k]} onChange={(e) => setDocuments({ ...documents, [k]: e.target.value as DocRule })} style={field}>{options(DOC_RULE_LABELS)}</select>
              </label>
            ))}
          </div>
        </div>

        <div style={label}>Pertanyaan tambahan untuk pelamar
          {questions.map((q, i) => (
            <div key={q.id || `baru-${i}`} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input value={q.label} onChange={(e) => setQ(i, { label: e.target.value })} style={field} placeholder="mis. Kenapa kamu tertarik dengan posisi ini?" aria-label={`Pertanyaan ${i + 1}`} />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={q.kind} onChange={(e) => setQ(i, { kind: e.target.value as QuestionKind })} style={{ ...field, width: 'auto' }} aria-label={`Jenis pertanyaan ${i + 1}`}>{options(QUESTION_KIND_LABELS)}</select>
                <label style={{ fontSize: '12px', display: 'flex', gap: '6px', fontWeight: 400 }}>
                  <input type="checkbox" checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} /> Wajib dijawab
                </label>
                <button type="button" style={{ ...btn, marginLeft: 'auto' }} onClick={() => setQuestions(questions.filter((_, j) => j !== i))}>Hapus</button>
              </div>
              {q.kind === 'choice' && (
                <textarea rows={3} value={q.optionsText} onChange={(e) => setQ(i, { optionsText: e.target.value })} style={field} placeholder="Satu opsi per baris" aria-label={`Opsi pertanyaan ${i + 1}`} />
              )}
            </div>
          ))}
          <button type="button" style={{ ...btn, alignSelf: 'flex-start' }}
            onClick={() => setQuestions([...questions, { id: '', label: '', kind: 'long', optionsText: '', required: true }])}>+ Tambah pertanyaan</button>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" style={btn} onClick={onDone}>Batal</button>
          <button type="button" style={btn} disabled={busy} onClick={() => save('draft')}>Simpan draf</button>
          <button type="submit" style={btnSolid} disabled={busy}>Publikasikan</button>
        </div>
      </form>

      <aside style={{ flex: '0 1 340px', position: 'sticky', top: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.06em', color: 'var(--color-text-muted)' }}>PRATINJAU DI PORTAL SISWA</div>
        <JobCard job={{ title, partnerName, employment, scheme, location, workMode, quota, closesAt: previewClose, salary: Number(salary) || null }} logo={partnerLogo} now={now} />
      </aside>
    </div>
  );
}
