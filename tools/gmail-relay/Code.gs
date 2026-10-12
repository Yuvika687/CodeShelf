/**
 * CodeShelf Gmail relay — Google Apps Script web app.
 *
 * Lets the CodeShelf backend send email through your own Gmail over HTTPS
 * (Render's free tier blocks SMTP). Free, no extra accounts; Google allows
 * about 100 recipients per day for a personal Gmail account.
 *
 * Setup: paste into https://script.google.com, set SECRET below to the same
 * value as GMAIL_SCRIPT_SECRET on Render, then Deploy → New deployment →
 * Web app (Execute as: Me, Who has access: Anyone) and copy the URL into
 * GMAIL_SCRIPT_URL on Render.
 */

const SECRET = 'PASTE-THE-SAME-SECRET-AS-RENDER';

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: 'invalid JSON' });
  }
  if (!SECRET || SECRET.indexOf('PASTE-') === 0 || data.secret !== SECRET) {
    return reply({ ok: false, error: 'unauthorized' });
  }
  if (!data.to || !data.subject) {
    return reply({ ok: false, error: 'to and subject are required' });
  }
  try {
    MailApp.sendEmail({
      to: String(data.to),
      subject: String(data.subject),
      body: String(data.text || ''),
      htmlBody: data.html ? String(data.html) : undefined,
      name: String(data.name || 'CodeShelf'),
    });
    return reply({ ok: true, remaining: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return reply({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doGet() {
  return reply({ ok: true, service: 'codeshelf-gmail-relay', remaining: MailApp.getRemainingDailyQuota() });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
