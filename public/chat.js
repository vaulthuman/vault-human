/* Tercet / Vault Human website chat · one file, no dependencies.
   Add to any page:  <script src="/chat.js" data-brand="tercet" defer></script>   (or data-brand="vault")
   Talks to the Client Engine; when it has a name + phone, the engine texts Russ and the visitor. */
(function () {
  var ENGINE = 'https://script.google.com/macros/s/AKfycbwu3hRaM40_ycZhggsKObfRX2eY2hjm9wuqMtQjefgTj-mwip7GtZM4H1gnIaOzF8IJqw/exec';
  var me = document.currentScript || document.querySelector('script[src*="chat.js"]');
  var brand = (me && me.getAttribute('data-brand')) || (/vaulthuman/.test(location.host) ? 'vault' : 'tercet');
  var B = brand === 'vault'
    ? { name: 'Vault Human', hello: 'Hi, I\'m the Vault Human assistant. What\'s on your mind? I can set up a free first conversation with Russ.', color: '#1f3b2d' }
    : { name: 'Tercet Law', hello: 'Hi, I\'m the Tercet Law assistant. Tell me a little about your will, trust or probate question and I\'ll set up a free 15-minute call with Russ.', color: '#14213d' };
  var sid; try { sid = sessionStorage.getItem('vh_chat_sid'); } catch (e) {}
  if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); try { sessionStorage.setItem('vh_chat_sid', sid); } catch (e) {} }
  var msgs = [];

  var css = '#vhc-btn{position:fixed;right:18px;bottom:18px;z-index:99999;background:' + B.color + ';color:#fff;border:0;border-radius:28px;padding:13px 18px;font:600 15px system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer}' +
    '#vhc{position:fixed;right:18px;bottom:78px;z-index:99999;width:340px;max-width:calc(100vw - 32px);height:460px;max-height:calc(100vh - 110px);background:#fff;color:#1a1a1a;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.3);display:none;flex-direction:column;overflow:hidden;font:14px/1.45 system-ui,sans-serif}' +
    '#vhc header{background:' + B.color + ';color:#fff;padding:12px 14px;font-weight:700;display:flex;justify-content:space-between}#vhc header button{background:none;border:0;color:#fff;font-size:18px;cursor:pointer}' +
    '#vhc-log{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}.vhc-m{max-width:85%;padding:8px 11px;border-radius:12px;white-space:pre-wrap}.vhc-a{background:#f0f0f3;align-self:flex-start}.vhc-u{background:' + B.color + ';color:#fff;align-self:flex-end}' +
    '#vhc form{display:flex;border-top:1px solid #e5e5ea}#vhc input{flex:1;border:0;padding:12px;font:inherit;outline:none}#vhc form button{border:0;background:none;color:' + B.color + ';font-weight:700;padding:0 14px;cursor:pointer}' +
    '#vhc small{display:block;text-align:center;color:#888;font-size:11px;padding:4px}' +
    '@media(max-width:760px){#vhc-btn{bottom:80px;right:14px;padding:11px 15px;font-size:14px}#vhc{bottom:132px;right:12px;height:420px}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var btn = document.createElement('button'); btn.id = 'vhc-btn'; btn.textContent = 'Chat with us'; document.body.appendChild(btn);
  var box = document.createElement('div'); box.id = 'vhc';
  box.innerHTML = '<header><span>' + B.name + '</span><button aria-label="Close">×</button></header><div id="vhc-log"></div>' +
    '<form><input placeholder="Type here…" aria-label="Message" maxlength="800"><button>Send</button></form><small>Or call/text (888) 833-2510</small>';
  document.body.appendChild(box);
  var log = box.querySelector('#vhc-log'), input = box.querySelector('input');
  function add(role, text) { var d = document.createElement('div'); d.className = 'vhc-m ' + (role === 'user' ? 'vhc-u' : 'vhc-a'); d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
  var opened = false;
  btn.onclick = function () { box.style.display = box.style.display === 'flex' ? 'none' : 'flex'; if (!opened) { opened = true; add('assistant', B.hello); msgs.push({ role: 'assistant', content: B.hello }); } input.focus(); };
  box.querySelector('header button').onclick = function () { box.style.display = 'none'; };
  box.querySelector('form').onsubmit = function (e) {
    e.preventDefault(); var t = input.value.trim(); if (!t) return; input.value = '';
    add('user', t); msgs.push({ role: 'user', content: t });
    var wait = add('assistant', '…');
    var send = msgs[0].role === 'assistant' ? msgs.slice(1) : msgs;
    fetch(ENGINE, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'chat', brand: brand, sid: sid, messages: send }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { wait.textContent = j.reply || 'Please call or text (888) 833-2510.'; msgs.push({ role: 'assistant', content: wait.textContent }); })
      .catch(function () { wait.textContent = 'Sorry, the chat is down for a moment. Please call or text (888) 833-2510.'; });
  };
})();
