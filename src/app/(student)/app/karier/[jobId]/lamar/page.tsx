'use client';

import React, { use } from 'react';
import { StudentShell } from '@/components/student-shell';
import { heading, MUTED, pageWrap } from '../../ui';
import { ApplyForm } from './apply-form';

export default function LamarPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  return (
    <StudentShell>
      <div style={{ ...pageWrap, maxWidth: '860px' }}>
        <div>
          <div style={{ fontSize: '12px', color: MUTED }}>Karier · Lamar</div>
          <h1 style={{ ...heading, fontSize: '22px' }}>Formulir lamaran</h1>
        </div>
        <ApplyForm jobId={jobId} />
      </div>
    </StudentShell>
  );
}
