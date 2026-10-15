'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  QrCode, Info, Video, FileText, Download, ClipboardList, ClipboardCheck, MessageSquare,
  ChevronDown, ChevronLeft, ChevronRight, Play, ExternalLink, Calendar, MapPin, Lock, FolderOpen,
  PanelRightClose, PanelRightOpen, X, List as ListIcon, BellRing, Minimize2, Trophy,
} from 'lucide-react';
import { StudentShell } from '@/components/student-shell';
import { formatTimeWib, formatDateTimeWib, formatDateWib, formatLongDateTimeWib } from '@/lib/time';
import { toEmbedUrl } from '@/lib/embed-url';
import { pickFocusSessionId } from '@/features/attendance/focus-session';
import type { SessionDocument, AttendanceDocument } from '@/features/attendance/types';
import type { MaterialLink, TaskKind } from '@/features/tasks/types';
import { TASK_KIND_LABELS, MATERIAL_CATEGORY_LABELS, materialCategory, type MaterialCategory } from '@/features/tasks/types';
import type { StudentTaskOutline } from '@/features/tasks/submission-types';
import { lockMessage, type ExamLock } from '@/features/exams/sequence';
import { useStudentReminders } from '@/components/student-shell';
import { reminderRows, ReminderItem } from '@/components/reminders';

const MATERIAL_ORDER: MaterialCategory[] = ['presentasi', 'tambahan', 'praktik'];

type Paper = { id: string; title: string; dueAt: string | null };
type Exam = {
  id: string; title: string; kind: 'pretest' | 'posttest' | 'kuis'; questionCount: number; durationMinutes: number | null;
  score: number | null; passed: boolean; finished: boolean; attemptsLeft: number; lock: ExamLock;
};
type Survey = { formId: string; formTitle: string; questionCount: number; submitted: boolean };

interface SessionItem {
  session: SessionDocument;
  attendance: AttendanceDocument | null;
  isActive: boolean;
  workingPapers?: Paper[];
  exams?: Exam[];
  surveys?: Survey[];
}

type Tone = 'success' | 'warning' | 'danger' | 'primary' | 'muted';
const TONES: Record<Tone, string> = {
  success: 'var(--color-success)',
  warning: '#7c2d12',
  danger: 'var(--color-danger)',
  primary: 'var(--color-primary)',
  muted: 'var(--color-text-faint)',
};

type Entry = { key: string; title: string; item: SessionItem | null; badge?: { text: string; tone: Tone } } & (
  | { kind: 'info' }
  | { kind: 'recording'; url: string }
  | { kind: 'material'; url: string; fileKind: MaterialLink['kind'] }
  | { kind: 'task'; href: string; taskKind: TaskKind; dueAt: string | null; outline: StudentTaskOutline | null }
  | { kind: 'exam'; href: string; exam: Exam }
  | { kind: 'survey'; href: string; survey: Survey }
);

interface Group {
  id: string;
  title: string;
  item: SessionItem | null;
  /** Nomor pertemuan; kosong untuk grup pretest, postest, dan tugas / Meeting number; empty for pretest, posttest and task groups */
  number?: number;
  /** Keterangan di atas judul grup selain pertemuan / The line above a non-meeting group's title */
  meta?: string;
  /** Warna khusus grup, mis. capstone / A group's own colour, e.g. capstone */
  accent?: { fg: string; bg: string };
  sections: { label: string; kind: Entry['kind']; entries: Entry[]; color?: string }[];
}

// Capstone berwarna emas: oranye sudah milik tugas dan ungu milik kuis, dan
// proyek akhir perlu menonjol dari keduanya.
// Capstone is gold: orange already belongs to tasks and purple to quizzes, and
// the final project needs to stand out from both.
const CAPSTONE_ACCENT = { fg: '#a16207', bg: '#fef3c7' };

const ICONS: Record<Entry['kind'], React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  info: Calendar,
  recording: Video,
  material: FileText,
  task: ClipboardList,
  exam: ClipboardCheck,
  survey: MessageSquare,
};

// Satu warna per jenis isi, agar peserta mengenali rekaman, materi, dan tugas
// dari warnanya tanpa membaca label bagiannya.
//
// One colour per kind of item, so participants recognise recordings,
// materials and tasks by colour without reading the section label.
const KIND_COLORS: Record<Entry['kind'], { fg: string; bg: string; label: string }> = {
  info: { fg: '#0e7490', bg: '#e0f7fc', label: 'Info Pertemuan' },
  recording: { fg: '#e11d48', bg: '#ffe4e9', label: 'Rekaman' },
  material: { fg: 'var(--color-primary)', bg: 'var(--color-primary-light)', label: 'Materi' },
  task: { fg: '#c2410c', bg: '#ffedd5', label: 'Tugas' },
  exam: { fg: '#7c3aed', bg: '#f1e8ff', label: 'Kuis' },
  survey: { fg: '#0f766e', bg: '#d5f5ef', label: 'Survei' },
};

