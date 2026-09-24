// Mengubah nama kota sebuah kelas beserta seluruh turunannya
// Renames a class's city along with everything derived from it
import { getAdminDb } from '../src/lib/firebase/admin';
import { formatCanonicalClassName, generateClassKey } from '../src/features/classes/policy';
import type { ClassDocument } from '../src/features/classes/types';

/**
 * Nama kota tersebar ke empat tempat sekaligus: field `city`, `canonicalName`
 * yang disusun darinya, `classKey` pada dokumen kelas, dan dokumen `classKeys`
 * yang ID-nya adalah kunci itu sendiri.
 *
 * ID dokumen Firestore tidak dapat diubah, sehingga entri `classKeys` yang baru
 * dibuat dan yang lama dihapus. Bila yang lama tertinggal, kombinasi Kota+Program
 * itu terkunci selamanya dan tidak dapat dipakai lagi.
 *
 * Salinan nama kelas pada sesi, pengumpulan, dan slot mentoring sengaja tidak
 * diubah: keduanya adalah potret keadaan saat dokumen itu dibuat, bukan rujukan
 * hidup, dan memperbaruinya menulis ulang riwayat.
 *
 * A city name spreads across four places at once: the `city` field, the
 * `canonicalName` built from it, the `classKey` on the class document, and the
 * `classKeys` document whose ID is that key.
 *
 * A Firestore document ID cannot be changed, so the new `classKeys` entry is
 * created and the old one deleted. Left behind, that City+Program combination
 * stays locked forever and can never be used again.
 *
 * Copies of the class name on sessions, submissions, and mentoring slots are
 * deliberately left alone: those are snapshots of the moment each document was
 * written, not live references, and updating them rewrites history.
 */
async function main() {
  const fromCity = process.argv[2];
  const toCity = process.argv[3];
  const apply = process.argv.includes('--apply');

  if (!fromCity || !toCity) {
    console.error('Sebutkan nama kota lama dan barunya.');
    console.error('  npm run rename-class-city -- "Jakarta" "DKI Jakarta"\n');
    process.exit(1);
  }

  const db = getAdminDb();
  const snap = await db.collection('classes').where('city', '==', fromCity).get();

  if (snap.empty) {
    console.log(`\nTidak ada kelas dengan kota "${fromCity}".`);
    const all = await db.collection('classes').get();
    console.log('Kota yang ada:');
    for (const d of all.docs) {
      console.log(`  "${(d.data() as ClassDocument).city}"`);
    }
    console.log('');
    return;
  }

  for (const doc of snap.docs) {
    const cls = doc.data() as ClassDocument;
    const newCanonical = formatCanonicalClassName(cls.programName, toCity);
    const newKey = generateClassKey(toCity, cls.programName);

    console.log(`\n${cls.canonicalName}`);
    console.log(`  city          : "${cls.city}" -> "${toCity}"`);
    console.log(`  canonicalName : "${cls.canonicalName}" -> "${newCanonical}"`);
    console.log(`  classKey      : "${cls.classKey}" -> "${newKey}"`);

    if (newKey === cls.classKey) {
      console.log('  (kunci tidak berubah, tidak ada yang perlu dikerjakan)');
      continue;
    }

    const bentrok = await db.collection('classKeys').doc(newKey).get();
    if (bentrok.exists && bentrok.data()?.classId !== cls.id) {
      console.error(`  ! GAGAL: kunci "${newKey}" sudah dipakai kelas lain`);
      continue;
    }

    if (!apply) continue;

    await db.runTransaction(async (tx) => {
      tx.update(doc.ref, {
        city: toCity,
        canonicalName: newCanonical,
        classKey: newKey,
        updatedAt: new Date().toISOString(),
      });
      tx.set(db.collection('classKeys').doc(newKey), {
        classId: cls.id,
        createdAt: new Date().toISOString(),
      });
      tx.delete(db.collection('classKeys').doc(cls.classKey));
    });

    console.log('  tersimpan');
  }

  console.log('');
  if (!apply) {
    console.log('Ini mode pratinjau -- tidak ada yang ditulis.');
    console.log('Jalankan ulang dengan --apply untuk menerapkan.\n');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Gagal:', err);
    process.exit(1);
  });
