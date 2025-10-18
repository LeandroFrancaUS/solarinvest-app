// Minimal Vitest type stubs to allow TypeScript checking in offline environments.
type VitestFn = (...args: any[]) => any;

declare module 'vitest' {
  export const describe: VitestFn;
  export const it: VitestFn;
  export const test: VitestFn;
  export const expect: VitestFn;
  export const beforeAll: VitestFn;
  export const beforeEach: VitestFn;
  export const afterAll: VitestFn;
  export const afterEach: VitestFn;
  export const vi: Record<string, VitestFn> & VitestFn;
}

declare module 'vitest/globals' {
  export * from 'vitest';
}

declare global {
  // Provide the global testing APIs as `any` to prevent type errors where
  // Vitest globals are referenced without explicit imports.
  const describe: VitestFn;
  const it: VitestFn;
  const test: VitestFn;
  const expect: VitestFn;
  const beforeAll: VitestFn;
  const beforeEach: VitestFn;
  const afterAll: VitestFn;
  const afterEach: VitestFn;
  const vi: Record<string, VitestFn> & VitestFn;
}
