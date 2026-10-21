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
 *   2a. Project Settings -> centang "Show appsscript.json manifest file in
 *      editor", lalu salin isi scripts/apps-script/appsscript.json ke berkas
 *      itu. Manifest ini menambahkan izin Google Meet API agar mentor dapat
 *      dijadikan co-host. Jalankan fungsi apa pun sekali untuk menyetujui izin
 *      barunya, lalu deploy ulang (Manage deployments -> Edit -> New version).
 *      Project Settings -> tick "Show appsscript.json manifest file in editor",
 *      then copy scripts/apps-script/appsscript.json into that file. The
 *      manifest adds the Google Meet API permission so mentors can be made
 *      co-hosts. Run any function once to grant the new permission, then
 *      redeploy (Manage deployments -> Edit -> New version).
 *   2c. Google Meet API tidak tersedia sebagai layanan Apps Script, dan proyek
 *      Cloud bawaan Apps Script tersembunyi. Karena itu skrip dipindah ke proyek
 *      Google Cloud standar: buat proyek dengan akun Workspace bootcamp, aktifkan
 *      Google Calendar API dan Google Meet API, isi OAuth consent screen
 *      (Internal), lalu Project Settings -> Change project -> nomor proyeknya.
 *      Tanpa ini, mentor tidak dijadikan co-host dan skrip memakai cara lama.
 *      The Google Meet API is not available as an Apps Script service, and
 *      Apps Script's default Cloud project is hidden. So the script moves to a
 *      standard Google Cloud project: create one with the bootcamp Workspace
 *      account, enable the Google Calendar API and Google Meet API, fill in the
 *      OAuth consent screen (Internal), then Project Settings -> Change project
 *      -> its project number. Without this, mentors are not made co-host and the
 *      script falls back to the old way.
 *   2d. Pilih fungsi `fixUpcomingMeetSpaces` lalu Run sekali untuk membuka akses
 *      dan menyalakan rekam otomatis ruang Meet yang sudah dibuat sebelumnya.
 *      Select `fixUpcomingMeetSpaces` and Run it once to open access and turn on
 *      auto-recording for Meet spaces created earlier.
 *   2b. Pilih fungsi `installReminderTrigger` lalu Run sekali, dan setujui
 *      izinnya. Ini memasang pengirim email pengingat tiap 5 menit dan
 *      pelampir rekaman tiap 30 menit.
 *      Select `installReminderTrigger`, Run it once, and grant the permissions.
 *      This installs the reminder-email sender every 5 minutes and the
 *      recording attacher every 30 minutes.
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

