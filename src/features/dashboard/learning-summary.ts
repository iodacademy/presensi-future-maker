import { GRADE_WEIGHTS } from '../grading/types';
import { PLACEMENT_RULES, type Placement } from '../grading/placement';
import { isOpenApplication, type ApplicationStatus, type PlacedAt, type Scheme } from '../careers/model';
import { tierOf, type Tier } from '../careers/tier';

/**
 * Ringkasan belajar di beranda siswa: lulus atau belum, dari mana nilainya,
 * dan sampai mana perjalanan magangnya. Modul murni supaya setiap keadaan
 * dapat diuji tanpa basis data.
 *
 * The learning summary on the student home: passed or not, where the score
 * comes from, and how far the internship journey has gone. A pure module so
 * every state can be tested without a database.
 */

/** SPA minimal untuk lulus, sama dengan rubrik sheet tracking / Minimum SPA to pass, as in the tracking sheet rubric */
export const PASS_SPA = 60;

export interface SummaryRow {
  score: number; capstone: number; tasks: number; attendance: number; quiz: number; combined: number; absent: number;
  placement: Placement; placementReasons: string[];
  /** Ada komponen yang belum dinilai / Some component is not graded yet */
  pending: boolean;
}

export type SummaryState = 'menunggu' | 'ditempatkan' | 'full' | 'project' | 'tidak-ditempatkan' | 'belum-lulus';
type StepStatus = 'done' | 'current' | 'todo';

export interface LearningSummary {
  state: SummaryState;
  score: number;
  scheme: Scheme | null;
  tier: Tier | null;
  components: { key: keyof typeof GRADE_WEIGHTS; label: string; weight: number; score: number; contribution: number }[];
  requirements: { label: string; value: number; ok: boolean }[];
  reasons: string[];
  internship: PlacedAt | null;
  applications: { running: number; nextInterview: { date: string; start: string } | null };
  applyUntil: string | null;
  steps: { label: string; status: StepStatus }[];
}

const LABELS: Record<keyof typeof GRADE_WEIGHTS, string> = { capstone: 'Capstone', tasks: 'TPM', attendance: 'Kehadiran', quiz: 'Kuis' };
const STEPS = ['Bootcamp', 'Lulus', 'Berhak magang', 'Melamar', 'Ditempatkan'];

function stateOf(row: SummaryRow, placed: boolean): SummaryState {
  if (placed) return 'ditempatkan';
  if (row.pending || row.placement === 'pending') return 'menunggu';
  if (row.score < PASS_SPA) return 'belum-lulus';
  return row.placement === 'full' ? 'full' : row.placement === 'project' ? 'project' : 'tidak-ditempatkan';
}

// Jumlah tahap yang sudah selesai dan tahap yang sedang berjalan / How many steps are done and which one is current
const PROGRESS: Record<SummaryState, [number, number | null]> = {
  menunggu: [1, 1], 'belum-lulus': [1, null], 'tidak-ditempatkan': [2, null], full: [3, 3], project: [3, 3], ditempatkan: [5, null],
};

export function buildLearningSummary(input: {
  row: SummaryRow;
  placedAt: PlacedAt | null;
  apps: { status: ApplicationStatus | string; interview?: { date: string; start: string } | null }[];
  applyUntil: string | null;
}): LearningSummary {
  const { row } = input;
  const state = stateOf(row, input.placedAt !== null);
  const scheme: Scheme | null = state === 'ditempatkan' || state === 'full' ? 'full' : state === 'project' ? 'project' : null;

  // Syarat yang ditampilkan: skema yang didapat, atau Project Based bagi yang lulus tanpa skema
  // Requirements shown: the scheme obtained, or Project Based for those who passed without one
  const rules = state === 'full' ? PLACEMENT_RULES.full : state === 'project' || state === 'tidak-ditempatkan' ? PLACEMENT_RULES.project : null;
  const requirements = rules ? [
    { label: `SPA min. ${rules.spa}`, value: row.score, ok: row.score >= rules.spa },
    { label: `TPM + capstone min. ${rules.combined}`, value: row.combined, ok: row.combined >= rules.combined },
    { label: `Absen maks. ${rules.maxAbsent} kali`, value: row.absent, ok: row.absent <= rules.maxAbsent },
  ] : [];

  const running = input.apps.filter((a) => isOpenApplication(a.status as ApplicationStatus));
  const nextInterview = running
    .filter((a) => a.status === 'interview' && a.interview?.date)
    .map((a) => ({ date: a.interview!.date, start: a.interview!.start }))
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))[0] ?? null;

  const [done, current] = PROGRESS[state];
  return {
    state,
    score: row.score,
    scheme,
    tier: scheme ? tierOf(row.score) : null,
    components: (Object.keys(GRADE_WEIGHTS) as (keyof typeof GRADE_WEIGHTS)[]).map((key) => ({
      key, label: LABELS[key], weight: GRADE_WEIGHTS[key], score: row[key], contribution: Math.round((row[key] * GRADE_WEIGHTS[key]) / 100),
    })),
    requirements,
    reasons: row.placementReasons,
    internship: input.placedAt,
    applications: { running: running.length, nextInterview },
    applyUntil: input.applyUntil,
    steps: STEPS.map((label, i) => ({ label, status: i < done ? 'done' : i === current ? 'current' : 'todo' })),
  };
}
