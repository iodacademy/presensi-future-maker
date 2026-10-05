'use client';

import React, { useEffect, useState } from 'react';
import { ImportQuestionsGlobal } from '../kelas/[classId]/import-questions-global';
import type { ClassSummary } from '@/features/classes/types';
import type { ExamDocument } from '@/features/exams/types';

/**
 * Tab impor soal pada Pengaturan.
 *
 * Kelasnya dipilih lebih dulu, bukan disebut sebagai kolom di dalam berkasnya:
 * "Kuis Pertemuan 1" ada di empat kelas dengan soal yang berbeda-beda, dan satu
 * baris yang salah kelas akan menimpa bank soal kelas lain tanpa terlihat di
 * mana pun.
 *
 * The question-import tab in Settings.
 *
 * The class is picked first rather than named as a column inside the sheet: "Kuis
 * Pertemuan 1" exists in four classes with different questions, and one row aimed
 * at the wrong class would overwrite another class's question bank with nothing
 * anywhere to show it.
 */
export function ImportSoalTab() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [classId, setClassId] = useState('');
  const [exams, setExams] = useState<ExamDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/classes')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setClasses(d?.classes ?? []))
      .catch(() => setClasses([]))
      .finally(() => setLoading(false));
  }, []);

  const loadExams = React.useCallback(() => {
    if (!classId) {
      setExams([]);
      return;
    }
    fetch(`/api/exams?classId=${encodeURIComponent(classId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setExams(d?.exams ?? []))
      .catch(() => setExams([]));
  }, [classId]);

  useEffect(() => { loadExams(); }, [loadExams]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '640px' }}>
      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.6 }}>
        Satu berkas memuat soal pretest, tiap kuis pertemuan, dan postest sekaligus untuk satu kelas.
        Pilih kelasnya lebih dulu, lalu unduh contoh berkasnya yang sudah terisi judul ujian kelas itu.
      </p>

      <div>
        <label
          htmlFor="impor-kelas"
          style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '5px' }}
        >
          KELAS
        </label>
        <select
          id="impor-kelas"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          disabled={loading}
          style={{
            width: '100%', maxWidth: '340px', padding: '9px 11px', borderRadius: '8px',
            border: '1px solid var(--color-border)', fontSize: '12px', fontFamily: 'inherit',
            backgroundColor: 'var(--color-surface)', color: 'var(--color-text-main)',
          }}
        >
          <option value="">{loading ? 'Memuat kelas...' : 'Pilih kelas'}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.canonicalName}
            </option>
          ))}
        </select>
      </div>

      {/* Komponen impornya tidak digambar sebelum kelasnya dipilih: tombol
          pilih berkas yang aktif tanpa kelas akan menerima berkas lalu menolak
          seluruh barisnya, dan admin mengira berkasnya yang salah.

          The import is not drawn before a class is picked: a live file button with
          no class would accept a sheet and then refuse every row, and the admin
          would assume the sheet was at fault. */}
      {classId ? (
        <ImportQuestionsGlobal
          key={classId}
          classId={classId}
          exams={exams}
          onImported={loadExams}
        />
      ) : (
        <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
          Pilih kelas lebih dulu untuk melihat judul ujian yang berlaku dan mengunggah berkasnya.
        </p>
      )}

    </div>
  );
}
