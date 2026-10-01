'use client';

import React, { useEffect, useState } from 'react';
import { ClipboardCheck, Trash2, ChevronDown, ChevronRight, Plus, Check, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTimeWib } from '@/lib/time';
import {
  EXAM_KIND_LABELS,
  MAX_ATTEMPTS,
  QUESTION_KIND_LABELS,
  type ExamDocument,
  type ExamKind,
  type QuestionKind,
} from '@/features/exams/types';

type AdminQuestion = {
  id: string;
  kind: QuestionKind;
  text: string;
  options: { id: string; text: string }[];
  order: number;
  correctOptionId: string;
  explanation: string;
};

interface ExamBuilderProps {
  classId: string;
  /** Null untuk pretest kelas; diisi untuk kuis sebuah pertemuan / Null for a class pretest; set for a meeting's quiz */
  sessionId: string | null;
  sessionTitle?: string;
  kind: ExamKind;
}

/**
 * Rekap pengerjaan sebuah ujian.
 *
 * Diambil saat kartunya dibuka. Tiap rekap membaca seluruh peserta kelas,
 * sehingga memuat semuanya di muka berarti puluhan pembacaan untuk kartu yang
 * mungkin tidak pernah dibuka.
 *
 * One exam's completion roster.
 *
 * Fetched when its card opens. Each roster reads the whole class, so loading
 * them all up front means dozens of reads for cards that may never be opened.
 */
