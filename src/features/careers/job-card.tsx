import React from 'react';
import { Clock } from 'lucide-react';
import { countdownParts, formatCountdown, EMPLOYMENT_LABELS, salaryLabel, SCHEME_LABELS, WORK_MODE_LABELS, type Job } from './model';

export type JobCardData = Pick<Job, 'title' | 'partnerName' | 'employment' | 'location' | 'workMode' | 'quota' | 'closesAt'> & { scheme?: Job['scheme']; salaryMin?: number | null; salaryMax?: number | null };

const chip: React.CSSProperties = { padding: '3px 8px', borderRadius: '6px', backgroundColor: '#f3f4f6', fontSize: '12px', color: '#243c4b' };

/**
 * Logo mitra, atau inisial berwarna bila belum diunggah.
 *
 * Partner logo, or a coloured initial when none is uploaded yet.
 */
export function PartnerLogo({ name, logo, size = 44 }: { name: string; logo: string | null; size?: number }) {
  const box: React.CSSProperties = { width: size, height: size, borderRadius: '8px', flexShrink: 0 };
  // eslint-disable-next-line @next/next/no-img-element
  if (logo) return <img src={logo} alt={'Logo ' + name} style={{ ...box, objectFit: 'contain', backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }} />;
  return (
    <div aria-hidden style={{ ...box, display: 'grid', placeItems: 'center', backgroundColor: '#0072CE', color: '#ffffff', fontWeight: 700, fontSize: size * 0.36 }}>
      {(name.trim()[0] ?? '?').toUpperCase()}
    </div>
  );
}

/**
 * Kartu lowongan sesuai mockup Portal Karier; dipakai pratinjau admin dan daftar siswa.
 *
 * Job card per the Portal Karier mockup; used by the admin preview and the student list.
 */
export function JobCard({ job, logo, now, footer }: { job: JobCardData; logo: string | null; now: Date; footer?: React.ReactNode }) {
  const parts = countdownParts(job.closesAt, now);
  const salary = salaryLabel(job.salaryMin, job.salaryMax);
  // Kurang dari sehari tampil merah agar siswa tidak menunda / Under a day shows red so students do not put it off
  const urgent = !parts.ended && parts.days === 0;
  return (
    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: 'Inter, Arial, sans-serif', color: '#243c4b' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <PartnerLogo name={job.partnerName} logo={logo} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-heading, Poppins), sans-serif', fontWeight: 700, fontSize: '16px', lineHeight: 1.3 }}>{job.title || 'Nama posisi'}</div>
          <div style={{ fontSize: '13px', color: '#5b6b75' }}>{job.partnerName || 'Perusahaan'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {job.scheme && <span style={{ ...chip, backgroundColor: job.scheme === 'full' ? '#FFF7E0' : '#E6F1FB', color: job.scheme === 'full' ? '#946200' : '#0072CE', fontWeight: 600 }}>{SCHEME_LABELS[job.scheme]}</span>}
        <span style={chip}>{EMPLOYMENT_LABELS[job.employment]}</span>
        <span style={chip}>{`${job.location || 'Lokasi'} · ${WORK_MODE_LABELS[job.workMode]}`}</span>
        <span style={chip}>{`Kuota ${job.quota}`}</span>
        {salary && <span style={{ ...chip, backgroundColor: '#E7F6EC', color: '#1E7A3D', fontWeight: 600 }}>{salary}</span>}
      </div>
      <div
        data-urgent={urgent ? 'true' : 'false'}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
          backgroundColor: urgent ? '#FDECEA' : '#E6F1FB', color: urgent ? '#B42318' : '#0072CE',
        }}
      >
        <Clock size={14} aria-hidden />
        <span>{parts.ended ? 'Ditutup' : `Tutup dalam ${formatCountdown(parts)}`}</span>
      </div>
      {footer}
    </div>
  );
}
