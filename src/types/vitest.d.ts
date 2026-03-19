// Minimal Vitest type stubs to allow TypeScript checking in offline environments.
// NOTE: The `declare module 'vitest'` block is intentionally omitted here so that
// when the real `vitest` package is installed (e.g., in CI via `npm ci`) its own
// type declarations are used without interference.  The `declare global` block
// below covers files that rely on vitest globals without an explicit import.
type VitestCallable = (...args: unknown[]) => unknown;

// Matcher type whose call signature returns itself so chains like
// `expect(x).not.toBeCloseTo(y)` remain type-safe without importing vitest.
type VitestMatcher = {
  (...args: unknown[]): VitestMatcher;
  readonly [key: string]: VitestMatcher;
};

type VitestExpect = {
  (value: unknown): VitestMatcher;
  readonly [key: string]: VitestMatcher;
};

declare global {
  // Provide the global testing APIs with loose types to prevent type errors where
  // Vitest globals are referenced without explicit imports.
  const describe: VitestCallable;
  const it: VitestCallable;
  const test: VitestCallable;
  const expect: VitestExpect;
  const beforeAll: VitestCallable;
  const beforeEach: VitestCallable;
  const afterAll: VitestCallable;
  const afterEach: VitestCallable;
  const vi: Record<string, VitestCallable> & VitestCallable;
}
