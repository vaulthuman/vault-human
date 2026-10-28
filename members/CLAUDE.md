# House rules for the members' app

Read these before changing anything in this repo.

## Scope
- Work only inside `/members`. The public site (everything outside `/members`) must not change: never edit the
  root `package.json`, `astro.config.mjs`, `src/`, `public/` or any other existing file outside this folder.
  Cloudflare Pages builds the public site from `main`, and branch builds must keep passing.
- `/members` stays self-contained: its own `package.json` and lockfile, no imports from the root site.
- Work on a branch and open a draft pull request. Never merge.

## Data, money and email
- Test data only. Seeds use `@example.com` addresses.
- Stripe TEST mode only. The code refuses keys that are not `sk_test_` / `rk_test_` and live-mode events; keep it that way.
- Never send email to anyone. In development, print sign-in links to the console (`DEV_LOG_LINKS=1`).
- The repo is public: commit no secrets. Real values live in `.dev.vars` (git-ignored) or `wrangler secret put`.
  `.dev.vars.example` holds placeholder names only.

## Look
- Match https://www.vaulthuman.com/key/b003/: background #141A16, ink #F1EDE4, gold #C9A24A, green #8FA67E,
  Bebas Neue titles, Inter body, mobile first.

## Words
- Call them videos, never films.
- No pull quotes.
- Timeless wording: never "Day 3", "this week" or anything that dates a page.
- Write every vaulthuman.com URL with www (https://www.vaulthuman.com/...).

## Proof
- `npm test`, `npm run check` and `npm run build` pass before every push.
- Changes to the streak or the webhook come with tests.
- For visible changes, re-run `scripts/screenshots.cjs` at phone width and commit the screenshots to `docs/screenshots/`.
- Key content lives in `src/data/keys.json` only.
