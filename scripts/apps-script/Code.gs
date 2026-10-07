/**
 * Jembatan Google Calendar untuk aplikasi Future Innovators Bootcamp.
 *
 * Skrip ini dijalankan sebagai akun Google Workspace bootcamp, sehingga event
 * dan tautan Google Meet dibuat oleh pengguna berlisensi. Itu sebabnya aplikasi
 * tidak perlu domain-wide delegation: tanpa jalur ini, service account tidak
 * boleh mengisi daftar peserta sama sekali.
 *
 * Google Calendar bridge for the Future Innovators Bootcamp app.
 *
 * This script runs as the bootcamp Google Workspace account, so events and
 * Google Meet links are created by a licensed user. That is why the app needs
 * no domain-wide delegation: without this path, a service account is not
 * allowed to populate the attendee list at all.
 *
 * Cara pasang / Setup:
 *   1. script.google.com -> New project, tempel berkas ini.
 *      Services (+) -> tambahkan "Google Calendar API" (advanced service,
 *      identifier `Calendar`).
 *   2. Project Settings -> Script properties -> tambah `SHARED_SECRET`
 *      (buat dengan: openssl rand -base64 32).
 *   2b. Pilih fungsi `installReminderTrigger` lalu Run sekali, dan setujui
 *      izinnya. Ini memasang pengirim email pengingat tiap 5 menit.
 *      Select `installReminderTrigger`, Run it once, and grant the permissions.
 *      This installs the reminder-email sender every 5 minutes.
 *   3. Deploy -> New deployment -> Web app.
 *        Execute as: Me (akun Workspace bootcamp)
 *        Who has access: Anyone
 *      "Anyone" diperlukan karena server Next.js memanggil tanpa login Google;
 *      SHARED_SECRET yang menjadi pengamannya, bukan daftar akses Google.
 *
 *      "Anyone" is required because the Next.js server calls without a Google
 *      login; SHARED_SECRET is what guards it, not Google's access list.
 *   4. Salin URL /exec ke GOOGLE_CALENDAR_GAS_URL di aplikasi, dan secret yang
 *      sama ke GOOGLE_CALENDAR_GAS_SECRET.
 */

var CALENDAR_ID = 'primary';

// Penanda event milik aplikasi ini, agar pengirim pengingat tidak menyentuh
// event lain di kalender akun bootcamp.
// Marks events owned by this app, so the reminder sender never touches other
// events on the bootcamp account's calendar.
var APP_TAG = 'futuremakers-mentoring';
var TZ = 'Asia/Jakarta';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    var expected = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
    if (!expected) {
      return json({ error: 'SHARED_SECRET belum diatur pada Script properties' }, 500);
    }

    // Perbandingan waktu tetap supaya panjang kecocokan tidak terbaca dari
    // selisih waktu balasan.
    // Constant-time comparison so the match length cannot be read from the
    // response timing.
    if (!safeEquals(String(body.secret || ''), expected)) {
      return json({ error: 'unauthorized' }, 401);
    }

    switch (body.action) {
      case 'create':
        return json(createEvent(body));
      case 'cancel':
        return json(cancelEvent(body));
      default:
        return json({ error: 'Aksi tidak dikenal: ' + body.action }, 400);
    }
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) }, 500);
  }
}

/**
 * Membuat event mentoring beserta tautan Meet dan mengundang peserta.
 *
 * Creates a mentoring event with a Meet link and invites the attendees.
 */
