// Definisi tipe data slot mentoring dan booking 1-on-1 / Mentoring slot and 1-on-1 booking type definitions
import type { Phase } from '../assignments/types';

export type SlotStatus = 'available' | 'booked' | 'completed';

export interface MentoringSlotDocument {
  id: string;
  classId: string;
  className?: string;
  phase: Phase;
  mentorId: string;
  mentorName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm (WIB)
  endTime: string; // HH:mm (WIB)
  startsAt: string; // ISO UTC
  endsAt: string; // ISO UTC
  status: SlotStatus;
  bookingId: string | null;
  studentId: string | null;
  studentName: string | null;
  // Terisi hanya setelah slot dibooking / Populated only once the slot is booked
  meetUrl: string | null;
  calendarEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MentoringBookingDocument {
  id: string;
  slotId: string;
  classId: string;
  phase: Phase;
  studentId: string;
  studentName: string;
  mentorId: string;
  mentorName: string;
  date: string;
  startTime: string;
  endTime: string;
  startsAt: string;
  endsAt: string;
  meetUrl: string | null;
  calendarEventId: string | null;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
  cancelledAt?: string | null;
}

export interface CreateSlotInput {
  classId: string;
  phase: Phase;
  mentorId: string;
  date: string;
  startTime: string;
}

export interface BookSlotInput {
  slotId: string;
  acknowledgeEarlySecondSession?: boolean;
}

export interface MentoringStudentView {
  assignedMentor: {
    uid: string;
    name: string;
    email: string;
  } | null;
  quotaUsed: number;
  maxQuota: number;
  slots: (MentoringSlotDocument & { isMyBooking: boolean })[];
}
