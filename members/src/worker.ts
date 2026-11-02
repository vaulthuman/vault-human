// The Worker's entry: Astro serves every page, and an hourly cron sends each member's reminder
// at 8 a.m. and 8 p.m. in their own time zone (see src/lib/reminders.ts).
import type { SSRManifest } from 'astro';
import { App } from 'astro/app';
import { handle } from '@astrojs/cloudflare/handler';
import { sendDue } from './lib/reminders';

// The two Workers types we use, declared here so no extra type package is needed.
type Ctx = { waitUntil(p: Promise<unknown>): void; passThroughOnException(): void };
type Scheduled = { cron: string; scheduledTime: number };

export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);
  return {
    default: {
      async fetch(request: Request, env: Env, ctx: Ctx) {
        return handle(manifest, app, request as any, env as any, ctx as any);
      },
      async scheduled(_event: Scheduled, env: Env, ctx: Ctx) {
        if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_JWK) return; // reminders not switched on yet
        ctx.waitUntil(sendDue(env.DB, env).then((r) => console.log('[reminders]', r)));
      },
    },
  };
}
