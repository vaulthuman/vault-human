/** ===== Branded HTML for every Key email (added 10/24/26). Plain text stays as the fallback. ===== */
var IMG = 'https://www.vaulthuman.com/email/';
var FONT = "Inter,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";

function esc_(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function linkify_(s) { return s.replace(/(https?:\/\/[^\s<]+[^\s<.,;:)])/g, '<a href="$1" style="color:#C9A24A">$1</a>'); }

function shell_(inner, pre) {
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>' +
    '<body style="margin:0;padding:0;background:#141A16">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + esc_(pre || '') + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#141A16"><tr><td align="center">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#141A16">' +
    '<tr><td style="padding:28px 28px 18px"><img src="' + IMG + 'vh-mark.png" width="300" alt="VAULT HUMAN · Online life coaching" style="display:block;width:300px;max-width:70%;height:auto;border:0"></td></tr>' +
    inner +
    '<tr><td style="padding:26px 28px 34px;border-top:1px solid #26302a;font:13px/1.6 ' + FONT + ';color:#8E9A90">' +
    '<a href="https://www.vaulthuman.com/" style="color:#8E9A90">vaulthuman.com</a> · <a href="mailto:vault@vaulthuman.com" style="color:#8E9A90">vault@vaulthuman.com</a> · <a href="tel:+18888332510" style="color:#8E9A90;white-space:nowrap">(888)&nbsp;833-2510</a><br>' +
    'Coaching, not therapy. <a href="mailto:vault@vaulthuman.com?subject=Unsubscribe" style="color:#8E9A90">Unsubscribe</a></td></tr>' +
    '</table></td></tr></table></body></html>';
}

function p_(t, color) { return '<p style="margin:0 0 16px;color:' + (color || '#CFC9BC') + '">' + t + '</p>'; }

function stepBox_(t) {
  return '<tr><td style="padding:8px 28px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#2A2616;border:1px solid #C9A24A;border-radius:12px"><tr><td style="padding:22px 24px;font:17px/1.6 ' + FONT + ';color:#F1EDE4">' +
    '<p style="margin:0 0 10px;font:700 12px/1 ' + FONT + ';letter-spacing:.18em;text-transform:uppercase;color:#C9A24A">Today\'s step</p>' +
    '<p style="margin:0">' + t + '</p></td></tr></table></td></tr>';
}

function button_(href, label) {
  return '<tr><td style="padding:22px 28px 6px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#C9A24A;border-radius:8px">' +
    '<a href="' + href + '" style="display:inline-block;padding:15px 26px;font:700 16px ' + FONT + ';color:#15190f;text-decoration:none">' + label + '</a></td></tr></table></td></tr>';
}

function callCard_(booking) {
  return '<tr><td style="padding:24px 28px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1A2420;border:1px solid #2c3a33;border-radius:12px"><tr><td style="padding:20px 24px;font:16px/1.55 ' + FONT + ';color:#CFC9BC">' +
    '<p style="margin:0 0 6px;font:700 19px/1.3 ' + FONT + ';color:#C9A24A">Want to talk it through?</p>' +
    '<p style="margin:0 0 12px">A free 30-minute call with a Vault Human coach. One question when you book.</p>' +
    '<a href="' + booking + '" style="font:600 16px ' + FONT + ';color:#C9A24A">Pick a time &rarr;</a></td></tr></table></td></tr>';
}

