// Registers the service worker and wires the "Turn on reminders" button (any element with data-push).
(function () {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {});

  var btn = document.querySelector('[data-push]');
  var status = document.querySelector('[data-push-status]');
  var key = document.querySelector('meta[name="vh-push-key"]');
  if (!btn || !key || !key.content || !('PushManager' in window) || !('Notification' in window)) {
    if (btn) btn.hidden = true;
    if (status && btn) status.textContent = isIos() && !standalone() ? 'To get reminders on iPhone, add this app to your Home Screen first (see Install).' : '';
    return;
  }
  function say(t) { if (status) status.textContent = t; }
  function isIos() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
  function standalone() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
  function toBytes(b64) {
    var pad = '='.repeat((4 - (b64.length % 4)) % 4);
    var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function send(sub) {
    return fetch('/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub), credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('save failed'); });
  }
  navigator.serviceWorker.ready.then(function (reg) {
    return reg.pushManager.getSubscription().then(function (sub) {
      if (sub) { btn.hidden = true; say('Reminders are on for this device.'); return send(sub.toJSON()).catch(function () {}); }
      if (Notification.permission === 'denied') { btn.hidden = true; say('Reminders are blocked in this browser’s settings.'); return; }
      btn.hidden = false;
      btn.addEventListener('click', function () {
        btn.disabled = true;
        Notification.requestPermission().then(function (p) {
          if (p !== 'granted') { btn.disabled = false; say('No problem. You can turn them on any time.'); return; }
          return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key.content) })
            .then(function (s) { return send(s.toJSON()); })
            .then(function () { btn.hidden = true; say('Reminders are on for this device.'); });
        }).catch(function () { btn.disabled = false; say('That didn’t work. Try again in a moment.'); });
      });
    });
  });
})();
