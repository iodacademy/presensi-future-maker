'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, ChevronRight } from 'lucide-react';
import { salaryLabel, SCHEME_LABELS } from '@/features/careers/model';
import type { RejectionNotice } from '@/features/careers/rejection-notice';

const closeDate = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' });

/**
 * Pop-up besar di beranda saat ada lamaran yang tidak lolos, dengan saran lowongan
 * yang masih bisa dilamar. Tampil sekali; menutupnya menandai lamaran sudah dilihat.
 *
 * A large home pop-up when an application is rejected, with suggestions of jobs the
 * participant can still apply to. Shows once; closing it marks the applications seen.
 */
export function RejectionPopup() {
  const [notice, setNotice] = useState<RejectionNotice | null>(null);

  useEffect(() => {
    fetch('/api/karier/penolakan').then((r) => (r.ok ? r.json() : null)).then((d: RejectionNotice | null) => {
      if (d?.rejections?.length) setNotice(d);
    }).catch(() => undefined);
  }, []);

  const close = useCallback(() => {
    if (!notice) return;
    setNotice(null);
    fetch('/api/karier/penolakan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: notice.rejections.map((r) => r.id) }) })
      .catch(() => undefined);
  }, [notice]);

  useEffect(() => {
    if (!notice) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notice, close]);

  if (!notice) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 95, backgroundColor: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="rejection-title"
        style={{ backgroundColor: '#ffffff', borderRadius: '18px', width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', padding: '24px' }}>
        <h2 id="rejection-title" style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>Lamaranmu belum lolos</h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '8px 0 0' }}>Terima kasih sudah melamar. Kali ini kamu belum lolos di:</p>
        <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)' }}>
          {notice.rejections.map((r) => <li key={r.id}>{r.jobTitle} · {r.partnerName}</li>)}
        </ul>

        {notice.blocked ? (
          <div style={{ marginTop: '16px', padding: '12px 14px', borderRadius: '12px', backgroundColor: '#FFFAEB', border: '1px solid #FEC84B', fontSize: '13px' }}>{notice.blocked}</div>
        ) : notice.suggestions.length > 0 ? (
          <>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-main)', margin: '18px 0 8px' }}>Coba lamar di sini, kursinya masih tersedia:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {notice.suggestions.map((j) => (
                <Link key={j.id} href={`/app/karier/${j.id}`} onClick={close}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--color-border)', textDecoration: 'none', color: 'inherit' }}>
                  <span style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Briefcase size={18} color="var(--color-primary)" aria-hidden />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-main)' }}>{j.title}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {j.partnerName} · {SCHEME_LABELS[j.scheme ?? 'full']}{salaryLabel(j.salary, j.scheme, j.durationMonths) ? ` · ${salaryLabel(j.salary, j.scheme, j.durationMonths)}` : ''} · tutup {closeDate(j.closesAt)}
                    </span>
                  </span>
                  <ChevronRight size={18} color="var(--color-primary)" aria-hidden />
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '16px 0 0' }}>Belum ada lowongan lain yang cocok untukmu saat ini. Kami kabari begitu ada lowongan baru.</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px', flexWrap: 'wrap' }}>
          <Link href="/app/karier" onClick={close} style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--color-border)', fontSize: '13px', fontWeight: 600, textDecoration: 'none', color: 'var(--color-text-main)' }}>Lihat semua lowongan</Link>
          <button type="button" autoFocus onClick={close} style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Tutup</button>
        </div>
      </div>
    </div>
  );
}
