/**
 * Build-time flags exposed as functions so tests can mock them with vi.fn()
 * without patching import.meta.env at runtime (which vitest compiles to a
 * constant and does not allow property reassignment).
 */

/** Returns true in production builds (`vite build`); false in dev and vitest. */
export function isProduction(): boolean {
  return import.meta.env.PROD;
}