function ExamRoster({ examId }: { examId: string }) {
  const [data, setData] = useState<{
    taken: { studentId: string; studentName: string; score: number; passed: boolean; attemptNumber: number }[];
    pending: { studentId: string; studentName: string; email: string }[];
  } | null>(null);
  const [showPending, setShowPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/exams/${examId}/roster`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [examId]);

  if (!data) return <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Memuat rekap...</div>;

  const total = data.taken.length + data.pending.length;
  const lulus = data.taken.filter((t) => t.passed).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-main)' }}>
          <Users size={11} strokeWidth={2} />
          {data.taken.length} dari {total} sudah mengerjakan
        </span>
        {data.taken.length > 0 && (
          <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--color-success)' }}>
            {lulus} lulus
          </span>
        )}
      </div>

      {data.taken.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {data.taken.map((t) => (
            <div key={t.studentId} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px' }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.studentName}
              </span>
              {/* Nomor percobaan ikut ditampilkan: nilai 70 dari percobaan
                  kedua adalah hasil patokan remedial, bukan nilai mentahnya.

                  The attempt number is shown too: a 70 on a second attempt is
                  the remedial ceiling, not a raw score. */}
              {t.attemptNumber > 1 && (
                <span style={{ fontSize: '8px', color: 'var(--color-text-muted)' }}>
                  percobaan {t.attemptNumber}
                </span>
              )}
              <span style={{ fontWeight: 700, color: t.passed ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {t.score}
              </span>
            </div>
          ))}
        </div>
      )}

      {data.pending.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowPending((v) => !v)}
            aria-expanded={showPending}
            style={{ alignSelf: 'flex-start', border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: '10px', fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'underline' }}
          >
            {showPending ? 'Sembunyikan' : 'Lihat'} {data.pending.length} peserta yang belum
          </button>
          {showPending && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'var(--color-bg-app)' }}>
              {data.pending.map((p) => (
                <div key={p.studentId} style={{ fontSize: '10px' }}>
                  {p.studentName}
                  <span style={{ color: 'var(--color-text-muted)' }}> - {p.email}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Penyusun soal sebuah ujian.
 *
 * Jawaban benar dipilih dengan menandai salah satu pilihannya, bukan diketik
 * terpisah: kunci yang diketik dapat menunjuk pilihan yang tidak ada, dan soal
 * seperti itu menilai setiap jawaban sebagai salah.
 *
 * An exam's question editor.
 *
 * The correct answer is picked by marking one of the options rather than typed
 * separately: a typed key can point at an option that does not exist, and such
 * a question marks every answer wrong.
 */
function QuestionEditor({ examId, nextOrder, onSaved }: { examId: string; nextOrder: number; onSaved: () => void }) {
  const [kind, setKind] = useState<QuestionKind>('pilihan-ganda');
  const [text, setText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeKind(k: QuestionKind) {
    setKind(k);
    setCorrectIndex(0);
    setOptions(k === 'benar-salah' ? ['Benar', 'Salah'] : ['', '', '', '']);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/exams/${examId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          text,
          options: options.map((t) => ({ text: t })),
          correctIndex,
          explanation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan soal');
      setText('');
      setOptions(kind === 'benar-salah' ? ['Benar', 'Salah'] : ['', '', '', '']);
      setCorrectIndex(0);
      setExplanation('');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field: React.CSSProperties = {
    padding: '8px 10px', borderRadius: '8px',
    border: '1px solid var(--color-border)', fontSize: '11px', width: '100%',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-app)' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        {(Object.keys(QUESTION_KIND_LABELS) as QuestionKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => changeKind(k)}
            aria-pressed={kind === k}
            style={{
              padding: '5px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontSize: '10px', fontWeight: kind === k ? 700 : 400,
              backgroundColor: kind === k ? 'var(--color-primary)' : 'var(--color-border)',
              color: kind === k ? '#ffffff' : 'var(--color-text-main)',
            }}
          >
            {QUESTION_KIND_LABELS[k]}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Soal nomor ${nextOrder}`}
        aria-label="Pertanyaan"
        rows={2}
        style={{ ...field, resize: 'vertical', fontFamily: 'inherit' }}
      />

      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
        PILIHAN - KLIK LINGKARAN UNTUK MENANDAI JAWABAN BENAR
      </div>

      {options.map((o, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <button
            type="button"
            onClick={() => setCorrectIndex(i)}
            aria-label={`Tandai pilihan ${i + 1} sebagai jawaban benar`}
            aria-pressed={correctIndex === i}
            style={{
              width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
              border: `2px solid ${correctIndex === i ? 'var(--color-success)' : 'var(--color-border)'}`,
              backgroundColor: correctIndex === i ? 'var(--color-success)' : '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            }}
          >
            {correctIndex === i && <Check size={11} color="#ffffff" strokeWidth={3} />}
          </button>
          <input
            value={o}
            onChange={(e) => setOptions(options.map((v, j) => (j === i ? e.target.value : v)))}
            placeholder={`Pilihan ${String.fromCharCode(65 + i)}`}
            aria-label={`Pilihan ${String.fromCharCode(65 + i)}`}
            disabled={kind === 'benar-salah'}
            style={{ ...field, backgroundColor: kind === 'benar-salah' ? 'var(--color-border)' : '#ffffff' }}
          />
          {kind === 'pilihan-ganda' && options.length > 2 && (
            <button
              type="button"
              aria-label={`Hapus pilihan ${String.fromCharCode(65 + i)}`}
              onClick={() => {
                setOptions(options.filter((_, j) => j !== i));
                // Kunci mengikuti pilihan yang tersisa. Dibiarkan, indeksnya
                // dapat menunjuk pilihan yang sudah tidak ada.
                //
                // The key follows the remaining options. Left alone, its index
                // could point at an option that no longer exists.
                if (correctIndex >= i && correctIndex > 0) setCorrectIndex(correctIndex - 1);
              }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
            >
              <Trash2 size={12} color="var(--color-danger)" strokeWidth={2} />
            </button>
          )}
        </div>
      ))}

      {kind === 'pilihan-ganda' && options.length < 5 && (
        <button
          type="button"
          onClick={() => setOptions([...options, ''])}
          style={{ alignSelf: 'flex-start', border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: '10px', fontWeight: 600, color: 'var(--color-primary)' }}
        >
          + Tambah pilihan
        </button>
      )}

      <input
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        placeholder="Pembahasan (ditampilkan setelah ujian selesai)"
        aria-label="Pembahasan"
        style={field}
      />

      {error && <div role="alert" style={{ fontSize: '10px', color: 'var(--color-danger)' }}>{error}</div>}

      <Button variant="primary" onClick={save} disabled={busy || !text.trim()} style={{ fontSize: '11px', padding: '8px 14px', alignSelf: 'flex-start' }}>
        {busy ? 'Menyimpan...' : 'Simpan Soal'}
      </Button>
    </div>
  );
}

/**
 * Ujian sebuah pertemuan, atau pretest sebuah kelas.
 *
 * Diletakkan pada kartu pertemuannya bersama rekaman dan bahan praktiknya,
 * sebab seluruhnya melekat pada satu pertemuan.
 *
 * A meeting's exam, or a class's pretest.
 *
 * Placed on the meeting card alongside its recordings and materials, since all
 * of them belong to one meeting.
 */
export function ExamBuilder({ classId, sessionId, sessionTitle, kind }: ExamBuilderProps) {
  const [exams, setExams] = useState<ExamDocument[]>([]);
  const [questions, setQuestions] = useState<Record<string, AdminQuestion[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/exams?classId=${encodeURIComponent(classId)}`);
      if (!res.ok) return;
      const all: ExamDocument[] = (await res.json()).exams || [];
      setExams(all.filter((e) => e.kind === kind && e.sessionId === sessionId));
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, sessionId, kind]);

  async function loadQuestions(examId: string) {
    const res = await fetch(`/api/exams/${examId}/questions`);
    if (!res.ok) return;
    const data = await res.json();
    setQuestions((prev) => ({ ...prev, [examId]: data.questions || [] }));
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          kind,
          sessionId,
          title: title.trim(),
          durationMinutes: duration ? Number(duration) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat ujian');
      setTitle('');
      setCreating(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(exam: ExamDocument) {
    setError(null);
    const res = await fetch(`/api/exams/${exam.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !exam.published }),
    });
    if (!res.ok) {
      setError((await res.json()).error || 'Gagal mengubah status ujian');
      return;
    }
    load();
  }

  async function removeExam(exam: ExamDocument) {
    if (!confirm(`Hapus ${exam.title} beserta seluruh soal dan hasil pengerjaannya?`)) return;
    await fetch(`/api/exams/${exam.id}`, { method: 'DELETE' });
    load();
  }

  async function removeQuestion(examId: string, questionId: string) {
    await fetch(`/api/exams/questions/${questionId}`, { method: 'DELETE' });
    await Promise.all([load(), loadQuestions(examId)]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {error && <div role="alert" style={{ fontSize: '10px', color: 'var(--color-danger)' }}>{error}</div>}

      {exams.map((exam) => {
        const isOpen = openId === exam.id;
        const soal = questions[exam.id] ?? [];

        return (
          <div key={exam.id} style={{ borderRadius: '10px', backgroundColor: 'var(--color-primary-light)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' }}>
              <button
                type="button"
                onClick={() => {
                  const next = isOpen ? null : exam.id;
                  setOpenId(next);
                  if (next && !questions[exam.id]) loadQuestions(exam.id);
                }}
                aria-expanded={isOpen}
                aria-label={`${isOpen ? 'Tutup' : 'Buka'} ${exam.title}`}
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
              >
                {isOpen
                  ? <ChevronDown size={13} color="var(--color-primary)" strokeWidth={2} style={{ flexShrink: 0 }} />
                  : <ChevronRight size={13} color="var(--color-primary)" strokeWidth={2} style={{ flexShrink: 0 }} />}
                <ClipboardCheck size={13} color="var(--color-primary)" strokeWidth={2} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {exam.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap', fontSize: '9px', color: 'var(--color-primary)' }}>
                    <span>{exam.questionCount} soal</span>
                    {exam.durationMinutes && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={9} strokeWidth={2} />{exam.durationMinutes} menit
                      </span>
                    )}
                    <span>KKM {exam.passingScore}</span>
                    {exam.dueAt && <span>Batas {formatDateTimeWib(exam.dueAt)}</span>}
                  </div>
                </div>
              </button>

              <span
                style={{
                  fontSize: '8px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', whiteSpace: 'nowrap',
                  backgroundColor: exam.published ? 'var(--color-success)' : 'var(--color-border)',
                  color: exam.published ? '#ffffff' : 'var(--color-text-muted)',
                }}
              >
                {exam.published ? 'TERBIT' : 'DRAF'}
              </span>

              <button
                type="button"
                aria-label={`Hapus ${exam.title}`}
                onClick={() => removeExam(exam)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
              >
                <Trash2 size={13} color="var(--color-danger)" strokeWidth={2} />
              </button>
            </div>

            {isOpen && (
              <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ height: '1px', backgroundColor: 'rgba(36, 60, 75, 0.15)' }} />

                {soal.map((q, i) => (
                  <div key={q.id} style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#ffffff' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', flexShrink: 0 }}>{i + 1}.</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-main)' }}>{q.text}</div>
                        <div style={{ marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {q.options.map((o) => {
                            const benar = o.id === q.correctOptionId;
                            return (
                              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: benar ? 'var(--color-success)' : 'var(--color-text-muted)', fontWeight: benar ? 700 : 400 }}>
                                {benar ? <Check size={10} strokeWidth={3} /> : <span style={{ width: '10px' }} />}
                                {o.text}
                              </div>
                            );
                          })}
                        </div>
                        {q.explanation && (
                          <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label={`Hapus soal ${i + 1}`}
                        onClick={() => removeQuestion(exam.id, q.id)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                      >
                        <Trash2 size={11} color="var(--color-danger)" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                ))}

                <QuestionEditor
                  examId={exam.id}
                  nextOrder={soal.length + 1}
                  onSaved={() => Promise.all([load(), loadQuestions(exam.id)])}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <Button
                    variant={exam.published ? 'secondary' : 'primary'}
                    onClick={() => togglePublish(exam)}
                    style={{ fontSize: '11px', padding: '8px 14px' }}
                  >
                    {exam.published ? 'Tarik dari Peserta' : 'Terbitkan'}
                  </Button>
                  <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                    {MAX_ATTEMPTS} kesempatan. Percobaan kedua dan ketiga yang lulus bernilai tepat {exam.passingScore}.
                  </span>
                </div>

                {exam.published && (
                  <>
                    <div style={{ height: '1px', backgroundColor: 'rgba(36, 60, 75, 0.15)' }} />
                    <ExamRoster examId={exam.id} />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {creating ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'kuis' ? `Kuis ${sessionTitle ?? 'Sesi'}` : `${EXAM_KIND_LABELS[kind]} Kelas`}
            aria-label="Judul ujian"
            autoFocus
            style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px' }}
          />
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }} htmlFor="exam-duration">Durasi</label>
            <input
              id="exam-duration"
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              style={{ width: '70px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px' }}
            />
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>menit, kosongkan untuk tanpa batas</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy} style={{ fontSize: '11px', padding: '8px 12px' }}>Batal</Button>
            <Button variant="primary" onClick={create} disabled={busy || !title.trim()} style={{ fontSize: '11px', padding: '8px 12px' }}>
              {busy ? 'Membuat...' : 'Buat'}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setCreating(true)} style={{ fontSize: '11px', padding: '8px 14px', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <Plus size={12} strokeWidth={2} />
          Tambah {EXAM_KIND_LABELS[kind]}
        </Button>
      )}
    </div>
  );
}