function createEvent(body) {
  var attendees = [];
  if (body.studentEmail) attendees.push({ email: body.studentEmail });
  if (body.mentorEmail) attendees.push({ email: body.mentorEmail });

  var resource = {
    summary: body.summary,
    description: body.description || '',
    start: { dateTime: body.startsAt, timeZone: 'Asia/Jakarta' },
    end: { dateTime: body.endsAt, timeZone: 'Asia/Jakarta' },
    attendees: attendees,
    // Pop-up 1 jam dan 10 menit pada kalender penyelenggara. Google tidak
    // mengizinkan penyelenggara mengatur pengingat di kalender tamu; mereka
    // diingatkan lewat email dari sendReminders().
    //
    // 1-hour and 10-minute pop-ups on the organizer's calendar. Google does not
    // let an organizer set reminders on guests' calendars; guests are reminded
    // by email from sendReminders().
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'popup', minutes: 10 },
      ],
    },
    extendedProperties: {
      private: { app: APP_TAG, bookingId: String(body.bookingId) },
    },
    conferenceData: {
      createRequest: {
        // Tiap booking memakai conference sendiri. Memakai ulang tautan Meet
        // antar event membocorkan detail rapat ke peserta lain.
        // Each booking gets its own conference. Reusing a Meet link across
        // events leaks meeting details to unintended attendees.
        requestId: body.bookingId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  var created = Calendar.Events.insert(resource, CALENDAR_ID, {
    conferenceDataVersion: 1,
    sendUpdates: 'all',
  });

  // Conference dibuat asinkron; balasan pertama bisa belum memuat tautannya.
  // Conference creation is asynchronous; the first response may not carry the
  // link yet.
  var meetUrl = created.hangoutLink || null;
  var status = pickStatus(created);

  if (!meetUrl && status === 'pending') {
    Utilities.sleep(2000);
    var refetched = Calendar.Events.get(CALENDAR_ID, created.id, {
      conferenceDataVersion: 1,
    });
    meetUrl = refetched.hangoutLink || null;
    status = pickStatus(refetched);
  }

  return {
    eventId: created.id,
    meetUrl: meetUrl,
    conferenceStatus: status,
  };
}

function pickStatus(event) {
  if (event.hangoutLink) return 'success';
  var cd = event.conferenceData;
  if (cd && cd.createRequest && cd.createRequest.status) {
    return cd.createRequest.status.statusCode;
  }
  return 'failure';
}

/**
 * Membatalkan event dan memberi tahu peserta.
 *
 * Memakai patch status=cancelled, bukan delete: event tetap dapat dipulihkan
 * dan detailnya masih terbaca di kalender penyelenggara.
 *
 * Cancels the event and notifies attendees.
 *
 * Uses patch status=cancelled rather than delete: the event stays restorable
 * and its details remain readable on the organizer's calendar.
 */
function cancelEvent(body) {
  Calendar.Events.patch({ status: 'cancelled' }, CALENDAR_ID, body.eventId, {
    sendUpdates: 'all',
  });
  return { cancelled: true };
}

/**
 * Mengirim email pengingat 1 jam dan 10 menit sebelum sesi kepada seluruh tamu
 * (mentor dan peserta). Dijalankan trigger waktu tiap 5 menit.
 *
 * Pengingat yang sudah terkirim dicatat di extendedProperties event, sehingga
 * trigger yang berjalan berulang tidak mengirim email yang sama dua kali.
 * Event yang dibatalkan tidak ikut terambil, jadi sesi yang batal tidak
 * diingatkan.
 *
 * Sends 1-hour and 10-minute reminder emails before a session to every guest
 * (mentor and participant). Run by a time trigger every 5 minutes.
 *
 * Sent reminders are recorded in the event's extendedProperties, so a trigger
 * that runs repeatedly never sends the same email twice. Cancelled events are
 * not fetched, so a cancelled session is never reminded.
 */
function sendReminders() {
  var now = new Date();
  var horizon = new Date(now.getTime() + 65 * 60 * 1000);
  var list = Calendar.Events.list(CALENDAR_ID, {
    timeMin: now.toISOString(),
    timeMax: horizon.toISOString(),
    singleEvents: true,
    privateExtendedProperty: 'app=' + APP_TAG,
    maxResults: 100,
  });

  (list.items || []).forEach(function (event) {
    var start = new Date(event.start.dateTime || event.start.date);
    var minutesLeft = Math.round((start.getTime() - now.getTime()) / 60000);
    var priv = (event.extendedProperties && event.extendedProperties.private) || {};

    // Pengingat 1 jam dikirim sekali begitu sesi tinggal 60 menit atau kurang;
    // dilewati bila booking dibuat mepet (10 menit atau kurang), karena
    // pengingat 10 menit akan segera menyusul.
    // The 1-hour reminder is sent once the session is 60 minutes away or less;
    // skipped for a last-minute booking (10 minutes or less), since the
    // 10-minute reminder follows right away.
    if (!priv.reminded60 && minutesLeft <= 60 && minutesLeft > 10) {
      mailReminder(event, start, minutesLeft);
      priv.reminded60 = '1';
      markReminded(event.id, priv);
    }
    if (!priv.reminded10 && minutesLeft <= 10 && minutesLeft > -5) {
      mailReminder(event, start, minutesLeft);
      priv.reminded10 = '1';
      priv.reminded60 = '1';
      markReminded(event.id, priv);
    }
  });
}

function mailReminder(event, start, minutesLeft) {
  var guests = (event.attendees || [])
    .filter(function (a) { return a.responseStatus !== 'declined'; })
    .map(function (a) { return a.email; });
  if (guests.length === 0) return;

  var when = Utilities.formatDate(start, TZ, 'HH:mm');
  var lead = minutesLeft >= 45 ? '1 jam lagi' : minutesLeft > 1 ? minutesLeft + ' menit lagi' : 'sebentar lagi';
  var link = event.hangoutLink || '(tautan Meet ada di undangan Google Calendar)';

  MailApp.sendEmail({
    to: guests.join(','),
    subject: 'Pengingat: ' + event.summary + ' dimulai ' + lead + ' (' + when + ' WIB)',
    body:
      'Halo,\n\n' +
      'Sesi mentoring "' + event.summary + '" dimulai ' + lead + ', pukul ' + when + ' WIB.\n\n' +
      'Masuk Google Meet: ' + link + '\n\n' +
      'Pesan ini dikirim otomatis oleh Future Innovators Bootcamp.',
  });
}

function markReminded(eventId, priv) {
  // sendUpdates none: mencatat penanda tidak boleh mengirim email "event
  // diperbarui" kepada tamu.
  // sendUpdates none: recording the flag must not email guests an "event
  // updated" notice.
  Calendar.Events.patch({ extendedProperties: { private: priv } }, CALENDAR_ID, eventId, {
    sendUpdates: 'none',
  });
}

/**
 * Memasang trigger sendReminders tiap 5 menit. Jalankan sekali dari editor;
 * aman dijalankan ulang karena trigger lama dihapus lebih dulu.
 *
 * Installs the sendReminders trigger every 5 minutes. Run once from the editor;
 * safe to rerun since old triggers are removed first.
 */
function installReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendReminders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendReminders').timeBased().everyMinutes(5).create();
}

function safeEquals(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function json(payload, code) {
  // Apps Script Web App selalu membalas HTTP 200; kode status disalurkan di
  // dalam body supaya pemanggil tetap bisa membedakan kegagalan.
  // An Apps Script Web App always replies with HTTP 200; the status code is
  // carried inside the body so the caller can still tell failures apart.
  if (code) payload.statusCode = code;
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
