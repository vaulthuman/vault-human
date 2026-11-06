// Meta Pixel for vaulthuman.com, injected into every HTML page at the edge.
// Pixel (dataset) 1451128073016687 in the Vault Human business portfolio.
const PIXEL = '1451128073016687';
const SNIPPET = `<!-- Meta Pixel -->
<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${PIXEL}');fbq('track','PageView');
if(/^\\/thanks\\/?$/.test(location.pathname))fbq('track','Lead');
window.addEventListener('message',function(e){if(e.data&&e.data.event==='calendly.event_scheduled'&&!window.__vhSched){window.__vhSched=1;fbq('track','Schedule');}});
</script>
<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${PIXEL}&ev=PageView&noscript=1"/></noscript>`;

export async function onRequest(context) {
  const res = await context.next();
  const type = res.headers.get('content-type') || '';
  if (!type.includes('text/html')) return res;
  return new HTMLRewriter()
    .on('head', { element(el) { el.append(SNIPPET, { html: true }); } })
    .transform(res);
}
