// Minimal Vitest type stubs to allow TypeScript checking in offline environments.
type VitestCallable = (...args: unknown[]) => unknown;
type VitestExpectation = VitestCallable & Record<string, VitestExpectation>;

declare module 'vitest' {
  export const describe: VitestCallable;
  export const it: VitestCallable;
  export const test: VitestCallable;
  export const expect: VitestExpectation;
  export const beforeAll: VitestCallable;
  export const beforeEach: VitestCallable;
  export const afterAll: VitestCallable;
  export const afterEach: VitestCallable;
  export const vi: Record<string, VitestCallable> & VitestCallable;
}

declare module 'vitest/globals' {
  export * from 'vitest';
}

declare global {
  // Provide the global testing APIs with loose types to prevent type errors where
  // Vitest globals are referenced without explicit imports.
  const describe: VitestCallable;
  const it: VitestCallable;
  const test: VitestCallable;
  const expect: VitestExpectation;
  const beforeAll: VitestCallable;
  const beforeEach: VitestCallable;
  const afterAll: VitestCallable;
  const afterEach: VitestCallable;
  const vi: Record<string, VitestCallable> & VitestCallable;
}
