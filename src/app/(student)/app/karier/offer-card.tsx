'use client';

import React, { useState } from 'react';
import { btnOutline, btnPrimary, errorBox, getJson, LINE, MUTED } from './ui';

/**
 * Kartu tawaran magang di Lamaran Saya. Menerima satu tawaran menutup semua
 * lamaran lain, jadi siswa diminta menegaskan pilihannya lebih dulu.
 *
 * The internship offer card in Lamaran Saya. Accepting one offer closes every
 * other application, so the student is asked to confirm the choice first.
 */
export function OfferCard({ appId, jobTitle, partnerName, onAnswered }: { appId: string; jobTitle: string; partnerName: string; onAnswered: () => void }) {
  const [asking, setAsking] = useState<'terima' | 'tolak' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function answer(response: 'terima' | 'tolak') {
    setBusy(true); setError(null);
    try {
      await getJson(`/api/karier/lamaran/${appId}/tawaran`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response }) });
      onAnswered();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div style={{ border: `1px solid #A6F4C5`, borderRadius: '10px', padding: '14px', backgroundColor: '#ECFDF3', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <b style={{ fontSize: '14px', color: '#067647' }}>Selamat, kamu lolos seleksi {jobTitle} di {partnerName}!</b>
      <p style={{ margin: 0, fontSize: '13px' }}>Mau mengambil tawaran magang ini? Setelah kamu menerima, mitra akan menghubungimu untuk kontrak magang dan onboarding.</p>
      {error && <div role="alert" style={errorBox}>{error}</div>}
      {asking ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: `1px solid ${LINE}`, paddingTop: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            {asking === 'terima'
              ? 'Yakin menerima? Semua lamaranmu yang lain akan ditutup, termasuk yang sudah dijadwalkan interview.'
              : 'Yakin menolak? Tawaran ini tidak bisa diambil lagi.'}
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" style={btnOutline} onClick={() => setAsking(null)} disabled={busy}>Batal</button>
            <button type="button" style={asking === 'terima' ? { ...btnPrimary, backgroundColor: '#067647' } : { ...btnPrimary, backgroundColor: '#B42318' }}
              onClick={() => answer(asking)} disabled={busy}>
              {busy ? 'Mengirim…' : asking === 'terima' ? 'Ya, terima tawaran' : 'Ya, tolak tawaran'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" style={{ ...btnPrimary, backgroundColor: '#067647' }} onClick={() => setAsking('terima')}>Terima tawaran</button>
          <button type="button" style={{ ...btnOutline, color: '#B42318', borderColor: '#B42318' }} onClick={() => setAsking('tolak')}>Tolak</button>
        </div>
      )}
      <span style={{ fontSize: '12px', color: MUTED }}>Kamu hanya bisa menerima satu tempat magang.</span>
    </div>
  );
}
