import { describe, expect, it } from 'vitest';
import { validateTaskUpdate } from '../../src/features/tasks/policy';
import { toWibParts } from '../../src/lib/time';

describe('menyunting tugas', () => {
  it('mengubah nama file brief, dan mengosongkannya bila dihapus', () => {
    expect(validateTaskUpdate({ briefFileName: '  Brief_Tugas2.pdf ' })).toEqual({ briefFileName: 'Brief_Tugas2.pdf' });
    expect(validateTaskUpdate({ briefFileName: '' })).toEqual({ briefFileName: null });
    expect(validateTaskUpdate({})).toEqual({});
  });

  it('mengisi formulir dengan jam WIB, bukan UTC', () => {
    // Batas 23.59 WIB tersimpan 16.59 UTC; menampilkannya mentah menggeser
    // tenggat tujuh jam setiap kali disunting.
    // A 23:59 WIB deadline is stored as 16:59 UTC; showing it raw shifts the
    // deadline seven hours on every edit.
    expect(toWibParts('2026-10-20T16:59:00.000Z')).toEqual({ date: '2026-10-20', time: '23:59' });
    expect(toWibParts(null)).toEqual({ date: '', time: '' });
  });

  it('mencabut tenggat bila tanggalnya dikosongkan', () => {
    expect(validateTaskUpdate({ dueDate: null, dueTime: null })).toEqual({ dueAt: null });
  });
});
