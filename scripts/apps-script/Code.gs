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
 *   2. Project Settings -> Script properties -> tambah `SHARED_SECRET`
 *      (buat dengan: openssl rand -base64 32).
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