/** Turns an archive Key (plain text) into the branded email. */
function keyHtml_(day, subject, text, booking) {
  var title = String(subject).replace(/^Day\s*\d+\s*[:·-]\s*/i, '');
  var paras = String(text).split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(String);
  var greet = '', body = [], step = '', link = '', sign = [];
  paras.forEach(function (para) {
    if (/^Hi\b/.test(para) && !greet) { greet = para; return; }
    var m = para.match(/^Read it on the site:\s*(\S+)/i); if (m) { link = m[1]; return; }
    if (/pick a time|talk it through/i.test(para)) return;
    if (/^Russ Michaels/.test(para) || /^Vault Human ·/.test(para)) { sign.push(para); return; }
    if (/^Today\b/.test(para) && !step) { step = para.replace(/^Today:\s*/, ''); step = step.charAt(0).toUpperCase() + step.slice(1); return; }
    body.push(para);
  });
  var photo = (day % 2 === 0) ? 'people-walk.jpg' : 'people-table.jpg';
  var inner =
    '<tr><td style="padding:6px 28px 0;font:700 13px/1 ' + FONT + ';letter-spacing:.18em;text-transform:uppercase;color:#C9A24A">Key ' + day + '</td></tr>' +
    '<tr><td style="padding:10px 28px 18px;font:800 32px/1.12 ' + FONT + ';letter-spacing:-.01em;color:#F1EDE4">' + esc_(title).replace(/ (\S+)$/, '&nbsp;$1') + '</td></tr>' +
    '<tr><td style="padding:0 28px"><img src="' + IMG + photo + '" width="544" alt="People spending time together" style="display:block;width:100%;height:auto;border:0;border-radius:12px"></td></tr>' +
    '<tr><td style="padding:24px 28px 4px;font:17px/1.65 ' + FONT + '">' +
    (greet ? p_(esc_(greet), '#F1EDE4') : '') +
    body.map(function (b) { return p_(linkify_(esc_(b)).replace(/\n/g, '<br>')); }).join('') +
    '</td></tr>' +
    (step ? stepBox_(linkify_(esc_(step))) : '') +
    (link ? button_(link, 'Read the full Key') : '') +
    callCard_(booking) +
    '<tr><td style="padding:24px 28px 10px;font:17px/1.6 ' + FONT + ';color:#F1EDE4"><p style="margin:0 0 6px">See you tomorrow at 7.</p>' +
    '<p style="margin:14px 0 0">Russ Michaels<br><span style="color:#8E9A90;font-size:14px">Founder, Vault Human</span></p></td></tr>';
  return shell_(inner, step ? 'Today: ' + step.slice(0, 90) : title);
}

