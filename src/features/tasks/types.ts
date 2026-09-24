// Definisi tipe data tugas dan kurikulum / Task and curriculum data type definitions
export type TaskKind = 'daily' | 'capstone';

export interface TaskDocument {
  id: string;
  classId: string;
  kind: TaskKind;
  title: string;
  order: number;
  dueAt: string | null;
  briefUrl: string | null;
  briefFileName?: string | null;
  published: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDetailDocument {
  id: string; // sama dengan taskId / same as taskId
  description: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  classId: string;
  kind: TaskKind;
  title: string;
  description: string;
  dueAt?: string | null;
  briefUrl?: string | null;
  briefFileName?: string | null;
  order?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  dueAt?: string | null;
  briefUrl?: string | null;
  briefFileName?: string | null;
}

export interface TaskSummary extends TaskDocument {
  description?: string;
}

export interface ClassActivationResult {
  canActivate: boolean;
  reason?: string;
}
