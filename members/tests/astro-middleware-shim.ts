// Test stand-in for Astro's virtual module, so the real middleware can run under Vitest.
export const defineMiddleware = <T>(fn: T) => fn;