// Endpoint aplikasi yang menerima tautan rekaman; dijaga SHARED_SECRET yang sama.
// The app endpoint that receives recording links; guarded by the same SHARED_SECRET.
var APP_RECORDINGS_URL = 'https://innovators.iodacademy.id/api/mentoring/recordings';

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
      case 'refreshMeet':
        return json(refreshMeet(body));
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

  // Ruang Meet dibuat lewat Meet API, bukan createRequest Calendar: hanya ruang
  // yang dibuat aplikasi sendiri yang anggotanya boleh diatur, dan mentor perlu
  // menjadi co-host agar dapat merekam (ia berasal dari luar organisasi).
  // Bila Meet API gagal, jatuh ke cara lama agar booking tetap mendapat tautan.
  //
  // The Meet space is made through the Meet API rather than a Calendar
  // createRequest: only spaces the app created itself may have their members
  // managed, and the mentor needs to be a co-host to record (they come from
  // outside the organisation). If the Meet API fails, fall back to the old way
  // so the booking still gets a link.
  var space = null;
  try {
    space = createMeetSpace(body.mentorEmail, body.studentEmail);
  } catch (err) {
    console.warn('Meet API gagal, memakai createRequest Calendar: ' + err);
  }

  var resource = {
    summary: body.summary,
    description: body.description || '',
    start: { dateTime: body.startsAt, timeZone: 'Asia/Jakarta' },
    end: { dateTime: body.endsAt, timeZone: 'Asia/Jakarta' },
    attendees: attendees,
    // Tamu tidak dapat mengundang orang lain atau mengubah event: tautan Meet
    // dan rekamannya hanya untuk mentor dan peserta sesi ini.
    // Guests cannot invite others or modify the event: the Meet link and its
    // recording are only for this session's mentor and participant.
    guestsCanInviteOthers: false,
    guestsCanModify: false,
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
      // meetUrl disimpan agar email pengingat tetap memuat tautan bila
      // Calendar tidak menampilkannya sebagai hangoutLink.
      // meetUrl is stored so reminder emails still carry the link if Calendar
      // does not surface it as hangoutLink.
      private: { app: APP_TAG, bookingId: String(body.bookingId), meetUrl: space ? space.meetingUri : '' },
    },
    conferenceData: space
      ? spaceConference(space)
      : {
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

  if (space) {
    // Tautan juga ditulis di deskripsi: bila Calendar menolak memasang ruang
    // itu sebagai conference, undangan tetap memuat tautannya.
    // The link is also written into the description: if Calendar refuses to
    // attach the space as a conference, the invitation still carries the link.
    resource.description = (resource.description ? resource.description + '\n\n' : '') + 'Google Meet: ' + space.meetingUri;
    resource.location = space.meetingUri;
  }

  var created = Calendar.Events.insert(resource, CALENDAR_ID, {
    conferenceDataVersion: 1,
    sendUpdates: 'all',
  });

  // Conference dibuat asinkron; balasan pertama bisa belum memuat tautannya.
  // Conference creation is asynchronous; the first response may not carry the
  // link yet.
  var meetUrl = created.hangoutLink || (space ? space.meetingUri : null);
  var status = space ? 'success' : pickStatus(created);

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
    // true bila ruangnya dibuat lewat Meet API dengan mentor sebagai co-host.
    // true when the space was made through the Meet API with the mentor as co-host.
    cohost: Boolean(space),
  };
}

/**
 * Membuat ruang Meet lewat Meet REST API dan menjadikan mentor co-host.
 *
 * Co-host dapat merekam, mengizinkan peserta masuk, dan mengelola rapat walau
 * berasal dari luar organisasi akun bootcamp. Gagal menambah co-host tidak
 * menggagalkan ruangnya: rapat tetap berjalan, hanya tanpa hak itu.
 *
 * Creates a Meet space through the Meet REST API and makes the mentor co-host.
 *
 * A co-host can record, admit participants and manage the meeting even from
 * outside the bootcamp account's organisation. Failing to add the co-host does
 * not fail the space: the meeting still works, just without those rights.
 */
function createMeetSpace(mentorEmail, studentEmail) {
  // Akses OPEN: siapa pun yang memegang tautan langsung masuk tanpa mengetuk.
  // Ruang dari Meet API tidak mengenali tamu undangan Calendar, sehingga dengan
  // akses bawaan peserta dari luar organisasi harus diizinkan masuk satu per
  // satu, dan co-host dari luar organisasi tidak selalu dapat melakukannya.
  // Tautannya hanya dikirim kepada mentor dan peserta sesi itu.
  //
  // OPEN access: anyone holding the link joins without knocking. A Meet API
  // space does not recognise Calendar invitees, so with the default access a
  // participant from outside the organisation must be admitted one by one, and
  // an outside co-host cannot always do that. The link is only sent to that
  // session's mentor and participant.
  // moderation ON (Host Management): peran co-host dari spaces.members baru
  // berlaku penuh, termasuk mengizinkan masuk dan merekam, bila moderasinya
  // menyala. Tanpanya mentor tercatat co-host tetapi tidak mendapat kendalinya.
  // moderation ON (Host Management): a co-host role from spaces.members only
  // takes full effect, admitting and recording included, with moderation on.
  // Without it the mentor is listed as co-host but gets none of the controls.
  var space = meetApi('post', 'https://meet.googleapis.com/v2/spaces', { config: { accessType: 'OPEN', moderation: 'ON' } });
  if (!space || !space.meetingUri || !space.name) throw new Error('Balasan Meet API tanpa meetingUri');
  enableAutoRecording(space.name);

  if (mentorEmail) {
    try {
      meetApi('post', 'https://meet.googleapis.com/v2/' + space.name + '/members', { email: mentorEmail, role: 'COHOST' });
    } catch (err) {
      console.warn('Gagal menjadikan mentor co-host: ' + err);
    }
  }
  return space;
}

