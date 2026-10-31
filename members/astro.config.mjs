// Vault Human members' app. Server-rendered on Cloudflare Workers, data in D1.
// Self-contained: nothing here touches the public site at the repo root.
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  // Forms post back to the same origin; Astro rejects cross-site form posts.
  security: { checkOrigin: true },
  devToolbar: { enabled: false },
});
