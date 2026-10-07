'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { StudentShell } from '@/components/student-shell';
import {
  PROGRAM_STAGES,
  CURRICULUM,
  PACKAGE_ORDER,
  LOCATIONS,
  REQUIREMENTS,
  FAQ,
  packageFromClassName,
  type PackageKey,
} from '@/features/program/data';

type Tab = 'alur' | 'kurikulum' | 'lokasi' | 'syarat';

const TABS: [Tab, string][] = [
  ['alur', 'Alur'],
  ['kurikulum', 'Kurikulum'],
  ['lokasi', 'Lokasi'],
  ['syarat', 'Syarat & FAQ'],
];

const card: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '1px solid var(--color-border)',
  padding: '14px',
};

export default function StudentProgramPage() {
  const [tab, setTab] = useState<Tab>('alur');
  const [pkg, setPkg] = useState<PackageKey>('web');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Buka kurikulum jurusan peserta sendiri lebih dulu. Nama kelas diambil dari
  // dasbor karena sesi tidak memuatnya, dan bila tidak dikenali tab tetap pada
  // nilai awal -- peserta masih dapat berpindah sendiri.
  //
  // Open the participant's own major first. The class name comes from the
  // dashboard since the session does not carry it, and when unrecognised the
  // tab keeps its initial value -- the participant can still switch manually.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/dashboard/student')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const inferred = packageFromClassName(d.className);
        if (inferred) setPkg(inferred);
      })
      .catch(() => {
        // Gagal memuat nama kelas bukan alasan menyembunyikan seluruh halaman.
        // Failing to load the class name is no reason to hide the whole page.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const curriculum = CURRICULUM[pkg];

  const chip = (value: Tab, label: string, onBlue: boolean) => {
    const active = tab === value;
    return (
      <button
        key={value}
        type="button"
        onClick={() => setTab(value)}
        aria-pressed={active}
        style={{
          padding: '7px 14px',
          borderRadius: '20px',
          border: 'none',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: active ? 700 : 400,
          whiteSpace: 'nowrap',
          backgroundColor: onBlue
            ? active
              ? '#ffffff'
              : 'var(--color-header-pill)'
            : active
              ? 'var(--color-primary)'
              : 'var(--color-border)',
          color: onBlue
            ? active
              ? 'var(--color-primary)'
              : '#ffffff'
            : active
              ? '#ffffff'
              : 'var(--color-text-main)',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <StudentShell>
      <div className="student-mobile-header" style={{ backgroundColor: 'var(--color-primary)', padding: '24px 16px 18px', paddingRight: '110px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
          Overview Program
        </h1>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', overflowX: 'auto', paddingBottom: '2px' }}>
          {TABS.map(([v, l]) => chip(v, l, true))}
        </div>
      </div>

      <div
        className="student-topbar"
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid var(--color-student-border)',
          padding: '18px 28px',
          // Ruang bagi menu akun yang mengambang di sudut kanan atas shell.
          // Room for the account menu floating at the shell's top-right.
          paddingRight: '200px',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>
            Overview Program
          </h1>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Future Innovators Bootcamp</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>{TABS.map(([v, l]) => chip(v, l, false))}</div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {tab === 'alur' && (
          <>
            {PROGRAM_STAGES.map((stage, i) => (
              <div key={stage.title} style={{ ...card, display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-primary-light)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>
                    {stage.title}
                  </h3>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '3px 0 0' }}>{stage.date}</p>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'kurikulum' && (
          <>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PACKAGE_ORDER.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPkg(key)}
                  aria-pressed={pkg === key}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: pkg === key ? 700 : 400,
                    border: pkg === key ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    backgroundColor: pkg === key ? 'var(--color-primary-light)' : '#ffffff',
                    color: pkg === key ? 'var(--color-primary)' : 'var(--color-text-main)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ ...card, backgroundColor: 'var(--color-primary-light)', border: '1px solid var(--color-primary)' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>
                Capstone Project
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--color-text-main)', margin: '4px 0 6px' }}>{curriculum.capstoneNote}</p>
              <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: 0 }}>{curriculum.capstoneList.join(' · ')}</p>
            </div>

            {curriculum.meetings.map((m, i) => {
              const offline = curriculum.offlineMeetings.includes(i + 1);
              return (
                <div key={m.title} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-primary)' }}>PERTEMUAN {i + 1}</span>
                    <span
                      style={{
                        fontSize: '8px',
                        fontWeight: 700,
                        color: '#ffffff',
                        backgroundColor: offline ? 'var(--color-success)' : 'var(--color-text-muted)',
                        padding: '3px 8px',
                        borderRadius: '10px',
                      }}
                    >
                      {offline ? 'OFFLINE' : 'ONLINE'}
                    </span>
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)', margin: '8px 0 4px' }}>
                    {m.title}
                  </h3>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>{m.outcome}</p>
                </div>
              );
            })}
          </>
        )}

        {tab === 'lokasi' && (
          <>
            {LOCATIONS.map((loc) => (
              <div key={loc.city} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>
                    {loc.city}
                  </h3>
                  <span style={{ fontSize: '8px', fontWeight: 700, color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)', padding: '3px 8px', borderRadius: '10px' }}>
                    {loc.offlineCount}x OFFLINE
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600, margin: '4px 0 8px' }}>{loc.major}</p>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                  <MapPin size={13} color="var(--color-text-muted)" strokeWidth={2} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-main)' }}>{loc.venue}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{loc.address}</div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'syarat' && (
          <>
            {REQUIREMENTS.map((r) => (
              <div key={r.title} style={card}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>
                  {r.title}
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>{r.body}</p>
              </div>
            ))}

            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)', margin: '8px 0 0' }}>
              Pertanyaan Umum
            </h2>

            {FAQ.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.question} style={{ ...card, padding: 0, overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-expanded={open}
                    style={{
                      width: '100%',
                      padding: '14px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-text-main)',
                    }}
                  >
                    {item.question}
                    <ChevronDown
                      size={15}
                      strokeWidth={2}
                      color="var(--color-text-muted)"
                      style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                    />
                  </button>
                  {open && (
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0, padding: '0 14px 14px', lineHeight: 1.6 }}>
                      {item.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </StudentShell>
  );
}
