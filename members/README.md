# Vault Human members' app (v1)

The members' app for members.vaulthuman.com: sign in, today's Key, the Keys received so far,
progress, and membership. Astro (server output) on Cloudflare Workers, data in Cloudflare D1.

This folder is self-contained. It has its own `package.json` and lockfile, and nothing in it is
imported by, or imports from, the public site at the repo root. The public site's Cloudflare
Pages build from `main` does not read this folder.

## What was built

| Page | Path | What it does |
| --- | --- | --- |
| Sign in | `/signin` | Email field, "Send me a sign-in link". Passwordless: a signed link that expires after 15 minutes and works once. Same answer for any address, member or not. |
| Today | `/today` | Greets the member by first name ("Good evening, Russ.", in their time zone) and shows where they are: chamber (or the Integration pause) and Key number (their 1st, 2nd, ... Key, with its id). Then the current Key: eyebrow "Key", title, the video, the paragraphs, the gold step box with 3 numbered steps, and a one-line box "What I did, and what it did." Save shows "Logged." and the streak. Saving again the same day replaces that day's line. |
| My keys | `/keys` | Keys received so far, newest first, each with its line if one was logged. Tapping an older Key opens it at `/keys/<id>`. |
| Progress | `/progress` | Streak (days in a row with a logged line), chamber (1 to 11, plus the Integration pause in month six), keys turned (Keys with at least one logged line). |
| Downloads | `/downloads` | Member files: the guide (a placeholder PDF for now) and the B003 video. Private: see "Downloads and file storage" below. |
| Membership | `/membership` | One button to the Stripe Customer Portal (test mode only). Stubbed with a plain message when no test key is set. Sign out. |
| Stripe webhook | `/api/stripe/webhook` | Verifies the `Stripe-Signature` header (HMAC-SHA256, 5-minute tolerance), refuses live-mode events, handles each event id once. |

Access rules (in `src/lib/stripe.ts`):

- `invoice.paid` opens access when the invoice belongs to a subscription whose status in Stripe is `active`.
  The member is found by Stripe customer id, then by email; a new member is created if neither matches
  (their first day is the day of that payment).
- `customer.subscription.deleted` closes access.
- `customer.subscription.updated` closes access when the status is `unpaid` or `canceled`; other statuses are recorded only.
- A signed-in member without access can still reach Membership (to fix billing), but not Today, My keys or Progress.

## Downloads and file storage

Files live in a private Cloudflare R2 bucket, `vault-human-member-files`, bound to the Worker as `FILES`.
The bucket has no public URL and no public domain.

- The list of files is `src/data/downloads.json`: id, title, line of text, type, R2 object key, download filename, content type.
- `/downloads` shows each file with its size (read from R2), or "Coming soon" if it isn't uploaded yet.
- Each Download button is a link signed for that member and that file, valid for 10 minutes:
  `/files/<id>?x=<expiry>&s=<HMAC of file id, member id and expiry>`.
- `/files/<id>` (a Worker route, `src/pages/files/[id].ts` → `serveFile` in `src/lib/files.ts`) serves the file only when
  all of these hold: signed in, membership active, signature valid for *this* member and *this* file, not expired.
  A link copied to someone else fails (their session is a different member, or they have none).
  Responses are `private, no-store`, `noindex`, sent as attachments, and support byte ranges (206/416) so videos can seek.
