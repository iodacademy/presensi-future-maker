'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { StudentShell } from '@/components/student-shell';
import { PartnerLogo } from '@/features/careers/job-card';
import {
  countdownParts, EMPLOYMENT_LABELS, formatCountdown, studentStatusLabel, WORK_MODE_LABELS,
  type ApplicationStatus, type DocRule, type Job,
} from '@/features/careers/model';
import type { PublicPartner } from '@/features/careers/student-service';
import { BLUE, btnGhost, btnOutline, btnPrimary, card, errorBox, getJson, heading, MUTED, pageWrap, pill } from '../ui';

type Detail = { job: Job; partner: PublicPartner; application: { status: ApplicationStatus; number: string } | null };
const DOC = (rule: DocRule) => (rule === 'required' ? 'wajib' : 'opsional');

/**
 * Detail lowongan untuk siswa. / Job detail for students.
 */
export default function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    getJson<Detail>(`/api/karier/lowongan/${jobId}`).then(setD).catch((e) => setError(e.message));
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [jobId]);

  const parts = d ? countdownParts(d.job.closesAt, now) : null;
  const section = (title: string, children: React.ReactNode) => (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <h2 style={{ ...heading, fontSize: '16px' }}>{title}</h2>
      {children}
    </section>
  );

  return (
    <StudentShell>
      <div style={pageWrap}>
        <Link href="/app/karier" style={{ ...btnGhost, alignSelf: 'flex-start' }}>← Kembali ke lowongan</Link>
        {error && <div role="alert" style={errorBox}>{error}</div>}
        {d && parts && (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <article style={{ ...card, flex: '1 1 520px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <PartnerLogo name={d.partner.name} logo={d.partner.logo?.thumb ?? null} size={56} />
                <div>
                  <h1 style={{ ...heading, fontSize: '22px' }}>{d.job.title}</h1>
                  <Link href={`/app/karier/mitra/${d.partner.id}`} style={{ color: BLUE, fontSize: '14px', fontWeight: 600 }}>{d.partner.name}</Link>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[EMPLOYMENT_LABELS[d.job.employment], `${d.job.location} · ${WORK_MODE_LABELS[d.job.workMode]}`, `Kuota ${d.job.quota}`].map((c) => (
                  <span key={c} style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: '#f3f4f6', fontSize: '13px' }}>{c}</span>
                ))}
              </div>
              {section('Tentang posisi', <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{d.job.description || '–'}</p>)}
              {section('Kualifikasi', (
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  <li>Peserta aktif atau alumni kelas Future Makers</li>
                  {d.job.qualifications.map((q) => <li key={q}>{q}</li>)}
                </ul>
              ))}
              {section('Dokumen yang diminta', (
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  <li>CV (PDF) · wajib</li>
                  {d.job.documents.portfolio !== 'off' && <li>Link portofolio · {DOC(d.job.documents.portfolio)}</li>}
                  {d.job.documents.works !== 'off' && <li>Karya pameran atau tugas · {DOC(d.job.documents.works)}</li>}
                  {d.job.documents.coverLetter !== 'off' && <li>Surat lamaran (PDF) · {DOC(d.job.documents.coverLetter)}</li>}
                </ul>
              ))}
              {section('Tahapan seleksi', (
                <ol style={{ margin: 0, paddingLeft: '20px' }}>
                  <li>Review CV oleh mitra</li>
                  <li>Interview (undangan dikirim lewat portal ini)</li>
                  <li>Pengumuman hasil</li>
                </ol>
              ))}
            </article>
            <aside style={{ ...card, flex: '0 1 320px', display: 'flex', flexDirection: 'column', gap: '14px', position: 'sticky', top: '16px' }}>
              <div style={{ fontSize: '13px', color: MUTED }}>Lowongan ditutup dalam</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '18px', fontWeight: 700, color: parts.days === 0 && !parts.ended ? '#B42318' : BLUE }}>
                <Clock size={18} aria-hidden /> {formatCountdown(parts)}
              </div>
              {d.application ? (
                <>
                  <span style={{ ...pill('#ECFDF3', '#067647'), alignSelf: 'flex-start' }}>{studentStatusLabel(d.application.status)}</span>
                  <Link href="/app/karier?tab=lamaran" style={btnOutline}>Sudah dilamar · lihat status</Link>
                </>
              ) : parts.ended ? (
                <span style={{ color: MUTED }}>Lowongan sudah ditutup.</span>
              ) : (
                <Link href={`/app/karier/${jobId}/lamar`} style={btnPrimary}>Lamar sekarang</Link>
              )}
            </aside>
          </div>
        )}
      </div>
    </StudentShell>
  );
}
