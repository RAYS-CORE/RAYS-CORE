import "@testing-library/jest-dom";

class MockStorage implements Storage {
  [name: string]: any;
  get length() {
    return Object.keys(this).filter(
      (k) => !["length", "clear", "getItem", "key", "removeItem", "setItem"].includes(k)
    ).length;
  }
  clear() {
    for (const k of Object.keys(this)) {
      if (!["length", "clear", "getItem", "key", "removeItem", "setItem"].includes(k)) {
        delete this[k];
      }
    }
  }
  getItem(key: string) {
    return this[key] !== undefined ? String(this[key]) : null;
  }
  key(index: number) {
    const keys = Object.keys(this).filter(
      (k) => !["length", "clear", "getItem", "key", "removeItem", "setItem"].includes(k)
    );
    return keys[index] ?? null;
  }
  removeItem(key: string) {
    delete this[key];
  }
  setItem(key: string, value: string) {
    this[key] = String(value);
  }
}

const mockLocal = new MockStorage();
const mockSession = new MockStorage();

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocal,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, "sessionStorage", {
  value: mockSession,
  configurable: true,
  writable: true,
});
if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: mockLocal,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, "sessionStorage", {
    value: mockSession,
    configurable: true,
    writable: true,
  });
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