- Locally, Wrangler's on-disk R2 stands in for the bucket (the "stub"): `npm run files:seed:local` puts the placeholder
  guide (`storage-seed/vault-human-member-guide.pdf`, made by `scripts/make-placeholder-pdf.mjs`) and the B003 video
  (read from the public site's `public/video/`, unchanged) into it. If no bucket is bound at all, Downloads shows
  "Coming soon" and `/files/...` answers 503.

To add a file: add an entry to `downloads.json`, then upload the object to R2 under the same key
(`npx wrangler r2 object put vault-human-member-files/<key> --remote --file=<path> --content-type=<type>`).

Other details:

- Key content lives in one file, `src/data/keys.json` (B001, M001, H001, B002, B003, copied from
  `src/pages/key/*.astro` at the repo root). Videos and posters load from https://www.vaulthuman.com/.
- Schedule: one Key a day in `keys.json` order from the member's first day. When the list runs out, the last Key stays on Today.
- Days are counted in the member's time zone, taken from their browser when they save a line (default America/Chicago).
- Session: an HttpOnly, Secure, SameSite=Lax cookie holding a signed token, valid 30 days.
- Form posts from another origin are refused (403).

## What is stubbed

- **Email.** No email is ever sent. With `DEV_LOG_LINKS=1` the sign-in link is printed to the server
  console. Without it, the app logs that a link was requested and sends nothing. So in production, no
  member can sign in until an email sender is added (see decisions below).
- **Customer Portal.** Without a `sk_test_`/`rk_test_` key the button shows "The membership portal isn't
  connected yet." Live keys (`sk_live_`) are refused on purpose in v1.
- **invoice.paid without a key.** Opening access needs the subscription status from Stripe, so with no
  test key the webhook records the event but opens nothing.
- **File storage.** Locally, Wrangler's on-disk R2 holds the files (`npm run files:seed:local`). The real bucket is
  created at deploy time. The guide is a one-page placeholder PDF.
- **Content.** Five sample Keys only. No guide, tracker or coach features yet.

## Run it locally

Needs Node 22.

```bash
cd members
npm install
cp .dev.vars.example .dev.vars        # then put a long random string in SESSION_SECRET
npm run db:migrate:local              # creates the local D1 database in .wrangler/
npm run db:seed:local                 # test member: test@example.com, all five Keys received
npm run files:seed:local              # placeholder guide + B003 video into the local R2 bucket
npm run dev                           # http://localhost:4321
```

Sign in with `test@example.com`; the sign-in link appears in the terminal running `npm run dev`.

Checks:

```bash
npm test          # streak, chamber, schedule, greeting, tokens, signed file links, webhook (56 tests)
npm run check     # TypeScript and Astro diagnostics
npm run build     # production Worker bundle in dist/
```

Screenshots: with the dev server writing to a log (`npm run dev > dev.log 2>&1 &`) and a fresh seed,
`DEV_LOG=dev.log node scripts/screenshots.cjs` signs in as the test member, saves a line, checks
"Logged. Streak: 1 day in a row", and saves phone-width (390px) screenshots of every page to
`docs/screenshots/`. It also checks the greeting line and downloads the guide through a signed link. Add `LOCAL_SITE=1` if the machine can't reach www.vaulthuman.com; it then serves
the videos and posters from the repo's `public/` folder (read only).

### Webhook, locally, with the Stripe CLI (test mode)

```bash
stripe login                                         # a test-mode account
stripe listen --forward-to localhost:4321/api/stripe/webhook
```

Put the `whsec_...` it prints into `.dev.vars` as `STRIPE_WEBHOOK_SECRET`, a test secret key into
`STRIPE_SECRET_KEY`, restart `npm run dev`, then `stripe trigger invoice.paid`.

## Deploy to Cloudflare Workers and D1

Nothing here has been deployed. These are the steps, run from `members/` on a machine logged into the
Vault Human Cloudflare account.

1. Log in: `npx wrangler login`
2. Create the database: `npx wrangler d1 create vault-human-members`.
   Copy the `database_id` it prints into `wrangler.jsonc` (replacing the zeros) and commit that change.
   The id is not a secret.
3. Create the tables: `npm run db:migrate:remote`
   and the file bucket: `npx wrangler r2 bucket create vault-human-member-files` (leave public access off),
   then upload the files listed in `src/data/downloads.json` (see "Downloads and file storage").
4. Set the secrets (each command prompts for the value; nothing goes in git):
   ```bash
   npx wrangler secret put SESSION_SECRET          # long random string, e.g. `openssl rand -hex 32`
   npx wrangler secret put STRIPE_SECRET_KEY       # sk_test_... (test mode)
   npx wrangler secret put STRIPE_WEBHOOK_SECRET   # whsec_... from step 7
   ```
   Do not set `DEV_LOG_LINKS` in production.
5. Deploy: `npm run deploy` (builds, then `wrangler deploy`). Wrangler prints a `*.workers.dev` URL.
6. Custom domain: Cloudflare dashboard → Workers & Pages → vault-human-members → Settings →
   Domains & Routes → Add → Custom domain → `members.vaulthuman.com`. `APP_URL` in `wrangler.jsonc`
   already points there.
7. Stripe (test mode) → Developers → Webhooks → Add endpoint
   `https://members.vaulthuman.com/api/stripe/webhook`, events `invoice.paid`,
   `customer.subscription.updated`, `customer.subscription.deleted`. Put its signing secret in step 4.
8. Stripe (test mode) → Settings → Billing → Customer portal: turn it on and choose what members may change.
   Stripe sends the customer's name with the invoice; the app uses its first word to greet new members.
9. Do not run `db:seed:local` against the remote database; the seed is test data.

Before real members: an email sender (below), and Stripe live mode, which v1 deliberately refuses.

## What Russ must decide

1. **Email sender for sign-in links.** Which service sends them (Cloudflare Email Routing/Workers email,
   Postmark, Resend, or the Google Apps Script already used for Keys) and the from-address. Until then
   no one can sign in on the live site.
2. **Key schedule.** v1 gives one Key a day in file order. Is it daily? Does the mind, body and heart
   order follow the chambers? What happens when the list runs out?
3. **Which Keys go in `keys.json`,** and who adds new ones (by hand, or generated like `src/data/keys.js`).
4. **Step box label.** The source pages use "Today's step" for B001 and M001 and "Tonight's step" for
   the rest; v1 copies each page. One label for all?
5. **Streak rule.** v1 keeps a streak alive until the end of today if yesterday was logged. Should a missed
   day ever be forgiven?
6. **Time zone.** v1 takes it from the member's browser, defaulting to America/Chicago.
7. **Who gets access.** Only `active` subscriptions open access. Should `trialing` count? Should
   `past_due` close access straight away (v1 keeps it open until `unpaid` or `canceled`)?
8. **Membership start.** The chamber counts from the member's first payment. Is that the right day one?
   What happens after month twelve (v1 stays on Chamber 11)?
9. **Going live with Stripe:** when, and the live product and portal settings.
10. **Downloads:** the real guide PDF, which other files members get, and whether a file should only appear once
    the member has received that Key (v1 shows every file to every active member).
11. **Member login link on the public site:** when to switch it on (see below), and whether the Key pages should
    keep the phone number next to it.

## "Member login" link for the public site (ready to apply, hidden)

This PR does not touch the public site. When you're ready, apply the patch below from the repo root. It adds one
component and puts it in the top-right of the header on every page that has the site header (the home page,
`Base.astro`, the other `header.site` pages, and the `/key/*` pages):

```bash
git apply members/docs/member-login-link.patch
```

It ships **hidden**: while `LIVE` is `false` the component renders nothing, and the built site is byte-for-byte the
same as before (checked: all 454 pages identical). To go live, change one line in
`src/components/MemberLogin.astro`:

```diff
-const LIVE = false;
+const LIVE = true;
```

The component it adds, `src/components/MemberLogin.astro`:

```astro
---
// "Member login" in the top-right of the public site header, pointing to the members' app.
// Hidden until the members' app goes live: while LIVE is false this renders nothing at all,
// so the built pages are byte-for-byte what they were. Flip LIVE to true to show it everywhere.
const LIVE = false;
---
{LIVE && (
  <>
    <a class="member-login" href="https://members.vaulthuman.com/">Member login</a>
    <style is:inline>
      .member-login{flex:none;display:inline-block;margin-left:14px;padding:8px 14px;border:1px solid rgba(201,162,74,.75);border-radius:999px;color:#F1EDE4 !important;font:600 14px/1 Inter,system-ui,sans-serif;text-decoration:none;white-space:nowrap}
      .member-login:hover,.member-login:focus-visible{background:#C9A24A;color:#15190f !important;outline:none}
      header.site .navlinks{margin-left:auto}
      .top .member-login{margin-left:auto;margin-right:16px;align-self:center}
      @media (max-width:1120px){header.site .member-login{margin-left:auto;margin-right:10px}}
      @media (max-width:480px){.top{flex-wrap:wrap}.top .brand,.top .tel{white-space:nowrap}.top .member-login{order:3;margin:12px 0 0 auto}}
    </style>
  </>
)}
```

and in each header (the patch does all 23 files, including the import line):

```astro
---
import MemberLogin from '../components/MemberLogin.astro';   // path relative to the page
---
<!-- pages with <header class="site">: just before the menu button -->
<MemberLogin /><button class="navtoggle" ...>

<!-- /key/* pages with <header class="top">: just before the phone number, on the same line -->
<MemberLogin /><a class="tel" href="tel:+18888332510">(888) 833-2510</a>
```

Preview with `LIVE = true` (phone and desktop) is in `docs/screenshots/public-site-preview/`.

