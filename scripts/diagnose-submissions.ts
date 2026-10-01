/**
 * Memeriksa kenapa daftar pengumpulan sebuah kelas kosong. Hanya membaca.
 *
 * Daftar kosong punya beberapa sebab yang tidak dapat dibedakan dari layar:
 * tugasnya belum dibuat, sudah dibuat tetapi belum terbit, sudah terbit tetapi
 * belum ada yang mengumpulkan, atau sudah dikumpulkan tetapi tersimpan dengan
 * jenis yang berbeda.
 *
 * Checks why a class's submission list is empty. Read-only.
 *
 * An empty list has several causes that look identical on screen: the task was
 * never created, created but unpublished, published but nobody submitted, or
 * submitted but stored under a different kind.
 *
 * Jalankan / Run:
 *   npx tsx scripts/diagnose-submissions.ts [kata-kunci-kelas]
 */
import { getAdminDb } from '../src/lib/firebase/admin';
import { TASK_KIND_LABELS, type TaskKind } from '../src/features/tasks/types';
import type { ClassDocument } from '../src/features/classes/types';

async function main() {
  const filter = (process.argv[2] ?? '').toLowerCase();
  const db = getAdminDb();

  const [classSnap, taskSnap, subSnap] = await Promise.all([
    db.collection('classes').get(),
    db.collection('tasks').get(),
    db.collection('submissions').get(),
  ]);

  const kelas = classSnap.docs
    .map((d) => d.data() as ClassDocument)
    .filter((c) => !filter || c.canonicalName.toLowerCase().includes(filter));

  if (kelas.length === 0) {
    console.log('Tidak ada kelas yang cocok.');
    return;
  }

  const tasks = taskSnap.docs.map((d) => d.data() as { id: string; classId: string; kind: TaskKind; title: string; published: boolean });
  const subs = subSnap.docs.map((d) => d.data() as { taskId: string; classId: string; taskKind: TaskKind; score: number | null });

  for (const c of kelas) {
    console.log(`\n=== ${c.canonicalName} (${c.studentCount} peserta) ===`);

    for (const kind of Object.keys(TASK_KIND_LABELS) as TaskKind[]) {
      const tugasnya = tasks.filter((t) => t.classId === c.id && t.kind === kind);
      const terbit = tugasnya.filter((t) => t.published);
      const kumpul = subs.filter((s) => s.classId === c.id && s.taskKind === kind);
      const dinilai = kumpul.filter((s) => s.score !== null && s.score !== undefined);

      console.log(`\n  ${TASK_KIND_LABELS[kind]}`);
      console.log(`    tugas dibuat : ${tugasnya.length} (${terbit.length} terbit)`);
      console.log(`    dikumpulkan  : ${kumpul.length}`);
      console.log(`    sudah dinilai: ${dinilai.length}`);

      if (tugasnya.length === 0) {
        console.log(`    SEBAB        : belum ada tugas jenis ini di kelas ini.`);
      } else if (terbit.length === 0) {
        console.log(`    SEBAB        : tugasnya ada tetapi belum terbit, jadi peserta belum melihatnya.`);
        for (const t of tugasnya) console.log(`                   - ${t.title}`);
      } else if (kumpul.length === 0) {
        console.log(`    SEBAB        : sudah terbit, tetapi belum ada peserta yang mengumpulkan.`);
      }
    }
  }

  // Pengumpulan yang jenisnya tidak dikenal tidak akan pernah muncul pada
  // penyaring mana pun di layar.
  //
  // A submission whose kind is unknown never appears under any on-screen
  // filter.
  const asing = subs.filter((s) => !(s.taskKind in TASK_KIND_LABELS));
  if (asing.length > 0) {
    console.log(`\n!! ${asing.length} pengumpulan berjenis tidak dikenal: ${[...new Set(asing.map((s) => String(s.taskKind)))].join(', ')}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
