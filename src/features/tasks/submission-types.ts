// Definisi tipe data submission tugas dan penilaian / Task submission and grading type definitions
import type { TaskKind, MaterialLink } from './types';

export interface SubmissionDocument {
  id: string; // ${taskId}_${studentId}
  taskId: string;
  taskKind: TaskKind;
  taskTitle?: string;
  classId: string;
  className?: string;
  studentId: string;
  studentName: string;
  fileId: string | null;
  fileName: string | null;
  url: string | null;
  firstSubmittedAt: string;
  submittedAt: string;
  late: boolean;
  version: number;
  score: number | null; // null jika belum dinilai / null if not yet graded
  gradedAt: string | null;
  feedbackPreview: string | null; // maks 160 karakter / max 160 chars
  gradedBy?: string | null;
}

export interface SubmissionFeedbackDocument {
  id: string; // sama dengan submissionId / same as submissionId
  text: string;
  gradedVersion: number;
  gradedBy: string;
  updatedAt: string;
}

export interface SubmitTaskInput {
  taskId: string;
  fileId?: string | null;
  fileName?: string | null;
  url?: string | null;
}

export interface GradeSubmissionInput {
  submissionId: string;
  score: number;
  feedback: string;
  correctionReason?: string;
}

export interface StudentTaskItem {
  task: {
    id: string;
    classId: string;
    kind: TaskKind;
    title: string;
    order: number;
    dueAt: string | null;
    briefUrl: string | null;
    briefFileName?: string | null;
    description: string;
    /** Bahan praktik yang dapat diunduh / Practice materials to download */
    materials?: MaterialLink[];
    /** Pertemuan induk bagi working paper / Parent meeting for a working paper */
    sessionId?: string | null;
  };
  submission: SubmissionDocument | null;
  feedback?: string | null;
  isUnlocked: boolean; // Khusus capstone / Specially for capstone
}
