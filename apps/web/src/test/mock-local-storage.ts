export interface MockLocalStorageController {
  store: Map<string, string>;
  reset: (keys?: string[]) => void;
  restore: () => void;
}

export function installMockLocalStorage(): MockLocalStorageController {
  const originalLocalStorage = window.localStorage;
  const store = new Map<string, string>();

  const localStorageMock = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      if (index < 0 || index >= store.size) {
        return null;
      }
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  } satisfies Storage;

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: localStorageMock,
  });

  return {
    store,
    reset: (keys?: string[]) => {
      if (!keys || keys.length === 0) {
        store.clear();
        return;
      }
      for (const key of keys) {
        store.delete(key);
      }
    },
    restore: () => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    },
  };
}
