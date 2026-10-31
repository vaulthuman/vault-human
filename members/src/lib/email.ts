// Sign-in links by email, sent through Resend (https://resend.com). Only when RESEND_API_KEY is set;
// without it, development prints the link to the console (DEV_LOG_LINKS=1) and nothing is sent.

export const FROM = 'Vault Human <keys@vaulthuman.com>';
export const SUBJECT = 'Your Vault Human sign-in link';
export const RESEND_URL = 'https://api.resend.com/emails';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function signInEmail(link: string) {
  const text = [
    'Here is your sign-in link for Vault Human:',
    '',
    link,
    '',
    'It works once, for 15 minutes. If you didn’t ask for it, you can ignore this email.',
    '',
    'Vault Human · https://www.vaulthuman.com/',
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#141A16;padding:32px 20px;font:16px/1.55 Inter,Arial,sans-serif;color:#F1EDE4">
<div style="max-width:480px;margin:0 auto">
<p style="font:700 12px/1 Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#C9A24A;margin:0 0 14px">Vault Human</p>
<p style="margin:0 0 20px;color:#CFC9BC">Here is your sign-in link.</p>
<p style="margin:0 0 24px"><a href="${esc(link)}" style="display:inline-block;background:#C9A24A;color:#15190f;font-weight:700;padding:14px 22px;border-radius:8px;text-decoration:none">Sign in</a></p>
<p style="margin:0 0 8px;font-size:14px;color:#8E9A90">It works once, for 15 minutes. If you didn’t ask for it, you can ignore this email.</p>
<p style="margin:0;font-size:14px;color:#8E9A90"><a href="https://www.vaulthuman.com/" style="color:#8E9A90">www.vaulthuman.com</a></p>
</div></body></html>`;
  return { text, html };
}

export type Delivery = 'sent' | 'failed' | 'logged' | 'not-configured';

export async function deliverSignInLink(
  env: { RESEND_API_KEY?: string; DEV_LOG_LINKS?: string },
  to: string,
  link: string,
  deps: { fetch?: typeof fetch; log?: (...a: unknown[]) => void } = {},
): Promise<Delivery> {
  const log = deps.log ?? console.log;
  if (!env.RESEND_API_KEY) {
    if (env.DEV_LOG_LINKS === '1') {
      log(`\n[sign-in link for ${to}]\n${link}\n`);
      return 'logged';
    }
    log('[sign-in] link requested; RESEND_API_KEY is not set, nothing sent');
    return 'not-configured';
  }
  const res = await (deps.fetch ?? fetch)(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject: SUBJECT, ...signInEmail(link) }),
  }).catch((e: Error) => ({ ok: false, status: 0, text: async () => e.message }) as Response);
  if (res.ok) return 'sent';
  // Never log the link itself outside development: it signs someone in.
  log(`[sign-in] Resend refused the email (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return 'failed';
}