var DAY1_HTML = '<!doctype html> <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"> <title>Your first Key</title> <style>body{margin:0;padding:0;background:#141A16}a{color:#C9A24A}@media (max-width:620px){.px{padding-left:22px!important;padding-right:22px!important}.h1{font-size:28px!important}}</style> </head> <body style="margin:0;padding:0;background:#141A16"> <div style="display:none;max-height:0;overflow:hidden;opacity:0">Two minutes today: one line, out loud, and twenty minutes outside.</div> <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#141A16"><tr><td align="center" style="padding:0"> <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#141A16">  <tr><td class="px" style="padding:28px 32px 18px"><img src="https://www.vaulthuman.com/email/vh-mark.png" width="300" alt="VAULT HUMAN · Online life coaching" style="display:block;width:300px;max-width:70%;height:auto;border:0"></td></tr>  <tr><td style="padding:0"><a href="https://www.vaulthuman.com/writing/the-first-scroll/#film"><img src="https://www.vaulthuman.com/email/key01-hero.jpg" width="600" alt="Key 1: Choose a new life. Watch the 2-minute film." style="display:block;width:100%;max-width:600px;height:auto;border:0"></a></td></tr>  <tr><td class="px" style="padding:30px 32px 6px;font:17px/1.6 Inter,-apple-system,\'Segoe UI\',Arial,sans-serif;color:#F1EDE4"> <p style="margin:0 0 16px">Hi {first},</p> <p style="margin:0 0 16px;color:#CFC9BC">You\'re in. Every morning at 7 a Key arrives: two minutes to read and one small thing to do. This is the first one.</p> </td></tr>  <tr><td class="px" style="padding:6px 32px 8px"> <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-left:3px solid #C9A24A;padding:4px 0 4px 18px;font:italic 26px/1.3 Georgia,\'Times New Roman\',serif;color:#F1EDE4" class="h1">"Today I begin a new life."</td></tr> <tr><td style="padding:8px 0 0 21px;font:600 12px/1.4 Inter,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#C9A24A">Og Mandino · The first scroll, 1968</td></tr></table> </td></tr>  <tr><td class="px" style="padding:22px 32px 4px;font:17px/1.65 Inter,-apple-system,\'Segoe UI\',Arial,sans-serif;color:#CFC9BC"> <p style="margin:0 0 16px">You don\'t need a new life. You need one habit that is yours, kept long enough to change your mind about who you are.</p> <p style="margin:0 0 16px">Mandino\'s idea is gentler than it sounds. You don\'t argue your way out of an old habit. You out-repeat it. A page read aloud every morning replaces, by sheer repetition and sheer kindness, the voice that was there before.</p> </td></tr>  <tr><td class="px" style="padding:10px 32px 0"><img src="https://www.vaulthuman.com/email/key01-outside.jpg" width="536" alt="Four friends walking together down a country road" style="display:block;width:100%;height:auto;border:0;border-radius:12px"></td></tr>  <tr><td class="px" style="padding:20px 32px 6px"> <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#2A2616;border:1px solid #C9A24A;border-radius:12px"><tr><td style="padding:22px 24px;font:17px/1.6 Inter,-apple-system,\'Segoe UI\',Arial,sans-serif;color:#F1EDE4"> <p style="margin:0 0 10px;font:700 12px/1 Inter,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#C9A24A">Today\'s step</p> <p style="margin:0 0 10px"><b>1.</b> Read this line out loud, once: "Today I begin a new life."</p> <p style="margin:0 0 10px"><b>2.</b> Go outside for twenty minutes. Walk at talking pace, or just sit in the open air.</p> <p style="margin:0"><b>3.</b> Before bed, write one line: what you said, and who heard it.</p> </td></tr></table> </td></tr>  <tr><td class="px" align="left" style="padding:22px 32px 6px"> <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#C9A24A;border-radius:8px"><a href="https://www.vaulthuman.com/writing/the-first-scroll/#film" style="display:inline-block;padding:15px 26px;font:700 16px Inter,Arial,sans-serif;color:#15190f;text-decoration:none">Watch the 2-minute film</a></td></tr></table> </td></tr>  <tr><td class="px" style="padding:26px 32px 4px"> <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1A2420;border:1px solid #2c3a33;border-radius:12px"><tr><td style="padding:20px 24px;font:16px/1.55 Inter,-apple-system,\'Segoe UI\',Arial,sans-serif;color:#CFC9BC"> <p style="margin:0 0 6px;font:700 19px/1.3 Inter,-apple-system,\'Segoe UI\',Arial,sans-serif;color:#C9A24A">Want to talk it through?</p> <p style="margin:0 0 12px">A free 30-minute call with a Vault Human coach. One question when you book.</p> <a href="{booking}" style="font:600 16px Inter,Arial,sans-serif;color:#C9A24A">Pick a time &rarr;</a> </td></tr></table> </td></tr>  <tr><td class="px" style="padding:26px 32px 10px;font:17px/1.6 Inter,-apple-system,\'Segoe UI\',Arial,sans-serif;color:#F1EDE4"> <p style="margin:0 0 6px">See you tomorrow at 7. Hit reply and tell me what you read out loud. I read every reply myself.</p> <p style="margin:14px 0 0">Russ Michaels<br><span style="color:#8E9A90;font-size:14px">Founder, Vault Human</span></p> </td></tr>  <tr><td class="px" style="padding:26px 32px 34px;border-top:1px solid #26302a;font:13px/1.6 Inter,Arial,sans-serif;color:#8E9A90"> Your first week is on us.<br> <a href="https://www.vaulthuman.com/" style="color:#8E9A90">vaulthuman.com</a> · <a href="mailto:vault@vaulthuman.com" style="color:#8E9A90">vault@vaulthuman.com</a> · <a href="tel:+18888332510" style="color:#8E9A90;white-space:nowrap">(888)&nbsp;833-2510</a><br> Coaching, not therapy. <a href="mailto:vault@vaulthuman.com?subject=Unsubscribe" style="color:#8E9A90">Unsubscribe</a> </td></tr>  </table></td></tr></table> </body></html> ';

/** Sends the branded Key email for a day to one address, for checking how it looks. */
function testKeyEmail(to, day) {
  to = to || 'vault@vaulthuman.com'; day = day || 1;
  var k = keyRow_(day);
  var text = String(k.body).replace(/\{first\}/g, 'Russ').replace(/\{booking\}/g, CFG.booking);
  GmailApp.sendEmail(to, '[Preview] ' + k.subject, text, { from: CFG.from, name: CFG.fromName, replyTo: CFG.from, htmlBody: keyHtmlFor_(day, k.subject, text, 'Russ') });
}
function testKeyEmails() { testKeyEmail('vault@vaulthuman.com', 1); testKeyEmail('vault@vaulthuman.com', 2); }

function keyHtmlFor_(day, subject, text, first) {
  if (day === 1) return DAY1_HTML.replace(/\{first\}/g, esc_(first || 'there')).replace(/\{booking\}/g, CFG.booking);
  return keyHtml_(day, subject, text, CFG.booking);
}
