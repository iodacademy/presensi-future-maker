'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, BellRing, ClipboardCheck, MessageSquare, ChevronRight, X } from 'lucide-react';
import type { StudentReminders } from '@/features/dashboard/types';
import { formatDateTimeWib } from '@/lib/time';

export interface ReminderRow {
  key: string;
  href: string;
  kind: 'survei' | 'kuis';
  title: string;
  meta: string;
}

const KIND_STYLE = {
  survei: { icon: MessageSquare, color: '#0f766e', bg: '#d5f5ef' },
  kuis: { icon: ClipboardCheck, color: '#7c3aed', bg: '#f1e8ff' },
} as const;

/** Satu daftar baris untuk lonceng, toast, dan halaman notifikasi / One row list for the bell, toast and notifications page */
export function reminderRows({ surveys, exams }: StudentReminders): ReminderRow[] {
  return [
    ...surveys.map((s) => ({
      key: `survei.${s.formId}.${s.sessionId}`,
      href: `/app/survei/${s.formId}/${s.sessionId}`,
      kind: 'survei' as const,
      title: s.formTitle,
      meta: `Survei · ${s.sessionTitle}`,
    })),
    ...exams.map((e) => ({
      key: `kuis.${e.id}`,
      href: `/app/ujian/${e.id}`,
      kind: 'kuis' as const,
      title: e.title,
      meta: ['Kuis', e.sessionTitle, e.dueAt ? `batas ${formatDateTimeWib(e.dueAt)}` : null].filter(Boolean).join(' · '),
    })),
  ];
}

export function ReminderItem({ row, onClick }: { row: ReminderRow; onClick?: () => void }) {
  const style = KIND_STYLE[row.kind];
  const Icon = style.icon;
  return (
    <Link
      href={row.href}
      onClick={onClick}
      className="cp-row"
      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', textDecoration: 'none' }}
    >
      <span style={{ width: '32px', height: '32px', borderRadius: '9px', backgroundColor: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} color={style.color} strokeWidth={2.2} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.title}
        </span>
        <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.meta}
        </span>
      </span>
      <ChevronRight size={14} color="var(--color-text-faint)" />
    </Link>
  );
}

// Popover cukup memuat lima baris; sisanya di halaman notifikasi.
// The popover holds five rows; the rest live on the notifications page.
const POPOVER_ROWS = 5;

/**
 * Lonceng notifikasi dengan popover. Mengikuti pola ProfileMenu: ditutup oleh
 * klik di luar dan oleh Escape.
 *
 * Notification bell with a popover. Follows the ProfileMenu pattern: closed by
 * an outside click and by Escape.
 */
export function NotificationBell({ reminders }: { reminders: StudentReminders }) {
  const rows = reminderRows(reminders);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={rows.length > 0 ? `Notifikasi, ${rows.length} belum dikerjakan` : 'Notifikasi'}
        style={{
          position: 'relative', width: '38px', height: '38px', borderRadius: '50%', border: '1px solid var(--color-border)',
          backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}
      >
        {rows.length > 0 ? <BellRing size={17} color="var(--color-text-main)" strokeWidth={2} /> : <Bell size={17} color="var(--color-text-muted)" strokeWidth={2} />}
        {rows.length > 0 && (
          <span
            aria-hidden
            style={{
              position: 'absolute', top: '-5px', right: '-6px', minWidth: '18px', height: '18px', padding: '0 4px', borderRadius: '9px',
              backgroundColor: 'var(--color-danger)', color: '#ffffff', fontSize: '9px', fontWeight: 700, lineHeight: '14px', textAlign: 'center',
              border: '2px solid #ffffff', boxSizing: 'border-box',
            }}
          >
            {rows.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifikasi"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 'min(340px, calc(100vw - 32px))', backgroundColor: '#ffffff',
            borderRadius: '14px', border: '1px solid var(--color-border)', boxShadow: '0 12px 32px rgba(0,0,0,0.16)', overflow: 'hidden', zIndex: 70,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', borderBottom: '1px solid var(--color-student-border)' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)', flex: 1 }}>Notifikasi</span>
            {rows.length > 0 && (
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)', padding: '2px 8px', borderRadius: '10px' }}>
                {rows.length} belum dikerjakan
              </span>
            )}
          </div>
          {rows.length === 0 ? (
            <p style={{ padding: '24px 14px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>Semua survei dan kuis sudah kamu kerjakan.</p>
          ) : (
            <div style={{ padding: '6px', maxHeight: '320px', overflowY: 'auto' }}>
              {rows.slice(0, POPOVER_ROWS).map((r) => (
                <ReminderItem key={r.key} row={r} onClick={() => setOpen(false)} />
              ))}
            </div>
          )}
          <Link
            href="/app/notifikasi"
            onClick={() => setOpen(false)}
            style={{ display: 'block', padding: '11px 14px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', textDecoration: 'none', borderTop: '1px solid var(--color-student-border)', backgroundColor: 'var(--color-bg-student)' }}
          >
            Lihat semua notifikasi
          </Link>
        </div>
      )}
    </div>
  );
}