/**
 * Menyalakan rekam otomatis sebuah ruang Meet.
 *
 * Rekaman dimulai sendiri begitu rapat berjalan dan tersimpan di Drive akun
 * bootcamp. Co-host dari luar organisasi tidak selalu boleh merekam, sedangkan
 * penyelenggara selalu boleh, asalkan edisi Workspace-nya mendukung perekaman.
 * Kegagalan diabaikan: rapat tetap dapat dipakai tanpa rekaman.
 *
 * Turns on auto-recording for a Meet space.
 *
 * Recording starts on its own once the meeting runs and lands in the bootcamp
 * account's Drive. An outside co-host may not always record, while the organiser
 * always may, provided the Workspace edition supports recording. Failure is
 * ignored: the meeting still works without a recording.
 */
function enableAutoRecording(spaceName) {
  try {
    meetApi(
      'patch',
      'https://meet.googleapis.com/v2/' + spaceName + '?updateMask=config.artifactConfig.recordingConfig.autoRecordingGeneration',
      { config: { artifactConfig: { recordingConfig: { autoRecordingGeneration: 'ON' } } } }
    );
  } catch (err) {
    console.warn('Gagal menyalakan rekam otomatis: ' + err);
  }
}

/**
 * Memperbaiki ruang Meet mentoring yang sudah dibuat: akses dibuka (peserta tidak
 * perlu diizinkan masuk), Host Management dinyalakan agar co-host mentor
 * berlaku, dan rekam otomatis dinyalakan. Jalankan sekali dari
 * editor; aman dijalankan ulang. Hasilnya tampil di Execution log.
 *
 * Fixes Meet spaces already created for mentoring: access is opened (participants
 * need not be admitted), Host Management turned on so the mentor's co-host role
 * applies, and auto-recording turned on. Run once from the editor;
 * safe to rerun. Results show in the Execution log.
 */
function fixUpcomingMeetSpaces() {
  var now = new Date();
  var until = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);
  var list = Calendar.Events.list(CALENDAR_ID, {
    timeMin: now.toISOString(),
    timeMax: until.toISOString(),
    singleEvents: true,
    privateExtendedProperty: 'app=' + APP_TAG,
    maxResults: 250,
  });
  var ok = 0;
  var failed = 0;
  (list.items || []).forEach(function (event) {
    var priv = (event.extendedProperties && event.extendedProperties.private) || {};
    var uri = priv.meetUrl || event.hangoutLink || '';
    var code = uri.split('/').pop();
    if (!code) return;
    try {
      var space = meetApi('get', 'https://meet.googleapis.com/v2/spaces/' + code);
      meetApi('patch', 'https://meet.googleapis.com/v2/' + space.name + '?updateMask=config.accessType,config.moderation', { config: { accessType: 'OPEN', moderation: 'ON' } });
      enableAutoRecording(space.name);
      // Event lama juga dikunci agar tamu tidak dapat menambah orang lain.
      // Older events are locked too so guests cannot add anyone else.
      Calendar.Events.patch({ guestsCanInviteOthers: false, guestsCanModify: false }, CALENDAR_ID, event.id, { sendUpdates: 'none' });
      ok++;
      console.log('OK ' + event.summary + ' ' + uri);
    } catch (err) {
      // Ruang buatan Calendar (cara lama) tidak dapat diubah lewat Meet API.
      // A space made by Calendar (the old way) cannot be changed via the Meet API.
      failed++;
      console.log('LEWATI ' + event.summary + ' ' + uri + ': ' + err);
    }
    Utilities.sleep(1500);
  });
  console.log('Selesai: ' + ok + ' diperbaiki, ' + failed + ' dilewati');
}

