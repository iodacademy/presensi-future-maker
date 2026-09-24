// Layanan validasi dan penyimpanan batch akun pengguna / User account batch validation and commit service
import crypto from 'crypto';
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor, UserDocument } from '../auth/types';
import type { ImportRow, ImportPreviewResult, ValidatedImportRow } from './import-types';
import { normalizeImportRow, validateImportRows } from './import-policy';
import { getEmailHash } from '../auth/policy';
import type { ClassDocument } from '../classes/types';

/**
 * Membuat pratinjau impor akun dan memeriksa keberadaan kelas serta duplikasi email di Firestore.
 *
 * Previews account import and checks class existence and email duplication in Firestore.
 */
export async function previewAccountImport(
  actor: Actor,
  rawRows: Record<string, any>[],
  forcedClassName?: string
): Promise<ImportPreviewResult> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan mengimpor akun');
  }

  const db = getAdminDb();

  // Ambil daftar seluruh kelas yang terdaftar / Fetch all registered classes
  const classesSnap = await db.collection('classes').get();
  const classMap = new Map<string, ClassDocument>(); // normalized canonicalName -> classDoc
  for (const doc of classesSnap.docs) {
    const data = doc.data() as ClassDocument;
    classMap.set(data.canonicalName.trim().toLowerCase(), data);
    classMap.set(data.programName.trim().toLowerCase(), data); // juga izinkan pencocokan nama program saja jika unik
  }

  const validClassNamesNormalized = Array.from(classMap.keys());

  // Normalisasi setiap baris / Normalize each row
  const parsedRows: ImportRow[] = rawRows.map((raw) => {
    const row = normalizeImportRow(raw);
    if (forcedClassName) {
      row.className = forcedClassName;
    }
    return row;
  });

  // Validasi aturan dasar / Validate basic rules
  const { isValid: basicValid, validatedRows } = validateImportRows(parsedRows, validClassNamesNormalized);

  // Periksa duplikasi email terhadap database Firestore / Check email collision against Firestore
  const checkedRows: ValidatedImportRow[] = await Promise.all(
    validatedRows.map(async (row) => {
      if (row.status === 'DITOLAK') return row;

      const hash = getEmailHash(row.email);
      const indexDoc = await db.collection('emailIndex').doc(hash).get();
      if (indexDoc.exists) {
        return {
          ...row,
          status: 'DITOLAK',
          errors: [...row.errors, 'Email sudah terdaftar di database'],
        };
      }
      return row;
    })
  );

  const invalidCount = checkedRows.filter((r) => r.status === 'DITOLAK').length;
  const validCount = checkedRows.length - invalidCount;

  return {
    totalRows: checkedRows.length,
    validCount,
    invalidCount,
    isValid: invalidCount === 0,
    rows: checkedRows,
  };
}

/**
 * Menyimpan seluruh baris impor akun secara atomik (All-or-Nothing).
 * Jika ada 1 baris yang ditolak, seluruh operasi dibatalkan dan 0 akun disimpan.
 *
 * Saves all import rows atomically (All-or-Nothing).
 * If any single row fails validation, the entire batch is aborted and 0 accounts are saved.
 */
export async function commitAccountImport(
  actor: Actor,
  rawRows: Record<string, any>[],
  forcedClassName?: string
): Promise<{ createdCount: number }> {
  const preview = await previewAccountImport(actor, rawRows, forcedClassName);

  if (!preview.isValid) {
    throw new Error('Impor dibatalkan: Terdapat data yang tidak valid. Perbaiki seluruh kesalahan sebelum menyimpan.');
  }

  const db = getAdminDb();
  const classesSnap = await db.collection('classes').get();
  const classMap = new Map<string, ClassDocument>();
  for (const doc of classesSnap.docs) {
    const data = doc.data() as ClassDocument;
    classMap.set(data.canonicalName.trim().toLowerCase(), data);
    classMap.set(data.programName.trim().toLowerCase(), data);
  }

  const now = new Date().toISOString();
  const batch = db.batch();

  // Hitung penambahan peserta & mentor per kelas / Track student & mentor count delta per class
  const classStudentsDelta = new Map<string, number>();
  const classNewMentors = new Map<string, Set<string>>();

  for (const row of preview.rows) {
    const classDoc = classMap.get(row.className.trim().toLowerCase());
    const classId = classDoc ? classDoc.id : null;
    const uid = crypto.randomUUID();
    const hash = getEmailHash(row.email);

    const userDoc: UserDocument = {
      uid,
      email: row.email,
      normalizedEmail: row.email,
      name: row.name,
      role: row.role,
      active: true,
      classId: row.role === 'student' ? classId : null,
      createdAt: now,
      updatedAt: now,
    };

    batch.set(db.collection('users').doc(uid), userDoc);
    batch.set(db.collection('emailIndex').doc(hash), {
      uid,
      normalizedEmail: row.email,
      role: row.role,
      createdAt: now,
    });

    if (classId) {
      if (row.role === 'student') {
        classStudentsDelta.set(classId, (classStudentsDelta.get(classId) || 0) + 1);
      } else if (row.role === 'mentor') {
        if (!classNewMentors.has(classId)) classNewMentors.set(classId, new Set());
        classNewMentors.get(classId)!.add(uid);
      }
    }
  }

  // Perbarui counter di dokumen kelas / Update counters in class documents
  for (const [classId, delta] of classStudentsDelta.entries()) {
    const ref = db.collection('classes').doc(classId);
    const doc = await ref.get();
    if (doc.exists) {
      const current = doc.data()?.studentCount || 0;
      batch.update(ref, { studentCount: current + delta, updatedAt: now });
    }
  }

  for (const [classId, mentorUids] of classNewMentors.entries()) {
    const ref = db.collection('classes').doc(classId);
    const doc = await ref.get();
    if (doc.exists) {
      const existingMentors: string[] = doc.data()?.mentorIds || [];
      const updatedMentors = Array.from(new Set([...existingMentors, ...Array.from(mentorUids)]));
      batch.update(ref, {
        mentorIds: updatedMentors,
        mentorCount: updatedMentors.length,
        updatedAt: now,
      });
    }
  }

  await batch.commit();

  return { createdCount: preview.rows.length };
}
