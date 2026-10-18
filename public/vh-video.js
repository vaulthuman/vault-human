(function(){
  var vids=[].slice.call(document.querySelectorAll('video[autoplay]'));
  function go(v){v.muted=true;v.defaultMuted=true;v.playsInline=true;v.setAttribute('playsinline','');v.removeAttribute('controls');var p=v.play();if(p&&p.catch)p.catch(function(){});}
  function all(){vids.forEach(go);}
  all();
  ['touchstart','scroll','click','keydown'].forEach(function(e){window.addEventListener(e,function h(){all();},{passive:true,once:true});});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)all();});
  window.addEventListener('pageshow',all);
  vids.forEach(function(v){v.addEventListener('pause',function(){if(!document.hidden)setTimeout(function(){go(v);},300);});});
})();
