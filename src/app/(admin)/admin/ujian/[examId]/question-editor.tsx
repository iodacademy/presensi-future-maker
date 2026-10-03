'use client';

import React, { useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { QUESTION_KIND_LABELS, type QuestionKind } from '@/features/exams/types';
import s from './editor.module.css';

export interface AdminQuestion {
  id: string;
  kind: QuestionKind;
  text: string;
  imageUrl?: string | null;
  imagePath?: string | null;
  options: { id: string; text: string; imageUrl?: string | null; imagePath?: string | null }[];
  order: number;
  correctOptionId: string;
  explanation: string;
}

/** Soal yang belum dapat dikerjakan peserta / A question a participant cannot yet answer */
export function kurangLengkap(q: AdminQuestion): boolean {
  if (!q.text.trim() && !q.imageUrl) return true;
  // Pilihan tanpa teks maupun gambar tidak dapat dipilih peserta.
  // An option with neither text nor image cannot be picked by a participant.
  if (q.options.some((o) => !o.text.trim() && !o.imageUrl)) return true;
  return !q.options.some((o) => o.id === q.correctOptionId);
}

const huruf = (i: number) => String.fromCharCode(65 + i);

/**
 * Penyunting satu soal.
 *
 * Tiap kolom disimpan saat ditinggalkan, bukan lewat tombol simpan: admin
 * menyusun dua puluh soal berturut-turut, dan satu tombol per soal berarti dua
 * puluh ketukan tambahan untuk pekerjaan yang sama. Pilihan, kunci, dan jenis
 * soal disimpan seketika karena tidak ada yang perlu diketik dulu.
 *
 * Kolom teksnya tidak terkendali, dengan key pada pemanggilnya: kolom terkendali
 * yang nilainya dipasok ulang dari server setiap penyimpanan akan memindahkan
 * kursor ke ujung kalimat di tengah pengetikan.
 *
 * One question's editor.
 *
 * Each field saves when it is left rather than through a save button: an admin
 * composes twenty questions in a row, and one button each would mean twenty extra
 * taps for the same work. Options, the key, and the question type save immediately
 * because nothing needs typing first.
 *
 * The text fields are uncontrolled, with a key on the caller: a controlled field
 * refed from the server on every save would jump the cursor to the end of the
 * sentence mid-typing.
 */
export function QuestionEditor({
  examId,
  question,
  index,
  onSave,
  onDuplicate,
  onDelete,
}: {
  examId: string;
  question: AdminQuestion;
  index: number;
  onSave: (patch: Partial<AdminQuestion>) => Promise<void>;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  // Pilihan dan jenisnya dipegang di sini supaya tombolnya bergerak seketika;
  // teks soal dan pembahasannya dibiarkan pada DOM-nya.
  //
  // The options and type live here so their buttons move at once; the question
  // text and explanation are left to the DOM.
  const [options, setOptions] = useState(question.options);
  const [kind, setKind] = useState(question.kind);
  const [correctId, setCorrectId] = useState(question.correctOptionId);
  const [imageUrl, setImageUrl] = useState(question.imageUrl ?? null);
  const [imagePath, setImagePath] = useState(question.imagePath ?? null);

  const textRef = useRef<HTMLTextAreaElement>(null);
  const explRef = useRef<HTMLInputElement>(null);

  // Nilai terkini dikumpulkan dari seluruh kolom tiap kali menyimpan. Mengirim
  // satu medan saja akan menimpa medan lain dengan nilainya yang lama, karena
  // penyuntingannya mengganti seluruh soal.
  //
  // The current values are gathered from every field on each save. Sending one
  // field alone would overwrite the others with their stale values, since the edit
  // replaces the whole question.
  function kirim(ubah: Partial<{
    kind: QuestionKind;
    options: typeof options;
    correctId: string;
    imageUrl: string | null;
    imagePath: string | null;
  }> = {}) {
    const opsi = ubah.options ?? options;
    const kunci = ubah.correctId ?? correctId;
    const i = opsi.findIndex((o) => o.id === kunci);
    return onSave({
      kind: ubah.kind ?? kind,
      text: textRef.current?.value ?? question.text,
      imageUrl: ubah.imageUrl !== undefined ? ubah.imageUrl : imageUrl,
      imagePath: ubah.imagePath !== undefined ? ubah.imagePath : imagePath,
      options: opsi,
      // Kunci yang hilang jatuh ke pilihan pertama, bukan ke -1: indeks -1
      // ditolak server, dan soal yang gagal tersimpan tanpa alasan yang terlihat
      // membuat admin mengira ketikannya yang salah.
      //
      // A lost key falls back to the first option rather than -1: the server
      // rejects -1, and a question that fails to save for no visible reason has
      // the admin assume their typing was at fault.
      correctOptionId: opsi[i >= 0 ? i : 0]?.id ?? '',
      explanation: explRef.current?.value ?? question.explanation,
    } as Partial<AdminQuestion>);
  }

  function gantiJenis(k: QuestionKind) {
    if (k === kind) return;
    const baru =
      k === 'benar-salah'
        ? [
            { id: 'b', text: 'Benar', imageUrl: null, imagePath: null },
            { id: 's', text: 'Salah', imageUrl: null, imagePath: null },
          ]
        : options.slice(0, 4);
    setKind(k);
    setOptions(baru);
    setCorrectId(baru[0].id);
    kirim({ kind: k, options: baru, correctId: baru[0].id });
  }

  function ubahOpsi(i: number, patch: Partial<(typeof options)[number]>) {
    setOptions((p) => p.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  }

  const kunciHilang = !options.some((o) => o.id === correctId);

  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <h2 className={s.cardTitle}>
          Soal {index + 1}
          <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '8px', fontSize: '11px' }}>
            {QUESTION_KIND_LABELS[kind]}
          </span>
        </h2>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button type="button" className={s.iconBtn} onClick={onDuplicate} aria-label={`Gandakan soal ${index + 1}`} title="Gandakan">
            <Copy size={14} color="var(--color-text-muted)" strokeWidth={2} />
          </button>
          <button type="button" className={s.iconBtn} onClick={onDelete} aria-label={`Hapus soal ${index + 1}`} title="Hapus">
            <Trash2 size={14} color="var(--color-danger)" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div>
        <span className={s.label}>JENIS SOAL</span>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {(Object.keys(QUESTION_KIND_LABELS) as QuestionKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => gantiJenis(k)}
              aria-pressed={kind === k}
              className={`${s.chip} ${kind === k ? s.chipActive : ''}`}
            >
              {QUESTION_KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={s.label} htmlFor={`q-text-${question.id}`}>PERTANYAAN</label>
        <textarea
          id={`q-text-${question.id}`}
          ref={textRef}
          defaultValue={question.text}
          onBlur={() => kirim()}
          placeholder="Boleh dikosongkan bila seluruh isinya ada pada gambarnya."
          rows={3}
          className={`${s.input} ${s.textarea}`}
        />
      </div>

      <div>
        <span className={s.label}>GAMBAR SOAL</span>
        <ImageField
          examId={examId}
          url={imageUrl}
          label="Gambar soal"
          onChange={(v) => {
            setImageUrl(v.imageUrl);
            setImagePath(v.imagePath);
            kirim({ imageUrl: v.imageUrl, imagePath: v.imagePath });
          }}
        />
      </div>

      <div>
        <span className={s.label}>PILIHAN — KLIK LINGKARAN UNTUK MENANDAI JAWABAN BENAR</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {options.map((o, i) => (
            <div key={o.id} className={s.option}>
              <button
                type="button"
                onClick={() => {
                  setCorrectId(o.id);
                  kirim({ correctId: o.id });
                }}
                aria-label={`Tandai pilihan ${huruf(i)} sebagai jawaban benar`}
                aria-pressed={correctId === o.id}
                title="Tandai sebagai jawaban benar"
                className={`${s.optionKey} ${correctId === o.id ? s.optionKeyOn : ''}`}
              >
                {correctId === o.id ? <Check size={13} strokeWidth={3} /> : huruf(i)}
              </button>

              <input
                defaultValue={o.text}
                key={`${o.id}-${kind}`}
                onChange={(e) => ubahOpsi(i, { text: e.target.value })}
                onBlur={() => kirim()}
                placeholder={`Pilihan ${huruf(i)}`}
                aria-label={`Pilihan ${huruf(i)}`}
                disabled={kind === 'benar-salah'}
                className={s.input}
                style={kind === 'benar-salah' ? { background: 'var(--color-bg-app)' } : undefined}
              />

              <ImageField
                examId={examId}
                url={o.imageUrl ?? null}
                label="Gambar"
                size="kecil"
                onChange={(v) => {
                  const baru = options.map((x, j) => (j === i ? { ...x, ...v } : x));
                  setOptions(baru);
                  kirim({ options: baru });
                }}
              />

              {kind === 'pilihan-ganda' && options.length > 2 && (
                <button
                  type="button"
                  className={s.iconBtn}
                  aria-label={`Hapus pilihan ${huruf(i)}`}
                  onClick={() => {
                    const sisa = options.filter((_, j) => j !== i);
                    setOptions(sisa);
                    // Kunci mengikuti pilihan yang tersisa; dibiarkan, ia akan
                    // menunjuk pilihan yang sudah tidak ada dan seluruh jawaban
                    // peserta dinilai salah.
                    //
                    // The key follows the remaining options; left alone it would
                    // point at one that no longer exists and mark every
                    // participant answer wrong.
                    const kunci = sisa.some((x) => x.id === correctId) ? correctId : sisa[0].id;
                    setCorrectId(kunci);
                    kirim({ options: sisa, correctId: kunci });
                  }}
                >
                  <Trash2 size={12} color="var(--color-danger)" strokeWidth={2} />
                </button>
              )}
            </div>
          ))}
        </div>

        {kunciHilang && <p className={s.warn} style={{ marginTop: '8px' }}>Soal ini belum punya kunci jawaban.</p>}

        {kind === 'pilihan-ganda' && options.length < 5 && (
          <button
            type="button"
            className={s.linkBtn}
            style={{ marginTop: '8px' }}
            onClick={() => {
              const baru = [...options, { id: crypto.randomUUID(), text: '', imageUrl: null, imagePath: null }];
              setOptions(baru);
              kirim({ options: baru });
            }}
          >
            + Tambah pilihan
          </button>
        )}
      </div>

      <div>
        <label className={s.label} htmlFor={`q-expl-${question.id}`}>PEMBAHASAN</label>
        <input
          id={`q-expl-${question.id}`}
          ref={explRef}
          defaultValue={question.explanation}
          onBlur={() => kirim()}
          placeholder="Ditampilkan setelah kesempatan mengulang habis"
          className={s.input}
        />
      </div>
    </div>
  );
}

/**
 * Pengunggah satu gambar.
 *
 * Mengunggah segera setelah dipilih, bukan menunggu soalnya disimpan: tautan
 * gambarnya sudah ada saat soalnya dikirim, sehingga pengiriman soal tidak
 * perlu menunggu unggahan selesai dan kegagalan unggah tidak menyeret seluruh
 * soalnya.
 *
 * A single image uploader.
 *
 * It uploads as soon as a file is picked rather than waiting for the question to
 * save: the image link already exists when the question is sent, so sending the
 * question need not wait for an upload and a failed upload does not drag the whole
 * question down with it.
 */
export function ImageField({
  examId,
  url,
  onChange,
  label,
  size = 'besar',
}: {
  examId: string;
  url: string | null;
  onChange: (v: { imageUrl: string | null; imagePath: string | null }) => void;
  label: string;
  size?: 'besar' | 'kecil';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pilih(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('examId', examId);
      const res = await fetch('/api/uploads/exam-image', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah gambar');
      onChange({ imageUrl: data.url, imagePath: data.path });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const sisi = size === 'besar' ? 110 : 44;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {url ? (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img src={url} alt="" style={{ width: `${sisi}px`, height: `${sisi}px`, objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'block' }} />
          <button
            type="button"
            aria-label={`Hapus ${label}`}
            onClick={() => onChange({ imageUrl: null, imagePath: null })}
            style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', border: 'none', cursor: 'pointer', backgroundColor: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            <X size={11} color="#ffffff" strokeWidth={3} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          style={{
            width: `${sisi}px`, height: `${sisi}px`, borderRadius: '8px', cursor: busy ? 'default' : 'pointer', flexShrink: 0,
            border: '1px dashed var(--color-border)', backgroundColor: 'var(--color-surface)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px',
            fontSize: '9px', color: 'var(--color-text-muted)',
          }}
        >
          <ImagePlus size={size === 'besar' ? 18 : 13} strokeWidth={2} />
          {busy ? 'Mengunggah' : size === 'besar' ? label : ''}
        </button>
      )}

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={pilih} aria-label={label} style={{ display: 'none' }} />

      {error && <span role="alert" style={{ fontSize: '9px', color: 'var(--color-danger)' }}>{error}</span>}
    </div>
  );
}

/** Daftar soal di kolom kiri / The question list in the left column */
export function QuestionList({
  questions,
  selectedId,
  onSelect,
  onMove,
}: {
  questions: AdminQuestion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
}) {
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {questions.map((q, i) => {
        const aktif = q.id === selectedId;
        return (
          <li key={q.id} className={s.qrow}>
            <button
              type="button"
              onClick={() => onSelect(q.id)}
              aria-current={aktif ? 'true' : undefined}
              className={`${s.qbtn} ${aktif ? s.qbtnActive : ''}`}
            >
              <span className={`${s.qnum} ${aktif ? s.qnumActive : ''}`}>{i + 1}</span>
              <span className={`${s.qtext} ${aktif ? s.qtextActive : ''} ${!q.text.trim() ? s.qempty : ''}`}>
                {q.text.trim() || (q.imageUrl ? 'Soal bergambar' : 'Soal kosong')}
              </span>
              {/* Soal yang belum lengkap ditandai di daftarnya. Yang hanya
                  terlihat setelah dibuka akan terlewat pada ujian berisi dua
                  puluh soal.

                  An incomplete question is flagged in the list. One visible only
                  after opening it would be missed in an exam of twenty. */}
              {kurangLengkap(q) && (
                <span title="Belum lengkap" style={{ flexShrink: 0, width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-warning)' }} />
              )}
            </button>

            <span className={s.qmove}>
              <button type="button" disabled={i === 0} onClick={() => onMove(i, i - 1)} aria-label={`Naikkan soal ${i + 1}`}>
                <ChevronUp size={12} strokeWidth={2.5} />
              </button>
              <button type="button" disabled={i === questions.length - 1} onClick={() => onMove(i, i + 1)} aria-label={`Turunkan soal ${i + 1}`}>
                <ChevronDown size={12} strokeWidth={2.5} />
              </button>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Tombol tambah soal pada kaki daftarnya / The add-question button in the list's footer */
export function AddQuestionButton({ onAdd, busy }: { onAdd: () => void; busy: boolean }) {
  return (
    <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={onAdd} disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
      <Plus size={13} strokeWidth={2} />
      {busy ? 'Menambah...' : 'Tambah Soal'}
    </button>
  );
}
