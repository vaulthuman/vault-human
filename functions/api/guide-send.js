// Vault Guide — "Send this to Russ" (opt-in only). The only place anything is stored.
// Creates/updates the HubSpot contact through the site's existing form (same pipeline as /start),
// with a 3-line summary as the message, so the existing sign-up alert + LEAD NOW + Lead watch see it.
// Preview: does nothing unless env.GUIDE_LIVE === '1' (Russ's yes on decision 1).
const PORTAL = '246947446';
const FORM = '3f225ab5-5a70-46d9-a497-29e6256b1e52';
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const clip = (s, n) => String(s || '').replace(/[\r\n]+/g, ' ').trim().slice(0, n);

export function summary(b) {
  return [
    `[Vault Guide] Topic: ${clip(b.answers?.topic, 40)} · Wants different: ${clip(b.answers?.different, 80)} · In the way: ${clip(b.answers?.inway, 80)}`,
    `Their words: "${clip(b.text, 220)}"`,
    `Key shown: ${clip(b.key, 80)} · Offer: ${b.offer === 'week' ? 'free week' : 'free 15-min call'}${b.textOk ? ' · OK to text' : ''}`,
  ].join('\n');
}

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ ok: false }, 400); }
  const email = clip(b.email, 120), name = clip(b.name, 80);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) return json({ ok: false, error: 'name and email needed' }, 400);
  if (env.GUIDE_LIVE !== '1') return json({ ok: true, dryRun: true, would: summary(b) });
  const [first, ...rest] = name.split(/\s+/);
  const fields = [{ name: 'firstname', value: first }, { name: 'lastname', value: rest.join(' ') }, { name: 'email', value: email }, { name: 'message', value: summary(b) }];
  if (b.phone && b.textOk) fields.push({ name: 'phone', value: clip(b.phone, 30) });
  const r = await fetch(`https://api-na2.hsforms.com/submissions/v3/integration/submit/${PORTAL}/${FORM}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fields, context: { pageUri: 'https://www.vaulthuman.com/guide/', pageName: 'Vault Guide' } }),
  });
  try { if (env.GUIDE_COUNTS) { const k = `${new Date().toISOString().slice(0, 10)}:sent`; await env.GUIDE_COUNTS.put(k, String(Number(await env.GUIDE_COUNTS.get(k) || 0) + 1)); } } catch {}
  return json({ ok: r.ok });
}