function taskBadge(t: StudentTaskOutline | null): Entry['badge'] {
  if (!t) return undefined;
  if (t.score !== null) return { text: `Nilai ${t.score}`, tone: 'success' };
  if (t.submitted) return { text: 'Terkumpul', tone: 'success' };
  if (!t.isUnlocked) return { text: 'Terkunci', tone: 'muted' };
  return { text: 'Belum', tone: 'warning' };
}

function taskEntry(id: string, title: string, kind: TaskKind, dueAt: string | null, outline: StudentTaskOutline | null, item: SessionItem | null): Entry {
  return { key: `tugas.${id}`, kind: 'task', title, item, href: `/app/tugas/${id}?from=jadwal`, taskKind: kind, dueAt, outline, badge: taskBadge(outline) };
}

function examEntry(e: Exam, item: SessionItem | null): Entry {
  const habis = e.attemptsLeft === 0 && !e.passed;
  return {
    key: `kuis.${e.id}`, kind: 'exam', title: e.title, item, href: `/app/ujian/${e.id}`, exam: e,
    badge: e.score !== null
      ? { text: `Nilai ${e.score}`, tone: e.passed ? 'success' : 'primary' }
      : e.lock.locked ? { text: 'Terkunci', tone: 'muted' }
      : habis ? { text: 'Kesempatan habis', tone: 'danger' } : { text: `${e.questionCount} soal`, tone: 'primary' },
  };
}

/**
 * Menyusun daftar course player: satu kelompok per pertemuan, urut waktu,
 * ditambah satu kelompok untuk tugas yang tidak melekat pada pertemuan mana
 * pun (tugas mandiri dan capstone). Tanpa kelompok terakhir itu peserta harus
 * pindah ke menu Tugas untuk melihat sisa pekerjaannya.
 *
 * Builds the course-player list: one group per meeting in time order, plus one
 * group for tasks not tied to any meeting (self-study and capstone). Without
 * that last group participants would have to switch to the Tasks menu to see
 * the rest of their work.
 */
function buildGroups(items: SessionItem[], tasks: StudentTaskOutline[], standalone: Exam[]): Group[] {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const sorted = [...items].sort((a, b) => (a.session.startsAt ?? '').localeCompare(b.session.startsAt ?? ''));
  const shownTaskIds = new Set<string>();

  const groups: Group[] = sorted.map((item, index) => {
    const { session, workingPapers = [], exams = [], surveys = [] } = item;
    const recordings = session.recordings ?? [];
    const materials = session.materials ?? [];
    workingPapers.forEach((w) => shownTaskIds.add(w.id));

    return {
      id: session.id,
      title: session.title,
      item,
      number: index + 1,
      sections: [
        { label: 'Info Pertemuan', kind: 'info', entries: [{ key: `presensi.${session.id}`, kind: 'info', title: 'Jadwal & presensi', item } as Entry] },
        {
          label: 'Rekaman',
          kind: 'recording',
          entries: recordings.map((r): Entry => ({ key: `rekaman.${session.id}.${r.id}`, kind: 'recording', title: r.label, item, url: r.url })),
        },
        // Satu bagian per golongan bahan, urut seperti alur belajar: slide
        // dibuka saat pertemuan, materi tambahan sesudahnya, bahan praktik
        // untuk dikerjakan.
        //
        // One section per material group, ordered like the learning flow:
        // slides during the meeting, extra material after, practice material
        // to work on.
        ...MATERIAL_ORDER.map((c) => ({
          label: MATERIAL_CATEGORY_LABELS[c],
          kind: 'material' as const,
          entries: materials
            .filter((m) => materialCategory(m) === c)
            .map((m): Entry => ({ key: `materi.${session.id}.${m.id}`, kind: 'material', title: m.label, item, url: m.url, fileKind: m.kind })),
        })),
        {
          label: TASK_KIND_LABELS['working-paper'],
          kind: 'task',
          entries: workingPapers.map((w) => taskEntry(w.id, w.title, 'working-paper', w.dueAt, taskById.get(w.id) ?? null, item)),
        },
        {
          label: 'Kuis',
          kind: 'exam',
          entries: exams.map((e) => examEntry(e, item)),
        },
        {
          // Survei hanya dikirim server bila kehadirannya sudah tercatat.
          // The server sends surveys only once attendance is recorded.
          label: 'Survei',
          kind: 'survey',
          entries: surveys.map((sv): Entry => ({
            key: `survei.${sv.formId}.${session.id}`, kind: 'survey', title: sv.formTitle, item,
            href: `/app/survei/${sv.formId}/${session.id}`, survey: sv,
            badge: sv.submitted ? { text: 'Terisi', tone: 'success' } : { text: 'Wajib diisi', tone: 'warning' },
          })),
        },
      ].filter((s) => s.entries.length > 0) as Group['sections'],
    };
  });

  const others = tasks.filter((t) => !shownTaskIds.has(t.id));
  const mandiri = others.filter((t) => t.kind !== 'capstone');
  const capstone = others.filter((t) => t.kind === 'capstone');
  if (mandiri.length > 0) {
    const kinds: TaskKind[] = ['daily', 'working-paper'];
    groups.push({
      id: 'tugas-mandiri',
      title: 'Tugas Mandiri',
      item: null,
      sections: kinds
        .map((k) => ({
          label: TASK_KIND_LABELS[k],
          kind: 'task' as const,
          entries: mandiri.filter((t) => t.kind === k).map((t) => taskEntry(t.id, t.title, t.kind, t.dueAt, t, null)),
        }))
        .filter((s) => s.entries.length > 0),
    });
  }
  // Capstone berdiri sendiri, bukan salah satu tugas mandiri: ia proyek akhir
  // yang baru terbuka setelah seluruh tugas mandiri terkumpul.
  // Capstone stands on its own rather than as one of the self-study tasks: it is
  // the final project, opening only once every self-study task is handed in.
  if (capstone.length > 0) {
    groups.push({
      id: 'capstone',
      title: 'Capstone Project',
      item: null,
      meta: capstone.some((t) => t.isUnlocked) ? 'Proyek akhir · terbuka' : 'Proyek akhir · terbuka setelah semua tugas mandiri terkumpul',
      accent: CAPSTONE_ACCENT,
      sections: [{ label: 'Capstone Project', kind: 'task', color: CAPSTONE_ACCENT.fg, entries: capstone.map((t) => taskEntry(t.id, t.title, t.kind, t.dueAt, t, null)) }],
    });
  }
  // Pretest membuka jalur kuis sehingga berada paling atas; postest menutupnya
  // sehingga berada paling bawah.
  // The pretest opens the quiz path so it sits at the top; the posttest closes it
  // so it sits at the bottom.
  const pre = standalone.filter((e) => e.kind === 'pretest');
  const post = standalone.filter((e) => e.kind === 'posttest');
  if (pre.length > 0) {
    groups.unshift({ id: 'pretest', title: 'Pretest', item: null, meta: 'Kerjakan sebelum kuis sesi', sections: [{ label: 'Pretest', kind: 'exam', entries: pre.map((e) => examEntry(e, null)) }] });
  }
  if (post.length > 0) {
    groups.push({ id: 'postest', title: 'Postest', item: null, meta: 'Dibuka di pertemuan terakhir', sections: [{ label: 'Postest', kind: 'exam', entries: post.map((e) => examEntry(e, null)) }] });
  }
  return groups;
}

function itemFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('item');
}

/**
 * Memilih kelompok yang dibuka pertama kali: pertemuan yang paling dekat
 * waktunya (lihat pickFocusSessionId). Bila rekamannya ada, rekaman itulah
 * yang diputar.
 *
 * Picks the group that opens first: the meeting nearest in time (see
 * pickFocusSessionId). If it has a recording, that recording plays.
 */
function pickInitial(groups: Group[]): Group | undefined {
  const id = pickFocusSessionId(
    groups.filter((g) => g.item).map((g) => g.item!.session),
    new Date().toISOString()
  );
  return groups.find((g) => g.id === id) ?? groups[0];
}

function BadgeText({ badge }: { badge: NonNullable<Entry['badge']> }) {
  return (
    <span style={{ fontSize: '9px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, color: TONES[badge.tone] }}>
      {badge.text}
    </span>
  );
}

function EntryRow({ entry, active, onSelect }: { entry: Entry; active: boolean; onSelect: () => void }) {
  const isCapstone = entry.kind === 'task' && entry.taskKind === 'capstone';
  const Icon = entry.kind === 'recording' ? Play : entry.kind === 'exam' && entry.exam.lock.locked ? Lock : isCapstone ? Trophy : ICONS[entry.kind];
  const color = isCapstone ? { ...KIND_COLORS.task, ...CAPSTONE_ACCENT } : KIND_COLORS[entry.kind];
  return (
    <div className="cp-row" data-active={active} style={{ display: 'flex', alignItems: 'center', paddingRight: '10px' }}>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 8px 9px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span
          style={{
            width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: active ? 'var(--color-highlight-yellow)' : color.bg,
          }}
        >
          <Icon size={13} color={active ? 'var(--color-text-main)' : color.fg} strokeWidth={2.2} />
        </span>
        <span
          style={{
            flex: 1, minWidth: 0, fontSize: '12px', lineHeight: 1.4, fontWeight: active ? 600 : 400,
            color: active ? 'var(--color-text-main)' : 'var(--color-text-muted)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {entry.title}
        </span>
        {entry.badge && <BadgeText badge={entry.badge} />}
      </button>
      {entry.kind === 'material' && (
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Unduh ${entry.title}`}
          title="Unduh / buka di tab baru"
          style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Download size={13} color="var(--color-primary)" strokeWidth={2.2} />
        </a>
      )}
    </div>
  );
}

function sessionMeta(item: SessionItem): string {
  const s = item.session;
  return `${formatDateWib(s.startsAt)} · ${s.startTime}-${s.endTime} WIB`;
}

function ActionLink({ href, children, external, color = 'var(--color-primary)' }: { href: string; children: React.ReactNode; external?: boolean; color?: string }) {
  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px',
    backgroundColor: color, color: '#ffffff', fontSize: '12px', fontWeight: 700, textDecoration: 'none',
  };
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" style={style}>{children}</a>
  ) : (
    <Link href={href} style={style}>{children}</Link>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', padding: '8px 0', borderBottom: '1px solid var(--color-student-border)' }}>
      <span style={{ width: '120px', flexShrink: 0, color: 'var(--color-text-faint)' }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, color: 'var(--color-text-main)', fontWeight: 600, overflowWrap: 'anywhere' }}>{children}</span>
    </div>
  );
}

function Card({ kind, label, title, children }: { kind: Entry['kind']; label?: string; title?: string; children: React.ReactNode }) {
  const color = KIND_COLORS[kind];
  const Icon = ICONS[kind];
  return (
    <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-student-border)', borderTop: `4px solid ${color.fg}`, borderRadius: '12px', padding: '20px', boxShadow: '0 4px 16px rgba(36, 60, 75, 0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <span style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={18} color={color.fg} strokeWidth={2.2} />
        </span>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: color.fg }}>
          {label ?? color.label}
        </span>
      </div>
      {title && <h2 style={{ fontSize: '17px', lineHeight: 1.35, marginBottom: '8px', overflowWrap: 'anywhere' }}>{title}</h2>}
      {children}
    </div>
  );
}

/**
 * Area utama course player. Rekaman dan bahan dari penyedia yang dikenal
 * diputar di tempat; selainnya diberi tombol buka di tab baru. Tugas, kuis,
 * dan survei tetap dikerjakan di halamannya masing-masing -- di sini hanya
 * ringkasan dan pintunya.
 *
 * The course player's main area. Recordings and materials from known providers
 * play in place; anything else gets an open-in-new-tab button. Tasks, quizzes
 * and surveys are still done on their own pages -- here is only their summary
 * and the door to them.
 */
function Stage({ entry }: { entry: Entry }) {
  if (entry.kind === 'recording' || entry.kind === 'material') {
    const embed = toEmbedUrl(entry.url);
    const wide = entry.kind === 'recording' || entry.fileKind === 'slide';
    if (!embed) {
      return (
        <div style={{ aspectRatio: '16 / 9', backgroundColor: '#000000', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '24px', textAlign: 'center' }}>
          {entry.kind === 'recording' ? <Video size={32} color="#ffffff" /> : <FolderOpen size={32} color="#ffffff" />}
          <p style={{ color: '#ffffff', fontSize: '13px', maxWidth: '360px' }}>
            {entry.kind === 'recording' ? 'Rekaman ini tidak dapat diputar langsung di sini.' : 'Materi ini tidak dapat ditampilkan langsung di sini.'}
          </p>
          <ActionLink href={entry.url} external color={KIND_COLORS[entry.kind].fg}>
            <ExternalLink size={13} /> {entry.kind === 'recording' ? 'Buka rekaman' : 'Buka materi'}
          </ActionLink>
        </div>
      );
    }
    return (
      <div>
        <div style={{ position: 'relative', width: '100%', aspectRatio: wide ? '16 / 9' : '4 / 3', backgroundColor: '#000000', borderRadius: '12px', overflow: 'hidden' }}>
          <iframe
            key={embed}
            src={embed}
            title={entry.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        </div>
      </div>
    );
  }

  if (entry.kind === 'info' && entry.item) {
    const { session, attendance, isActive } = entry.item;
    const isOnline = session.mode === 'online';
    return (
      <Card kind="info">
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)', padding: '3px 8px', borderRadius: '10px' }}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
          {isActive && (
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#ffffff', backgroundColor: 'var(--color-success)', padding: '3px 8px', borderRadius: '10px' }}>BERLANGSUNG</span>
          )}
        </div>
        <Row label="Tanggal">{formatDateWib(session.startsAt)}</Row>
        <Row label="Waktu">{session.startTime}-{session.endTime} WIB</Row>
        {isOnline ? (
          <Row label="Tempat">Zoom</Row>
        ) : (
          <Row label="Tempat">
            {session.address || 'Offline'}
            {session.mapsUrl && (
              <a href={session.mapsUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--color-primary)' }}>
                <MapPin size={11} /> Buka peta
              </a>
            )}
          </Row>
        )}
        <Row label="Kehadiran">
          {attendance ? (
            <span style={{ color: 'var(--color-success)' }}>Hadir {formatTimeWib(attendance.recordedAt)}</span>
          ) : (
            <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>Belum tercatat</span>
          )}
        </Row>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
          {isOnline && isActive && session.zoomUrl?.startsWith('https://') && (
            <ActionLink href={session.zoomUrl} external><Video size={13} /> Gabung Zoom</ActionLink>
          )}
          {isActive && !attendance && (
            <ActionLink href="/app/presensi/scan"><QrCode size={13} /> Scan QR Hadir</ActionLink>
          )}
          {!isActive && !attendance && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--color-bg-student)' }}>
              <Info size={11} color="var(--color-text-muted)" strokeWidth={2} />
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>QR dibuka admin saat sesi</span>
            </div>
          )}
        </div>
      </Card>
    );
  }

  if (entry.kind === 'task') {
    const t = entry.outline;
    const locked = t ? !t.isUnlocked : false;
    return (
      <Card kind="task" label={TASK_KIND_LABELS[entry.taskKind]} title={entry.title}>
        <Row label="Batas waktu">{entry.dueAt ? formatDateTimeWib(entry.dueAt) : 'Tidak ada'}</Row>
        <Row label="Status">
          {entry.badge ? <span style={{ color: TONES[entry.badge.tone] }}>{entry.badge.text === 'Belum' ? 'Belum dikumpulkan' : entry.badge.text}</span> : '-'}
          {t?.late && <span style={{ marginLeft: '6px', color: 'var(--color-danger)', fontWeight: 400 }}>(terlambat)</span>}
        </Row>
        <div style={{ marginTop: '16px' }}>
          {locked ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              <Lock size={13} /> Selesaikan semua {TASK_KIND_LABELS.daily} dulu
            </div>
          ) : (
            <ActionLink href={entry.href} color={KIND_COLORS.task.fg}>{t?.submitted ? 'Lihat tugas' : 'Kerjakan tugas'} <ChevronRight size={13} /></ActionLink>
          )}
        </div>
      </Card>
    );
  }

  if (entry.kind === 'exam') {
    const e = entry.exam;
    const habis = e.attemptsLeft === 0 && !e.passed;
    const terkunci = lockMessage(e.lock, formatLongDateTimeWib);
    if (terkunci) {
      return (
        <Card kind="exam" title={entry.title}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '14px', borderRadius: '10px', backgroundColor: '#f4f4f5', marginTop: '4px' }}>
            <Lock size={20} color="var(--color-text-muted)" style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)' }}>Kuis ini masih terkunci</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px', lineHeight: 1.5 }}>{terkunci}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-faint)', marginTop: '6px' }}>
                Kuis dikerjakan berurutan: pretest, lalu kuis sesi 1, sesi 2, dan seterusnya.
              </div>
            </div>
          </div>
        </Card>
      );
    }
    return (
      <Card kind="exam" title={entry.title}>
        <Row label="Jumlah soal">{e.questionCount} soal</Row>
        {e.durationMinutes !== null && <Row label="Durasi">{e.durationMinutes} menit</Row>}
        <Row label="Nilai terbaik">{e.score !== null ? e.score : '-'}</Row>
        <Row label="Sisa kesempatan">{e.attemptsLeft} dari 3</Row>
        <div style={{ marginTop: '16px' }}>
          {habis ? (
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-danger)' }}>Kesempatan habis</span>
          ) : (
            <ActionLink href={entry.href} color={KIND_COLORS.exam.fg}>{e.score !== null ? 'Lihat kuis' : 'Mulai kuis'} <ChevronRight size={13} /></ActionLink>
          )}
        </div>
      </Card>
    );
  }

  if (entry.kind === 'survey') {
    const sv = entry.survey;
    return (
      <Card kind="survey" title={entry.title}>
        <Row label="Jumlah pertanyaan">{sv.questionCount}</Row>
        <Row label="Status">
          <span style={{ color: sv.submitted ? 'var(--color-success)' : '#7c2d12' }}>{sv.submitted ? 'Terisi' : 'Wajib diisi'}</span>
        </Row>
        <div style={{ marginTop: '16px' }}>
          <ActionLink href={entry.href} color={KIND_COLORS.survey.fg}>{sv.submitted ? 'Lihat survei' : 'Isi survei'} <ChevronRight size={13} /></ActionLink>
        </div>
      </Card>
    );
  }

  return null;
}

export default function StudentJadwalPage() {
  const [items, setItems] = useState<SessionItem[]>([]);
  const [tasks, setTasks] = useState<StudentTaskOutline[]>([]);
  const [standalone, setStandalone] = useState<Exam[]>([]);
  // Pop-up tagihan wajib dibuka lagi setiap kali halaman jadwal dibuka; dapat
  // diperkecil, tetapi tidak dapat dihilangkan selama masih ada tagihan.
  // The mandatory-task pop-up reopens every time the schedule page opens; it can
  // be minimised but not dismissed while anything is still due.
  const [pendingOpen, setPendingOpen] = useState(true);
  const pendingRows = reminderRows(useStudentReminders());
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [listOpen, setListOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Escape menutup bottom sheet; tanpanya pengguna papan ketik terkurung di balik lapisan gelap.
  // Escape closes the bottom sheet; without it keyboard users are stuck behind the dark overlay.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheetOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        // Ringkasan tugas boleh gagal sendiri; jadwal tetap tampil tanpanya.
        // The task outline may fail on its own; the schedule still shows without it.
        const [sessionsRes, tasksRes] = await Promise.all([
          fetch('/api/attendance/student'),
          fetch('/api/tasks/student/outline').catch(() => null),
        ]);
        if (sessionsRes.ok) {
          const body = await sessionsRes.json();
          setItems(body.sessions || []);
          setStandalone(body.standaloneExams || []);
        }
        if (tasksRes?.ok) setTasks((await tasksRes.json()).tasks || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const groups = useMemo(() => buildGroups(items, tasks, standalone), [items, tasks, standalone]);
  const entries = useMemo(() => groups.flatMap((g) => g.sections.flatMap((s) => s.entries)), [groups]);
  const groupOf = useMemo(() => {
    const map = new Map<string, Group>();
    for (const g of groups) for (const s of g.sections) for (const e of s.entries) map.set(e.key, g);
    return map;
  }, [groups]);

  useEffect(() => {
    if (selectedKey || groups.length === 0) return;
    // Tautan yang dibagikan membuka item yang sama. Item yang sudah dihapus
    // jatuh ke pilihan bawaan alih-alih layar kosong.
    //
    // A shared link opens the same item. An item that has since been removed
    // falls back to the default pick rather than a blank screen.
    const wanted = itemFromUrl();
    if (wanted && groupOf.has(wanted)) {
      setSelectedKey(wanted);
      setExpanded(new Set([groupOf.get(wanted)!.id]));
      return;
    }
    const g = pickInitial(groups);
    if (!g) return;
    const all = g.sections.flatMap((s) => s.entries);
    setSelectedKey((all.find((e) => e.kind === 'recording') ?? all[0])?.key ?? null);
    setExpanded(new Set([g.id]));
  }, [groups, groupOf, selectedKey]);

  // Tombol kembali/maju peramban berpindah antar-item yang pernah dibuka.
  // The browser back/forward buttons move between items opened before.
  useEffect(() => {
    function onPop() {
      const key = itemFromUrl();
      const g = key ? groupOf.get(key) : undefined;
      if (!key || !g) return;
      setSelectedKey(key);
      setExpanded((prev) => new Set(prev).add(g.id));
      setSheetOpen(false);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [groupOf]);

  const index = entries.findIndex((e) => e.key === selectedKey);
  const current = index >= 0 ? entries[index] : null;
  const currentGroup = current ? groupOf.get(current.key) : undefined;
  const materiCount = entries.filter((e) => e.kind !== 'info').length;

  function select(entry: Entry) {
    if (entry.key !== selectedKey) {
      window.history.pushState(null, '', `${window.location.pathname}?item=${encodeURIComponent(entry.key)}`);
    }
    setSelectedKey(entry.key);
    const g = groupOf.get(entry.key);
    if (g) setExpanded((prev) => new Set(prev).add(g.id));
    setSheetOpen(false);
    // Item baru dibuka dari atas. Di mobile yang bergulir adalah halaman; di
    // desktop area pemutar bergulir sendiri.
    //
    // A new item opens from the top. On mobile the page is what scrolls; on
    // desktop the player area scrolls on its own.
    if (window.matchMedia('(max-width: 899px)').matches) {
      viewerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      viewerRef.current?.scrollTo({ top: 0 });
    }
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const attendedCount = items.filter((i) => i.attendance).length;

  const navButton = (target: Entry | undefined, dir: 'prev' | 'next') => {
    const next = dir === 'next';
    return (
      <button
        type="button"
        disabled={!target}
        onClick={() => target && select(target)}
        aria-label={next ? 'Berikutnya' : 'Sebelumnya'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '10px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, border: 'none',
          background: !target
            ? 'var(--color-bg-student)'
            : next
              ? 'linear-gradient(135deg, var(--color-primary) 0%, #1aa3e0 100%)'
              : 'var(--color-primary-light)',
          color: !target ? 'var(--color-text-faint)' : next ? '#ffffff' : 'var(--color-primary)',
          boxShadow: target && next ? '0 4px 12px rgba(0, 114, 206, 0.3)' : 'none',
          cursor: target ? 'pointer' : 'default',
        }}
      >
        {next ? <><span className="cp-nav-label">Berikutnya</span> <ChevronRight size={16} /></> : <><ChevronLeft size={16} /> <span className="cp-nav-label">Sebelumnya</span></>}
      </button>
    );
  };

  return (
    <StudentShell>
      <div className="student-mobile-header" style={{ backgroundColor: 'var(--color-primary)', padding: '24px 16px 18px', paddingRight: '110px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
          Jadwal dan Rekaman
        </h1>
      </div>

      <div className="student-topbar" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid var(--color-student-border)', padding: '18px 28px', paddingRight: '200px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>Jadwal dan Rekaman</h1>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Future Innovators Bootcamp</p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Memuat jadwal kelas...</div>
      ) : groups.length === 0 ? (
        <div style={{ margin: '16px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '48px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-main)' }}>
          Tidak ada jadwal pertemuan
        </div>
      ) : (
        <div className="course-player">
          {sheetOpen && (
            <button type="button" className="cp-sheet-backdrop" aria-label="Tutup daftar materi" onClick={() => setSheetOpen(false)} />
          )}
          {!listOpen ? (
            <nav className="course-player__list course-player__list--collapsed" aria-label="Daftar materi">
              <button type="button" className="cp-collapsed-toggle" onClick={() => setListOpen(true)} aria-expanded={false}>
                <PanelRightOpen size={18} color="#ffffff" strokeWidth={2} />
                <span>Daftar Materi</span>
              </button>
            </nav>
          ) : (
            <nav className="course-player__list" data-sheet-open={sheetOpen} aria-label="Daftar materi">
              {/* Header menempel agar judul dan tombol tutup tetap terjangkau
                  saat daftar panjang digulir.

                  The header sticks so the title and the collapse button stay
                  within reach while a long list scrolls. */}
              <div style={{ position: 'sticky', top: 0, zIndex: 2, padding: '12px 16px 16px', background: 'linear-gradient(135deg, var(--color-primary) 0%, #1aa3e0 100%)', color: '#ffffff' }}>
                <span className="cp-sheet-handle" aria-hidden />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FolderOpen size={17} color="#ffffff" strokeWidth={2} />
                  <h2 style={{ fontSize: '15px', margin: 0, flex: 1, color: '#ffffff' }}>Daftar Materi</h2>
                  {/* Satu tombol: di desktop menciutkan panel, di mobile menutup bottom sheet.
                      One button: collapses the panel on desktop, closes the bottom sheet on mobile. */}
                  <button
                    type="button"
                    onClick={() => (window.matchMedia('(max-width: 899px)').matches ? setSheetOpen(false) : setListOpen(false))}
                    aria-label="Sembunyikan daftar materi"
                    title="Sembunyikan daftar materi"
                    style={{ width: '30px', height: '30px', borderRadius: '8px', border: 'none', backgroundColor: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <PanelRightClose className="cp-hide-mobile" size={16} color="#ffffff" strokeWidth={2} />
                    <X className="cp-hide-desktop" size={16} color="#ffffff" strokeWidth={2} />
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', marginTop: '4px' }}>
                  {items.length} pertemuan · {materiCount} materi & tugas
                </p>
                {items.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                      <div style={{ width: `${(attendedCount / items.length) * 100}%`, height: '100%', borderRadius: '3px', backgroundColor: 'var(--color-highlight-yellow)' }} />
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>
                      Hadir {attendedCount} dari {items.length} pertemuan
                    </div>
                  </div>
                )}
              </div>

              {groups.map((g, gi) => {
                const open = expanded.has(g.id);
                const badge = g.item?.isActive
                  ? { bg: 'var(--color-success)', fg: '#ffffff' }
                  : g.item?.attendance
                    ? { bg: 'var(--color-primary)', fg: '#ffffff' }
                    : g.item
                      ? { bg: 'var(--color-primary-light)', fg: 'var(--color-primary)' }
                      : g.accent
                        ? { bg: 'linear-gradient(135deg, #a16207 0%, #eab308 100%)', fg: '#ffffff' }
                        : { bg: KIND_COLORS.task.bg, fg: KIND_COLORS.task.fg };
                const tint = g.accent?.fg ?? 'var(--color-primary)';
                return (
                  <div key={g.id} style={{ borderBottom: '1px solid var(--color-student-border)' }}>
                    <button
                      type="button"
                      onClick={() => toggle(g.id)}
                      aria-expanded={open}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
                        background: open
                          ? `linear-gradient(90deg, ${g.accent?.bg ?? 'var(--color-primary-light)'} 0%, #ffffff 100%)`
                          : g.accent ? `linear-gradient(90deg, ${g.accent.bg}88 0%, #ffffff 70%)` : 'none',
                      }}
                    >
                      <span style={{ width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: badge.bg, color: badge.fg, fontFamily: 'var(--font-heading)', fontSize: '12px', fontWeight: 700 }}>
                        {g.number ?? (g.id === 'pretest' || g.id === 'postest' ? <ClipboardCheck size={14} strokeWidth={2.2} /> : g.id === 'capstone' ? <Trophy size={14} strokeWidth={2.2} /> : <ClipboardList size={14} strokeWidth={2.2} />)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>
                            {g.item ? sessionMeta(g.item) : g.meta ?? `${g.sections.reduce((n, s) => n + s.entries.length, 0)} tugas`}
                          </span>
                          {g.item?.isActive && (
                            <span style={{ fontSize: '8px', fontWeight: 700, color: '#ffffff', backgroundColor: 'var(--color-success)', padding: '2px 6px', borderRadius: '10px' }}>BERLANGSUNG</span>
                          )}
                          {g.item?.attendance && (
                            <span style={{ fontSize: '8px', fontWeight: 700, color: 'var(--color-success)', backgroundColor: 'var(--color-success-light)', padding: '2px 6px', borderRadius: '10px' }}>HADIR</span>
                          )}
                        </div>
                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: g.accent ? 700 : 600, color: open || g.accent ? tint : 'var(--color-text-main)', lineHeight: 1.4 }}>
                          {g.title}
                        </div>
                      </div>
                      <ChevronDown
                        size={16}
                        color={open ? tint : 'var(--color-text-faint)'}
                        style={{ flexShrink: 0, marginTop: '6px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
                      />
                    </button>

                    {open && (
                      <div style={{ paddingBottom: '8px' }}>
                        {g.sections.map((s) => (
                          <div key={s.label}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px 4px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: s.color ?? KIND_COLORS[s.kind].fg }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: s.color ?? KIND_COLORS[s.kind].fg }} />
                              {s.label}
                            </div>
                            {s.entries.map((e) => (
                              <EntryRow key={e.key} entry={e} active={e.key === selectedKey} onSelect={() => select(e)} />
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          )}

          <div ref={viewerRef} className="course-player__viewer" style={{ scrollMarginTop: '12px' }}>
            {current && (
              <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
                {/* Tanggal dan jam hanya pada Info Pertemuan; selainnya cukup nama materinya.
                    Tugas, kuis, dan survei memuat judulnya di dalam kartu.

                    Date and time only on the meeting info; anything else shows just its name.
                    Tasks, quizzes and surveys carry their title inside the card. */}
                {(current.kind === 'info' || current.kind === 'recording' || current.kind === 'material') && (
                  <div style={{ marginBottom: '14px' }}>
                    {current.kind === 'info' && currentGroup?.item && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-faint)', marginBottom: '2px' }}>{sessionMeta(currentGroup.item)}</div>
                    )}
                    <h2 style={{ fontSize: '17px', overflowWrap: 'anywhere' }}>
                      {current.kind === 'info' ? currentGroup?.title : current.title}
                    </h2>
                  </div>
                )}
                <div style={{ paddingBottom: '16px' }}>
                  <Stage entry={current} />
                </div>
              </div>
            )}
            {current && (
              <div className="cp-navbar">
                {navButton(entries[index - 1], 'prev')}
                <button
                  type="button"
                  className="cp-sheet-trigger"
                  onClick={() => {
                    setListOpen(true);
                    setSheetOpen(true);
                  }}
                  aria-expanded={sheetOpen}
                  style={{ flex: 1, minWidth: 0, justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '10px 14px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--color-highlight-yellow)', color: 'var(--color-text-main)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  <ListIcon size={14} strokeWidth={2.2} /> Daftar Materi
                </button>
                {navButton(entries[index + 1], 'next')}
              </div>
            )}
          </div>
        </div>
      )}
      {pendingRows.length > 0 && (pendingOpen ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, backgroundColor: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div role="dialog" aria-modal="true" aria-labelledby="pending-title" style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: 'min(460px, 100%)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '18px 20px 12px', background: 'linear-gradient(135deg, #fff3c4 0%, #fff8e5 100%)', borderBottom: '1px solid #fde7a8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BellRing size={22} color="#b45309" />
                <h2 id="pending-title" style={{ fontSize: '16px', margin: 0, color: '#7c2d12' }}>Selesaikan dulu kuis dan feedback</h2>
              </div>
              <p style={{ fontSize: '12px', color: '#7c2d12', margin: '6px 0 0', lineHeight: 1.5 }}>
                Ada {pendingRows.length} hal wajib yang belum kamu kerjakan. Pengingat ini akan muncul setiap kali kamu membuka Jadwal sampai semuanya selesai.
              </p>
            </div>
            <div style={{ padding: '8px', overflowY: 'auto' }}>
              {pendingRows.map((r) => <ReminderItem key={r.key} row={r} />)}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-student-border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPendingOpen(false)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)', cursor: 'pointer' }}
              >
                <Minimize2 size={14} /> Perkecil, kerjakan nanti
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" className="pending-chip" onClick={() => setPendingOpen(true)} aria-label={`${pendingRows.length} hal wajib belum dikerjakan, buka daftar`}>
          <BellRing size={16} /> {pendingRows.length} wajib belum selesai
        </button>
      ))}
    </StudentShell>
  );
}
