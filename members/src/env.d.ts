/// <reference types="astro/client" />

type Env = {
  DB: import('./lib/db').Db;
  FILES?: import('./lib/files').Bucket;
  SESSION_SECRET: string;
  APP_URL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  DEV_LOG_LINKS?: string;
  RESEND_API_KEY?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_JWK?: string;
  PUSH_SEND_SECRET?: string;
};

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    member: import('./lib/db').Member | null;
  }
}
