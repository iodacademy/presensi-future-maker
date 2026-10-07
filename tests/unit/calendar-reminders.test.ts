// @vitest-environment node
import { describe, expect, it, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'scripts/apps-script/Code.gs'), 'utf-8');

/**
 * Menjalankan Code.gs dengan tiruan layanan Apps Script, lalu memanggil
 * sendReminders() untuk satu event yang dimulai `minutesLeft` menit lagi.
 *
 * Runs Code.gs with fake Apps Script services, then calls sendReminders() for
 * one event starting `minutesLeft` minutes from now.
 */
function run(minutesLeft: number, priv: Record<string, string> = {}) {
  const now = new Date('2026-10-07T03:00:00.000Z');
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const event = {
    id: 'e1',
    summary: 'Mentoring bootcamp - Rama',
    hangoutLink: 'https://meet.google.com/abc-defg-hij',
    start: { dateTime: new Date(now.getTime() + minutesLeft * 60000).toISOString() },
    attendees: [{ email: 'rama@x.id' }, { email: 'mentor@x.id' }, { email: 'tolak@x.id', responseStatus: 'declined' }],
    extendedProperties: { private: { app: 'futuremakers-mentoring', ...priv } },
  };
  const mails: { to: string; subject: string; body: string }[] = [];
  const patches: Record<string, string>[] = [];
  const Calendar = {
    Events: {
      list: (_: string, opts: { privateExtendedProperty: string }) => {
        expect(opts.privateExtendedProperty).toBe('app=futuremakers-mentoring');
        return { items: [event] };
      },
      patch: (res: { extendedProperties: { private: Record<string, string> } }, _c: string, _id: string, o: { sendUpdates: string }) => {
        expect(o.sendUpdates).toBe('none');
        patches.push({ ...res.extendedProperties.private });
      },
    },
  };
  const MailApp = { sendEmail: (m: { to: string; subject: string; body: string }) => mails.push(m) };
  const Utilities = { formatDate: () => '10:30' };
  new Function('Calendar', 'MailApp', 'Utilities', `${source}\nsendReminders();`)(Calendar, MailApp, Utilities);
  return { mails, patches };
}

afterEach(() => vi.useRealTimers());

describe('email pengingat mentoring', () => {
  it('mengirim pengingat 1 jam kepada mentor dan peserta, tanpa tamu yang menolak', () => {
    const { mails, patches } = run(58);
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe('rama@x.id,mentor@x.id');
    expect(mails[0].subject).toContain('1 jam lagi');
    expect(mails[0].body).toContain('https://meet.google.com/abc-defg-hij');
    expect(patches[0].reminded60).toBe('1');
  });

  it('mengirim pengingat 10 menit', () => {
    const { mails, patches } = run(9, { reminded60: '1' });
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toContain('9 menit lagi');
    expect(patches[0].reminded10).toBe('1');
  });

  it('tidak mengirim ulang pengingat yang sudah terkirim', () => {
    expect(run(55, { reminded60: '1' }).mails).toHaveLength(0);
    expect(run(8, { reminded60: '1', reminded10: '1' }).mails).toHaveLength(0);
  });

  it('booking mepet hanya mendapat pengingat 10 menit', () => {
    const { mails, patches } = run(7);
    expect(mails).toHaveLength(1);
    expect(patches[0]).toMatchObject({ reminded10: '1', reminded60: '1' });
  });

  it('belum mengirim apa pun bila sesi masih lebih dari 1 jam lagi', () => {
    expect(run(63).mails).toHaveLength(0);
  });
});
