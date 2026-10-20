/* Vault Human — end-of-page dock: "Back to top" + "Watch the film". Appears when the visitor nears the bottom of any page. */
(function(){
  if (window.__vhDock) return; window.__vhDock = true;
  var FILM = '/img/russ/v2/how-it-works.mp4', POSTER = '/img/russ/v2/how-it-works-poster.jpg';
  var css = ''
   + '.vh-dock{position:fixed;left:50%;bottom:22px;z-index:880;display:flex;gap:6px;padding:6px;border-radius:999px;'
   + 'background:rgba(22,29,24,.92);border:1px solid rgba(143,166,126,.45);box-shadow:0 14px 40px rgba(0,0,0,.45);'
   + '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transform:translate(-50%,18px);opacity:0;pointer-events:none;'
   + 'transition:opacity .3s ease,transform .3s ease;font-family:Inter,system-ui,sans-serif}'
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
                 + '<button type="button" class="vh-dock__film">' + play + 'Watch the film</button>';
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
    own = document.createElement('div'); own.className = 'vh-film'; own.setAttribute('role','dialog'); own.setAttribute('aria-label','Vault Human film');
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
    var existing = document.querySelector('[data-vpop]');
    if (existing && document.getElementById('vpop')) { existing.click(); return; }
    var o = ownFilm(), v = o.querySelector('video');
    if (!v.getAttribute('src')) { v.src = FILM; v.poster = POSTER; } else { v.currentTime = 0; }
    o.classList.add('open'); document.body.style.overflow = 'hidden';
    var p = v.play(); if (p && p.catch) p.catch(function(){});
  });

  var ticking = false;
  function check(){
    ticking = false;
    var h = document.documentElement, total = h.scrollHeight, seen = (window.scrollY || h.scrollTop) + innerHeight;
    var near = total > innerHeight * 1.5 && (total - seen) < Math.max(innerHeight * 0.9, 700);
    var toast = document.querySelector('.vk-toast.in');
    dock.classList.toggle('on', near && !toast);
  }
  addEventListener('scroll', function(){ if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
  addEventListener('resize', check); check();
})();
