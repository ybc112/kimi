/**
 * Browser storage helpers.
 *
 * Browser storage is optional state for this app. It must never be allowed to
 * interrupt a successful on-chain transaction when a user has filled the
 * quota (large AI responses and base64 images are common causes).
 */

export interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const memoryFallback = new Map<string, string>();

/** A storage adapter that falls back to memory instead of throwing. */
export const resilientStorage: SafeStorage = {
  getItem(key) {
    if (memoryFallback.has(key)) return memoryFallback.get(key) ?? null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
      memoryFallback.delete(key);
    } catch {
      // Quota/security errors are intentionally swallowed. The in-memory copy
      // keeps the current SPA session usable.
      memoryFallback.set(key, value);
    }
  },
  removeItem(key) {
    memoryFallback.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore unavailable storage.
    }
  },
};

export function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  return resilientStorage.getItem(key);
}

export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    memoryFallback.delete(key);
    return true;
  } catch {
    memoryFallback.set(key, value);
    return false;
  }
}

export function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") return;
  resilientStorage.removeItem(key);
}

export function safeReadJson<T>(key: string, fallback: T): T {
  const raw = safeGetItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeWriteJson<T>(key: string, value: T): boolean {
  try {
    return safeSetItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

/**
 * Keep remote image URLs and small thumbnails, but never persist a huge AI
 * response in localStorage. The full image can still be used in React state
 * for the current page.
 */
export function compactImageUrl(value: string | undefined, maxLength = 48_000): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("data:") && value.length > maxLength) return undefined;
  if (value.length > 4_096 && !value.startsWith("data:")) return undefined;
  return value;
}

export function isQuotaError(error: unknown): boolean {
  if (!error) return false;
  const name = typeof error === "object" && error !== null && "name" in error
    ? String((error as { name?: unknown }).name)
    : "";
  const message = error instanceof Error ? error.message : String(error);
  return /quota|exceeded|storage/i.test(`${name} ${message}`);
}
