import React from 'react';

/** Lencana jumlah sesi: belum pernah dibedakan warnanya agar mudah dicari / Session-count badge: never-booked stands out so it is easy to spot */
export function MentoringCountBadge({ count }: { count: number }) {
  const none = count === 0;
  return (
    <span
      style={{
        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
        backgroundColor: none ? 'var(--color-warning-light)' : count >= 2 ? 'var(--color-success-light)' : 'var(--color-primary-light)',
        color: none ? '#7c2d12' : count >= 2 ? '#3f6212' : 'var(--color-primary)',
      }}
    >
      {none ? 'Belum pernah mentoring' : `${Math.min(count, 2)}/2 sesi`}
    </span>
  );
}
