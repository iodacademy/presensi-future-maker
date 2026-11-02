/**
 * Bank CV dan surat lamaran siswa. Berkas privat di bucket default dan hanya
 * dibuka lewat server; tidak pernah ditimpa atau dihapus, karena lamaran yang
 * sudah terkirim harus tetap menunjuk berkas yang sama.
 *
 * Students' CV and cover-letter bank. Files are private in the default bucket
 * and only opened through the server; never overwritten or deleted, because a
 * submitted application must keep pointing at the same file.
 */
import { getAdminDb, getAdminStorage } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import type { CvFile, CvKind } from './model';

export const MAX_PDF_BYTES = 2 * 1024 * 1024;
const MAX_ACTIVE = 5;
// Berkas terhapus tetap disimpan untuk lamaran lama, jadi unggah-hapus berulang dibatasi agar penyimpanan tidak tumbuh tanpa batas
// Deleted files stay stored for older applications, so repeated upload-delete is capped to keep storage from growing without bound
const MAX_TOTAL = 20;
const KIND_NAME: Record<CvKind, string> = { cv: 'CV', surat: 'surat lamaran' };

const cvs = () => getAdminDb().collection('studentCvs');
const cleanName = (n: string) => n.replace(/[\\/\r\n"]/g, '_').trim().slice(0, 120) || 'berkas.pdf';

async function allCvs(uid: string, kind?: CvKind): Promise<CvFile[]> {
  const snap = await cvs().where('ownerUid', '==', uid).get();
  return snap.docs.map((d) => ({ ...(d.data() as CvFile), id: d.id })).filter((c) => !kind || c.kind === kind);
}

export async function listCvs(uid: string, kind?: CvKind): Promise<CvFile[]> {
  return (await allCvs(uid, kind)).filter((c) => !c.deleted).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function uploadCv(uid: string, kind: CvKind, file: { name: string; type: string; size: number; bytes: Buffer }): Promise<CvFile> {
  if (kind !== 'cv' && kind !== 'surat') throw new Error('Jenis berkas tidak dikenal');
  if (file.size > MAX_PDF_BYTES || file.bytes.length > MAX_PDF_BYTES) throw new Error('Ukuran PDF maksimal 2 MB');
  // Isi diperiksa, bukan hanya nama dan jenis kiriman peramban yang dapat dipalsukan
  // The content is checked, not only the browser-sent name and type, which can be forged
  if (!/\.pdf$/i.test(file.name) || file.bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('Berkas harus PDF');
  const all = await allCvs(uid, kind);
  if (all.length >= MAX_TOTAL) throw new Error(`Batas unggahan ${KIND_NAME[kind]} tercapai. Hubungi admin.`);
  if (all.filter((c) => !c.deleted).length >= MAX_ACTIVE) {
    throw new Error(`Maksimal ${MAX_ACTIVE} ${KIND_NAME[kind]} tersimpan. Hapus salah satu dulu.`);
  }
  const ref = cvs().doc();
  const storagePath = `cv/${uid}/${ref.id}.pdf`;
  await getAdminStorage().bucket().file(storagePath).save(file.bytes, { contentType: 'application/pdf' });
  const cv: CvFile = { id: ref.id, ownerUid: uid, kind, fileName: cleanName(file.name), size: file.bytes.length, storagePath, uploadedAt: new Date().toISOString(), deleted: false };
  const { id: _id, ...doc } = cv;
  await ref.set(doc);
  return cv;
}

export async function deleteCv(uid: string, id: string): Promise<void> {
  const snap = await cvs().doc(id).get();
  if (!snap.exists || (snap.data() as CvFile).ownerUid !== uid) throw new Error('CV tidak ditemukan');
  await cvs().doc(id).update({ deleted: true });
}

// PIC hanya boleh membuka berkas yang dikirim ke lamaran perusahaannya / A PIC may only open files sent with an application to their company
async function sentToPartner(partnerId: string, id: string): Promise<boolean> {
  const apps = getAdminDb().collection('jobApplications').where('partnerId', '==', partnerId);
  const [asCv, asCover] = await Promise.all([apps.where('cvId', '==', id).select().get(), apps.where('coverLetterId', '==', id).select().get()]);
  return !asCv.empty || !asCover.empty;
}

/**
 * Pemilik, admin, dan PIC mitra yang menerima lamarannya boleh membuka.
 *
 * The owner, admins, and the partner PIC who received the application may open it.
 */
export async function readCvFile(actor: Actor, id: string): Promise<{ buffer: Buffer; fileName: string }> {
  const snap = await cvs().doc(id).get();
  const cv = snap.exists ? (snap.data() as CvFile) : null;
  const allowed = !!cv && (actor.role === 'admin' || cv.ownerUid === actor.uid
    || (actor.role === 'partner' && !!actor.partnerId && (await sentToPartner(actor.partnerId, id))));
  if (!cv || !allowed) throw new Error('Tidak boleh membuka berkas ini');
  const [buffer] = await getAdminStorage().bucket().file(cv.storagePath).download();
  return { buffer, fileName: cv.fileName };
}