/**
 * Conference Calendar untuk ruang Meet yang sudah ada, agar undangan
 * menampilkan tombol "Gabung dengan Google Meet".
 *
 * A Calendar conference for an existing Meet space, so the invitation shows
 * the "Join with Google Meet" button.
 */
function spaceConference(space) {
  return {
    conferenceId: space.meetingCode,
    conferenceSolution: { key: { type: 'hangoutsMeet' } },
    entryPoints: [{ entryPointType: 'video', uri: space.meetingUri, label: space.meetingUri.replace('https://', '') }],
  };
}

/**
 * Mengganti ruang Meet sebuah event yang sudah ada dengan ruang baru yang
 * mentornya co-host, tanpa mengirim email apa pun.
 *
 * Event yang sama diperbarui, bukan dibatalkan lalu dibuat ulang: undangan di
 * kalender mentor dan peserta ikut berganti tautannya, tanpa email undangan
 * baru maupun pembatalan yang membingungkan mereka.
 *
 * Replaces an existing event's Meet space with a new one where the mentor is
 * co-host, without sending any email.
 *
 * The same event is updated rather than cancelled and recreated: the invitation
 * on the mentor's and participant's calendars switches link with it, with no
 * new-invitation or cancellation email to confuse them.
 */
function refreshMeet(body) {
  var space = createMeetSpace(body.mentorEmail, body.studentEmail);
  var event = Calendar.Events.get(CALENDAR_ID, body.eventId);
  var priv = (event.extendedProperties && event.extendedProperties.private) || {};
  priv.meetUrl = space.meetingUri;
  var description = String(event.description || '').replace(/\s*Google Meet: \S+/g, '');

  Calendar.Events.patch(
    {
      conferenceData: spaceConference(space),
      description: (description ? description + '\n\n' : '') + 'Google Meet: ' + space.meetingUri,
      location: space.meetingUri,
      extendedProperties: { private: priv },
      guestsCanInviteOthers: false,
      guestsCanModify: false,
    },
    CALENDAR_ID,
    body.eventId,
    { conferenceDataVersion: 1, sendUpdates: 'none' }
  );

  return { eventId: body.eventId, meetUrl: space.meetingUri };
}

function meetApi(method, url, payload) {
  var options = {
    method: method,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  };
  if (payload !== undefined) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }
  var res = UrlFetchApp.fetch(url, options);
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Meet API ' + code + ': ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText() || '{}');
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
  var priv = (event.extendedProperties && event.extendedProperties.private) || {};
  var link = event.hangoutLink || priv.meetUrl || '(tautan Meet ada di undangan Google Calendar)';

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
    var name = t.getHandlerFunction();
    if (name === 'sendReminders' || name === 'attachRecordings') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendReminders').timeBased().everyMinutes(5).create();
  // Rekaman diproses Google beberapa menit sampai satu jam setelah rapat; 30
  // menit cukup cepat tanpa menghabiskan kuota.
  // Google processes recordings minutes to an hour after a meeting; 30 minutes
  // is quick enough without spending quota.
  ScriptApp.newTrigger('attachRecordings').timeBased().everyMinutes(30).create();
}

/**
 * Mencari rekaman sesi mentoring yang sudah selesai, membagikannya kepada
 * mentor dan peserta tanpa email, melampirkannya ke event Calendar, lalu
 * mengirim tautannya ke aplikasi.
 *
 * Ruang dari Meet API tidak terhubung asli dengan event Calendar, sehingga Meet
 * tidak melampirkan rekamannya sendiri seperti rapat buatan Calendar.
 *
 * Finds recordings of finished mentoring sessions, shares them with the mentor
 * and participant without email, attaches them to the Calendar event, then
 * sends the link to the app.
 *
 * A Meet API space is not natively tied to its Calendar event, so Meet does not
 * attach the recording by itself the way it does for Calendar-made meetings.
 */
