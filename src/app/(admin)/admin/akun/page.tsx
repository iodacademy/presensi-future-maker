'use client';

import React, { useEffect, useState } from 'react';
import { UserPlus, Search } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { AddUserModal } from './add-user-modal';
import type { ClassSummary } from '@/features/classes/types';
import type { Role } from '@/features/auth/types';
import type { UserListItem } from '@/features/users/list-service';

const TABS: [Role, string][] = [
  ['student', 'Peserta'],
  ['mentor', 'Mentor'],
  ['admin', 'Admin'],
];

export default function AdminAkunPage() {
  const [tab, setTab] = useState<Role>('student');
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [counts, setCounts] = useState<Record<Role, number>>({ admin: 0, mentor: 0, student: 0 });
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [togglingUid, setTogglingUid] = useState<string | null>(null);

  async function loadUsers() {
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users || []);
      setCounts(data.counts || { admin: 0, mentor: 0, student: 0 });
    }
  }

  async function loadClasses() {
    const res = await fetch('/api/classes');
    if (res.ok) setClasses((await res.json()).classes || []);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadUsers(), loadClasses()]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleToggleActive(user: UserListItem) {
    setTogglingUid(user.uid);
    setStatus(null);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, active: !user.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah status akun');
      await loadUsers();
    } catch (e) {
      setStatus({ type: 'error', text: (e as Error).message });
    } finally {
      setTogglingUid(null);
    }
  }

  const needle = query.trim().toLowerCase();
  const visible = users.filter(
    (u) =>
      u.role === tab &&
      (needle === '' ||
        u.name.toLowerCase().includes(needle) ||
        u.email.toLowerCase().includes(needle) ||
        (u.className ?? '').toLowerCase().includes(needle))
  );

  return (
    <AppShell role="admin" userName="Administrator">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
            Akun
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '2px' }}>
            {counts.student} peserta, {counts.mentor} mentor, {counts.admin} admin
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsAddOpen(true)} style={{ fontSize: '11px', padding: '8px 14px' }}>
          <UserPlus size={13} strokeWidth={2} /> Tambah Akun
        </Button>
      </div>

      {status && (
        <div
          role="alert"
          style={{
            padding: '10px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
            backgroundColor: status.type === 'success' ? 'var(--color-success-light)' : 'var(--color-danger-light)',
            color: status.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
          }}
        >
          {status.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)' }}>
        {TABS.map(([value, label]) => {
          const active = tab === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              aria-pressed={active}
              style={{
                padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px',
                borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
                fontWeight: active ? 700 : 400,
                color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
              }}
            >
              {label} ({counts[value]})
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff' }}>
        <Search size={13} color="var(--color-text-muted)" strokeWidth={2} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama, email, atau kelas"
          aria-label="Cari akun"
          style={{ border: 'none', outline: 'none', fontSize: '11px', flex: 1, color: 'var(--color-text-main)' }}
        />
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          Memuat daftar akun...
        </div>
      ) : visible.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed var(--color-border)', padding: '36px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            {needle ? 'Tidak ada akun yang cocok dengan pencarian' : `Belum ada akun ${TABS.find(([v]) => v === tab)?.[1].toLowerCase()}`}
          </div>
        </div>
      ) : (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          {visible.map((user, i) => (
            <div
              key={user.uid}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                opacity: user.active ? 1 : 0.55,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </div>
              </div>

              {user.className && (
                <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)', padding: '3px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
                  {user.className}
                </span>
              )}

              {!user.active && (
                <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)', backgroundColor: 'var(--color-border)', padding: '3px 8px', borderRadius: '10px' }}>
                  NONAKTIF
                </span>
              )}

              {/* Penonaktifan dipakai alih-alih penghapusan: akun memuat
                  pengumpulan tugas dan catatan kehadiran yang tidak punya
                  salinan lain, sedangkan field active sudah diperiksa saat masuk
                  maupun pada tiap pemeriksaan sesi.

                  Deactivation is used rather than deletion: an account carries
                  submissions and attendance records with no other copy, while
                  the active field is already checked at sign-in and on every
                  session check. */}
              <button
                type="button"
                onClick={() => handleToggleActive(user)}
                disabled={togglingUid === user.uid}
                style={{
                  padding: '5px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                  border: `1px solid ${user.active ? 'var(--color-danger)' : 'var(--color-success)'}`,
                  backgroundColor: 'transparent',
                  color: user.active ? 'var(--color-danger)' : 'var(--color-success)',
                  whiteSpace: 'nowrap',
                }}
              >
                {togglingUid === user.uid ? '...' : user.active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            </div>
          ))}
        </div>
      )}

      {isAddOpen && (
        <AddUserModal
          classes={classes}
          onClose={() => setIsAddOpen(false)}
          onSuccess={async (message) => {
            setIsAddOpen(false);
            setStatus({ type: 'success', text: message });
            await Promise.all([loadUsers(), loadClasses()]);
          }}
        />
      )}
    </AppShell>
  );
}
