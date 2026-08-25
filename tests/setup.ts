import "@testing-library/jest-dom/vitest";

// Vitest 4's jsdom environment can leave `localStorage` as a non-functional
// stub (backed by a `--localstorage-file` we don't configure). Provide a simple
// in-memory implementation so browser-client code that reads `cp_token` works.
const store = new Map<string, string>();
const localStorageMock: Storage = {
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
  getItem: (key: string) => store.get(key) ?? null,
  key: (index: number) => Array.from(store.keys())[index] ?? null,
  removeItem: (key: string) => {
    store.delete(key);
  },
  setItem: (key: string, value: string) => {
    store.set(key, String(value));
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  configurable: true,
  writable: true,
});
