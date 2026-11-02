import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: { alias: { 'astro:middleware': fileURLToPath(new URL('./tests/astro-middleware-shim.ts', import.meta.url)) } },
  test: { include: ['tests/**/*.test.ts'] },
});