function attachRecordings() {
  var now = new Date();
  var since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  var list = Calendar.Events.list(CALENDAR_ID, {
    timeMin: since.toISOString(),
    timeMax: now.toISOString(),
    singleEvents: true,
    privateExtendedProperty: 'app=' + APP_TAG,
    maxResults: 250,
  });

  (list.items || []).forEach(function (event) {
    var end = new Date(event.end.dateTime || event.end.date);
    if (end > now) return;
    var priv = (event.extendedProperties && event.extendedProperties.private) || {};
    if (priv.recordingUrl) return;
    var code = String(priv.meetUrl || event.hangoutLink || '').split('/').pop();
    if (!code) return;

    try {
      var space = meetApi('get', 'https://meet.googleapis.com/v2/spaces/' + code);
      var records = meetApi('get', 'https://meet.googleapis.com/v2/conferenceRecords?filter=' + encodeURIComponent('space.name="' + space.name + '"')).conferenceRecords || [];
      var files = [];
      records.forEach(function (record) {
        var recs = meetApi('get', 'https://meet.googleapis.com/v2/' + record.name + '/recordings').recordings || [];
        recs.forEach(function (r) {
          if (r.state === 'FILE_GENERATED' && r.driveDestination && r.driveDestination.file) files.push(r.driveDestination);
        });
      });
      if (files.length === 0) return;

      if (!priv.bookingId) return;
      var url = files[0].exportUri || 'https://drive.google.com/file/d/' + files[0].file + '/view';

      // Aplikasi menyimpan tautannya lebih dulu, lalu membalas dengan email
      // mentor dan peserta menurut datanya sendiri; hanya keduanya yang diberi
      // akses. Daftar tamu event tidak dipercaya karena tamu dapat menambah
      // orang lain. Bila aplikasi gagal, event tidak ditandai, sehingga
      // percobaan berikutnya mengulang dari awal.
      // The app stores the link first, then replies with the mentor's and
      // participant's emails from its own data; only they are given access. The
      // event's guest list is not trusted because guests can add others. If the
      // app fails, the event is left unmarked so the next run starts over.
      var res = UrlFetchApp.fetch(APP_RECORDINGS_URL, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ secret: PropertiesService.getScriptProperties().getProperty('SHARED_SECRET'), bookingId: priv.bookingId, recordingUrl: url }),
        muteHttpExceptions: true,
      });
      if (res.getResponseCode() !== 200) {
        console.warn('Aplikasi menolak rekaman ' + event.summary + ': ' + res.getContentText().slice(0, 200));
        return;
      }
      var shareWith = JSON.parse(res.getContentText() || '{}').shareWith || [];
      files.forEach(function (f) {
        shareWith.forEach(function (email) {
          try {
            // sendNotificationEmail false: berbagi tanpa email agar tamu tidak bingung.
            // sendNotificationEmail false: sharing without email so guests are not confused.
            Drive.Permissions.create({ role: 'reader', type: 'user', emailAddress: email }, f.file, { sendNotificationEmail: false });
          } catch (err) {
            console.warn('Gagal membagikan rekaman ke ' + email + ': ' + err);
          }
        });
      });

      var attachments = (event.attachments || []).concat(
        files.map(function (f, i) {
          return { fileUrl: f.exportUri || 'https://drive.google.com/file/d/' + f.file + '/view', title: 'Rekaman mentoring' + (files.length > 1 ? ' ' + (i + 1) : ''), mimeType: 'video/mp4' };
        })
      );
      priv.recordingUrl = url;
      Calendar.Events.patch({ attachments: attachments, extendedProperties: { private: priv } }, CALENDAR_ID, event.id, {
        supportsAttachments: true,
        sendUpdates: 'none',
      });
      console.log('Rekaman dilampirkan: ' + event.summary);
    } catch (err) {
      // Ruang buatan Calendar (cara lama) tidak dapat dibaca lewat Meet API.
      // A space made by Calendar (the old way) cannot be read through the Meet API.
      console.warn('Lewati ' + event.summary + ': ' + err);
    }
  });
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