// Toast hilang sendiri setelah 10 detik; lonceng tetap menyimpan isinya.
// The toast clears itself after 10 seconds; the bell still holds its contents.
const TOAST_MS = 10_000;
const SEEN_KEY = 'reminder-toast-seen';

/**
 * Toast pengingat di kiri bawah. Tampil sekali per sesi peramban untuk
 * kumpulan pengingat yang sama -- shell dipasang ulang di setiap halaman, dan
 * toast yang muncul pada setiap perpindahan halaman hanya mengganggu. Bila
 * ada pengingat baru, kumpulannya berubah dan toast tampil lagi.
 *
 * Reminder toast at the bottom left. Shown once per browser session for the
 * same set of reminders -- the shell remounts on every page, and a toast on
 * every page change only nags. When a new reminder arrives the set changes and
 * the toast shows again.
 */
export function ReminderToast({ reminders }: { reminders: StudentReminders }) {
  const rows = reminderRows(reminders);
  const signature = rows.map((r) => r.key).sort().join('|');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!signature) return;
    let seen: string | null = null;
    try {
      seen = sessionStorage.getItem(SEEN_KEY);
    } catch {
      // Penyimpanan diblokir: tampilkan saja / Storage blocked: just show it
    }
    if (seen === signature) return;
    setVisible(true);
    try {
      sessionStorage.setItem(SEEN_KEY, signature);
    } catch {
      // Abaikan / Ignore
    }
    const timer = setTimeout(() => setVisible(false), TOAST_MS);
    return () => clearTimeout(timer);
  }, [signature]);

  if (!visible || rows.length === 0) return null;
  const first = rows[0];

  return (
    <div
      role="status"
      className="reminder-toast"
      style={{
        position: 'fixed', left: '16px', zIndex: 80, width: 'min(360px, calc(100vw - 32px))', backgroundColor: '#ffffff',
        borderRadius: '14px', borderLeft: '4px solid var(--color-highlight-yellow)', boxShadow: '0 12px 32px rgba(15, 23, 42, 0.22)', padding: '12px 12px 12px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#fff3c4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BellRing size={16} color="#b45309" strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)' }}>{rows.length} hal belum kamu kerjakan</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {first.title} · {first.meta}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <Link
              href={first.href}
              onClick={() => setVisible(false)}
              style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}
            >
              Kerjakan
            </Link>
            {rows.length > 1 && (
              <Link
                href="/app/notifikasi"
                onClick={() => setVisible(false)}
                style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}
              >
                Lihat semua
              </Link>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Tutup pengingat"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
        >
          <X size={16} color="var(--color-text-faint)" />
        </button>
      </div>
    </div>
  );
}
