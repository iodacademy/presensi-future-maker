// Tipe data manajemen kelas / Class management data types
export type ClassStatus = 'draft' | 'active' | 'archived';

export interface ClassDocument {
  id: string;
  city: string;
  programName: string;
  canonicalName: string;
  classKey: string;
  status: ClassStatus;
  mentorIds: string[];
  requiredDailyTaskIds: string[];
  capstoneTaskId: string | null;
  mentorCount: number;
  studentCount: number;
  dailyTaskCount: number;
  capstoneTaskCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClassInput {
  city: string;
  programName: string;
  mentorIds?: string[];
}

export interface ClassSummary {
  id: string;
  city: string;
  programName: string;
  canonicalName: string;
  status: ClassStatus;
  mentorCount: number;
  studentCount: number;
  dailyTaskCount: number;
  capstoneTaskCount: number;
  mentorNames?: string[];
}
