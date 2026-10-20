/* Vault Human — native 2-field capture → HubSpot form 3f225ab5 → /thanks (conversion + Calendly). */
(function(){
  var URL='https://api-na2.hsforms.com/submissions/v3/integration/submit/246947446/3f225ab5-5a70-46d9-a497-29e6256b1e52';
  document.addEventListener('submit',function(e){
    var f=e.target; if(!f.classList||!f.classList.contains('vh-cap')) return;
    e.preventDefault();
    var fn=f.querySelector('[name=firstname]'),em=f.querySelector('[name=email]'),go=f.querySelector('button[type=submit]'),err=f.querySelector('.vh-cap__err');
    var first=fn.value.trim(),email=em.value.trim();
    if(!first||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){f.reportValidity();return;}
    go.disabled=true;go.textContent='Sending…';if(err)err.style.display='none';
    var hutk=(document.cookie.match(/(?:^|; )hubspotutk=([^;]+)/)||[])[1];
    var ctx={pageUri:location.href,pageName:document.title};if(hutk)ctx.hutk=hutk;
    fetch(URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:[{name:'firstname',value:first},{name:'email',value:email}],context:ctx})})
    .then(function(r){if(!r.ok)throw new Error(r.status);var nx=f.getAttribute('data-next')||'/thanks/';if(nx.charAt(0)==='#'){f.style.display='none';var t=document.querySelector(nx);if(t){t.hidden=false;t.scrollIntoView({behavior:'smooth',block:'start'});}}else{location.href=nx;}})
    .catch(function(){go.disabled=false;go.textContent='Send me the first key';if(err)err.style.display='block';});
  });
})();
