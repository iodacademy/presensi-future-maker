import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getClassExamScores } from '@/features/exams/service';
import { EXAM_KIND_LABELS } from '@/features/exams/types';
import { wibDate } from '@/lib/time';

/**
 * Rekap nilai seluruh ujian satu kelas sebagai CSV.
 *
 * Satu baris per peserta, satu kolom per ujian: pretest, kuis menurut tanggal
 * pertemuannya, lalu posttest. Satu berkas untuk satu kelas, bukan satu
 * jurusan: kuis pertemuan ketiga di Yogyakarta dan di Surabaya adalah ujian
 * berbeda dengan soal berbeda, dan menyatukannya ke satu kolom menyajikan dua
 * angka yang tidak sebanding seolah setara.
 *
 * Every exam's scores for one class, as CSV.
 *
 * One row per participant, one column per exam: the pretest, quizzes by their
 * meeting date, then the posttest. One file per class rather than per stream: the
 * third meeting's quiz in Yogyakarta and in Surabaya are different exams with
 * different questions, and merging them into one column would present two
 * incomparable numbers as if they were the same.
 */
export async function GET(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan mengekspor data' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get('classId');
  if (!classId) {
    return NextResponse.json({ error: 'Kelas wajib disebutkan' }, { status: 400 });
  }

  try {
    const data = await getClassExamScores(actor, classId);

    if (data.exams.length === 0) {
      return NextResponse.json({ error: 'Kelas ini belum punya ujian' }, { status: 400 });
    }

    /**
     * Sel yang diawali =, +, -, atau @ dibaca spreadsheet sebagai rumus.
     *
     * Nama yang diawali tanda hubung akan dijalankan sebagai perintah saat
     * berkasnya dibuka, dan sebagian spreadsheet menawarkan menjalankan program
     * luar dari rumus itu.
     *
     * A cell starting with =, +, -, or @ is read as a formula by spreadsheets.
     *
     * A name beginning with a hyphen would execute when the file is opened, and
     * some spreadsheets offer to run external programs from such a formula.
     */
    const sel = (v: unknown) => {
      const teks = String(v ?? '');
      const aman = ['=', '+', '-', '@'].includes(teks.charAt(0)) ? `'${teks}` : teks;
      return `"${aman.replace(/"/g, '""')}"`;
    };

    const kepala = [
      'Nama Peserta',
      'Email',
      // Jenis tiap ujian disebut di judul kolomnya: "Kuis Pertemuan 1" dan
      // "Pretest Kelas" tidak selalu terbaca jenisnya dari judul yang diketik
      // admin.
      //
      // Each exam's kind is named in its column heading: "Kuis Pertemuan 1" and
      // "Pretest Kelas" do not always reveal their kind from an admin's typing.
      ...data.exams.map((e) => `${e.title} (${EXAM_KIND_LABELS[e.kind]}, KKM ${e.passingScore})`),
      'Rata-rata',
    ];

    const baris = data.rows.map((r) => {
      const ada = r.scores.filter((x): x is number => x !== null);
      // Rata-rata dihitung dari yang dikerjakan saja. Membaginya dengan seluruh
      // ujian membuat peserta yang baru mengerjakan separuhnya terbaca seperti
      // yang gagal pada separuh lainnya.
      //
      // The average covers only what was attempted. Dividing by every exam would
      // have someone who has sat half of them read as having failed the rest.
      const rata = ada.length === 0 ? '' : Math.round((ada.reduce((a, b) => a + b, 0) / ada.length) * 10) / 10;

      return [
        sel(r.studentName),
        sel(r.email),
        ...r.scores.map((x, i) => {
          if (x === null) return sel('');
          // Nilai dari percobaan kedua atau ketiga ditandai: angkanya dipatok
          // pada KKM oleh aturan remedial, bukan nilai mentah yang diperoleh.
          //
          // A second- or third-attempt score is marked: the figure was capped at
          // the passing score by the remedial rule, not the raw score earned.
          const n = r.attempts[i];
          return sel(n && n > 1 ? `${x} (percobaan ${n})` : x);
        }),
        sel(rata),
      ].join(',');
    });

    const csv = [kepala.map(sel).join(','), ...baris].join('\r\n');

    // BOM UTF-8: tanpanya Excel di Windows membaca berkas ini sebagai ANSI, dan
    // nama ber-aksen muncul rusak.
    //
    // A UTF-8 BOM: without it Excel on Windows reads this as ANSI, and accented
    // names come out mangled.
    const nama = `nilai-ujian-${(data.programName || data.className).replace(/[^\w]+/g, '-').toLowerCase()}-${wibDate()}.csv`;

    return new Response(`\ufeff${csv}`, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nama}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
