'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Pencil } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { describeScope } from '@/features/survey/policy';
import type { SurveyFormDocument } from '@/features/survey/types';
import type { ClassSummary } from '@/features/classes/types';
import { ImportSoalTab } from './import-soal-tab';

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
type SettingsTab = 'survei' | 'impor-soal';

const TABS: [SettingsTab, string][] = [
  ['survei', 'Survei Pertemuan'],
  ['impor-soal', 'Impor Soal Ujian'],
];

export default function AdminPengaturanPage() {
  const [tab, setTab] = useState<SettingsTab>('survei');

  return (
    <AppShell role="admin" userName="Administrator">
      <div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
          Pengaturan
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' }}>
          Survei pertemuan dan impor soal ujian.
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
      {tab === 'impor-soal' && <ImportSoalTab />}
    </AppShell>
  );
}

/**
 * Daftar survei beserta cakupannya.
 *
 * Hanya mendaftar; seluruh penyuntingan terjadi di halaman tersendiri. Dua
 * puluh empat pertanyaan tidak muat pada baris tabel yang melebar, dan
 * menyunting teks panjang di dalam ruang selebar kolom membuat kalimatnya
 * tidak terbaca utuh saat diperiksa.
 *
 * The survey list with their scopes.
 *
 * It only lists; all editing happens on a page of its own. Twenty-four
 * questions do not fit in an expanding table row, and editing long text in a
 * column's width leaves the sentence unreadable while it is being checked.
 */
function SurveyTable() {
  const router = useRouter();
  const [forms, setForms] = useState<SurveyFormDocument[]>([]);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
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
      // Langsung masuk ke penyuntingnya. Survei baru tidak punya pertanyaan,
      // dan kembali ke tabel berarti admin harus menekan Ubah untuk
      // melanjutkan apa yang baru saja ia mulai.
      //
      // Straight into its editor. A new survey has no questions, and returning
      // to the table would have the admin press Edit to continue what they just
      // started.
      router.push(`/admin/pengaturan/survei/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
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
            Tambahkan survei, susun pertanyaannya, atur cakupannya, lalu terbitkan agar muncul pada kartu pertemuan peserta.
          </p>
        </div>
      ) : (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: 'var(--color-bg-app)', borderBottom: '1px solid var(--color-border)', fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            <span style={{ flex: 1, minWidth: 0 }}>SURVEI</span>
            <span style={{ width: '220px', flexShrink: 0 }}>CAKUPAN</span>
            <span style={{ width: '60px', flexShrink: 0, textAlign: 'center' }}>STATUS</span>
            <span style={{ width: '70px', flexShrink: 0 }} />
          </div>

          {forms.map((form, i) => (
            <div key={form.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--color-border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {form.title}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                  {form.questions.length} pertanyaan
                </div>
              </div>

              <span style={{ width: '220px', flexShrink: 0, fontSize: '10px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {describeScope(form.scope, classNames, new Map())}
              </span>

              <span style={{ width: '60px', flexShrink: 0, textAlign: 'center' }}>
                <span style={{ fontSize: '8px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', backgroundColor: form.published ? 'var(--color-success)' : 'var(--color-border)', color: form.published ? '#ffffff' : 'var(--color-text-muted)' }}>
                  {form.published ? 'TERBIT' : 'DRAF'}
                </span>
              </span>

              <span style={{ width: '70px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                <Link href={`/admin/pengaturan/survei/${form.id}`} style={{ textDecoration: 'none' }}>
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '6px 12px', borderRadius: '7px',
                      border: '1px solid var(--color-border)', backgroundColor: '#ffffff',
                      color: 'var(--color-text-main)', fontSize: '10px', fontWeight: 700,
                    }}
                  >
                    <Pencil size={11} strokeWidth={2} /> Ubah
                  </span>
                </Link>
              </span>
            </div>
          ))}
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
            {busy ? 'Membuat...' : 'Buat dan Susun'}
          </Button>
        </div>
      ) : (
        <Button variant="primary" onClick={() => setCreating(true)} style={{ fontSize: '11px', padding: '9px 14px', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <Plus size={13} strokeWidth={2} /> Tambah Survei
        </Button>
      )}
    </div>
  );
}
