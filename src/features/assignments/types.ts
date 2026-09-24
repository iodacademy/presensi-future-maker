// Tipe data assignment mentor per fase / Mentor assignment per phase data types
export type Phase = 'bootcamp' | 'internship';

export interface AssignmentDocument {
  id: string; // ${studentId}_${phase}
  studentId: string;
  classId: string;
  phase: Phase;
  mentorId: string;
  mentorName?: string;
  studentName?: string;
  updatedAt: string;
}

export interface AssignMentorInput {
  studentId: string;
  classId: string;
  mentorId: string;
  phase: Phase;
}
