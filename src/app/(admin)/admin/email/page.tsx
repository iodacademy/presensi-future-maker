'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { alertBox, api } from '../pameran/admin-ui';
import type { EmailTemplate } from '@/features/email/model';
import type { LogRow, Recipient } from '@/features/email/service';
import { SendTab } from './send-tab';
import { TemplatesTab } from './templates-tab';
import { LogsTab } from './logs-tab';

type Tab = 'kirim' | 'template' | 'terkirim';
const TABS: [Tab, string][] = [['kirim', 'Kirim'], ['template', 'Template'], ['terkirim', 'Sudah dikirim']];

/**
 * Halaman admin Email: kirim pengumuman hasil bootcamp per kelas, kelola template, dan lihat riwayat kiriman.
 *
 * Admin Email page: send bootcamp result announcements per class, manage templates, and review sent history.
 */
export default function AdminEmailPage() {
  const [tab, setTab] = useState<Tab>('kirim');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'template' || t === 'terkirim') setTab(t);
  }, []);

  const load = useCallback(async () => {
    try {
      const [t, r, l] = await Promise.all([api('/api/email/templates'), api('/api/email/recipients'), api('/api/email/logs')]);
      setTemplates(t.templates); setRecipients(r.recipients); setLogs(l.logs); setError(null);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function choose(k: Tab) {
    setTab(k);
    window.history.replaceState(null, '', `/admin/email?tab=${k}`);
  }

  return (
    <AppShell role="admin" userName="Administrator">
      <div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>Email Peserta</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' }}>
          Kirim pengumuman hasil bootcamp per kelas. Status lulus dan skema magang diambil dari dashboard.
        </p>
      </div>
      {error && <div role="alert" style={alertBox}>{error}</div>}
      <div role="tablist" style={{ display: 'flex', gap: '8px' }}>
        {TABS.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => choose(k)}
            style={{
              padding: '7px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px',
              fontWeight: tab === k ? 700 : 400,
              backgroundColor: tab === k ? 'var(--color-primary)' : 'var(--color-border)',
              color: tab === k ? '#ffffff' : 'var(--color-text-main)',
            }}>
            {l}{k === 'terkirim' && logs ? ` (${logs.length})` : ''}
          </button>
        ))}
      </div>
      {tab === 'kirim' && <SendTab recipients={recipients} templates={templates} onSent={load} onError={setError} />}
      {tab === 'template' && <TemplatesTab templates={templates} onChanged={load} onError={setError} />}
      {tab === 'terkirim' && <LogsTab logs={logs} onChanged={load} onError={setError} />}
    </AppShell>
  );
}
