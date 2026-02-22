import "@testing-library/jest-dom/vitest";

// Provide a working in-memory localStorage for all tests. The jsdom
// environment may receive a --localstorage-file flag with an invalid path
// from the outer shell, which makes jsdom's localStorage non-functional.
// Overriding it here ensures zustand's persist middleware can always write.
const localStorageStore: Record<string, string> = {};
const inMemoryLocalStorage = {
  getItem: (key: string): string | null => localStorageStore[key] ?? null,
  setItem: (key: string, value: string): void => { localStorageStore[key] = value; },
  removeItem: (key: string): void => { delete localStorageStore[key]; },
  clear: (): void => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]); },
  get length(): number { return Object.keys(localStorageStore).length; },
  key: (index: number): string | null => Object.keys(localStorageStore)[index] ?? null,
};
Object.defineProperty(globalThis, 'localStorage', {
  value: inMemoryLocalStorage,
  writable: true,
  configurable: true,
});
