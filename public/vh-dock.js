/* Vault Human — end-of-page dock: "Back to top" + "Watch the video". Slides up once the visitor has scrolled down a little and paused for a moment; tucks away while they scroll. */
(function(){
  if (window.__vhDock) return; window.__vhDock = true;
  var FILM = document.body.getAttribute('data-film') || '/img/russ/v2/how-it-works.mp4', POSTER = document.body.getAttribute('data-film-poster') || '/img/russ/v2/how-it-works-poster.jpg';
  var css = ''
   + '.vh-dock{position:fixed;left:50%;bottom:22px;z-index:880;display:flex;gap:6px;padding:6px;border-radius:999px;'
   + 'background:rgba(22,29,24,.92);border:1px solid rgba(143,166,126,.45);box-shadow:0 14px 40px rgba(0,0,0,.45);'
   + '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transform:translate(-50%,28px);opacity:0;pointer-events:none;'
   + 'transition:opacity .45s ease,transform .45s cubic-bezier(.2,.8,.2,1);font-family:Inter,system-ui,sans-serif}'
   + '.vh-dock.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}'
   + '.vh-dock button{display:inline-flex;align-items:center;gap:8px;border:0;border-radius:999px;cursor:pointer;'
   + 'padding:10px 16px;font:600 12px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;'
   + 'background:transparent;color:#E8ECE6;transition:background .2s ease,color .2s ease;white-space:nowrap}'
   + '.vh-dock button:hover,.vh-dock button:focus-visible{background:rgba(143,166,126,.18);outline:none}'
   + '.vh-dock .vh-dock__film{background:#8FA67E;color:#10160F}'
   + '.vh-dock .vh-dock__film:hover,.vh-dock .vh-dock__film:focus-visible{background:#A3B893;color:#10160F}'
   + '.vh-dock svg{width:14px;height:14px;flex:none}'
   + '@media(max-width:760px){body.has-sticky .vh-dock{bottom:84px}.vh-dock button{padding:10px 14px}}'
   + '@media(prefers-reduced-motion:reduce){.vh-dock{transition:none}}'
   + '.vh-film{position:fixed;inset:0;z-index:2147483001;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.86)}'
   + '.vh-film.open{display:flex}.vh-film video{max-width:min(960px,94vw);max-height:84vh;border-radius:10px;background:#000}'
   + '.vh-film button{position:absolute;top:14px;right:18px;background:none;border:0;color:#fff;font-size:34px;line-height:1;cursor:pointer}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var up = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var play = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6L12.8 8z" fill="currentColor"/></svg>';
  var dock = document.createElement('nav');
  dock.className = 'vh-dock'; dock.setAttribute('aria-label', 'Page shortcuts');
  dock.innerHTML = '<button type="button" class="vh-dock__top">' + up + 'Back to top</button>'
                 + '<button type="button" class="vh-dock__film">' + play + 'Watch the video</button>';
  document.body.appendChild(dock);
  var pad = document.createElement('div'); pad.className = 'vh-dock-space'; pad.setAttribute('aria-hidden','true');
  pad.style.cssText = 'height:84px;background:inherit'; document.body.insertBefore(pad, dock);

  dock.querySelector('.vh-dock__top').addEventListener('click', function(){
    var smooth = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  });

  var own = null;
  function ownFilm(){
    if (own) return own;
    own = document.createElement('div'); own.className = 'vh-film'; own.setAttribute('role','dialog'); own.setAttribute('aria-label','Vault Human video');
    own.innerHTML = '<button type="button" aria-label="Close">&times;</button><video playsinline controls preload="none"></video>';
    document.body.appendChild(own);
    var v = own.querySelector('video');
    function close(){ v.pause(); own.classList.remove('open'); document.body.style.overflow=''; }
    own.querySelector('button').addEventListener('click', close);
    own.addEventListener('click', function(e){ if (e.target === own) close(); });
    v.addEventListener('ended', close);
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && own.classList.contains('open')) close(); });
    return own;
  }
  dock.querySelector('.vh-dock__film').addEventListener('click', function(){
    dock.classList.remove('on');
    var existing = document.querySelector('[data-vpop]');
    if (existing && document.getElementById('vpop')) { existing.click(); return; }
    var o = ownFilm(), v = o.querySelector('video');
    if (!v.getAttribute('src')) { v.src = FILM; v.poster = POSTER; } else { v.currentTime = 0; }
    o.classList.add('open'); document.body.style.overflow = 'hidden';
    var p = v.play(); if (p && p.catch) p.catch(function(){});
  });

  var idle = null;
  // Never on screen with a popup, an open menu, a playing video, or the page's own buttons.
  var POPS = '.vh-modal,.dk-pop,.vpop,.vh-film,.vk-toast,dialog[open],[role="dialog"],[aria-modal="true"]';
  function visible(el){
    if (!el || el === dock || dock.contains(el)) return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  }
  function blocked(){
    var b = document.body;
    if (b.classList.contains('nav-open') || b.style.overflow === 'hidden' || document.fullscreenElement || document.webkitFullscreenElement) return true;
    var pops = document.querySelectorAll(POPS);
    for (var i = 0; i < pops.length; i++) if (visible(pops[i])) return true;
    var vids = document.querySelectorAll('video');
    for (var j = 0; j < vids.length; j++) { var v = vids[j]; if (!v.paused && !v.ended && !v.muted) return true; }
    var rows = document.querySelectorAll('.ctarow');
    for (var k = 0; k < rows.length; k++) { var r = rows[k].getBoundingClientRect(); if (r.height && r.bottom > 0 && r.top < innerHeight) return true; }
    return false;
  }
  function hide(){ dock.classList.remove('on'); }
  function show(){
    var h = document.documentElement, y = window.scrollY || h.scrollTop;
    var far = y > Math.max(innerHeight * 0.6, 500) && h.scrollHeight > innerHeight * 1.5;
    dock.classList.toggle('on', far && !blocked());
  }
  function later(){ clearTimeout(idle); idle = setTimeout(show, 1200); }
  addEventListener('scroll', function(){ hide(); later(); }, { passive: true });
  addEventListener('resize', later);
  // Any click that opens something: tuck away at once, re-check after it settles.
  document.addEventListener('click', function(e){ if (!dock.contains(e.target)) { hide(); later(); } }, true);
  document.addEventListener('play', function(){ hide(); }, true);
  ['pause','ended'].forEach(function(t){ document.addEventListener(t, later, true); });
  document.addEventListener('fullscreenchange', function(){ hide(); later(); });
  if (window.MutationObserver) new MutationObserver(function(){ if (dock.classList.contains('on') && blocked()) hide(); })
    .observe(document.body, { attributes: true, attributeFilter: ['class','style','open'], subtree: true });
})();
