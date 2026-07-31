import { afterEach, describe, expect, it, vi } from "vitest";
import { compactImageUrl, safeGetItem, safeSetItem } from "./storage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resilient browser storage", () => {
  it("does not throw when localStorage quota is exhausted", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
        },
        removeItem: () => undefined,
      },
    });

    expect(safeSetItem("quota-test", "value")).toBe(false);
    expect(safeGetItem("quota-test")).toBe("value");
  });

  it("keeps small thumbnails but drops oversized base64 images", () => {
    expect(compactImageUrl("data:image/jpeg;base64,abc", 100)).toBe("data:image/jpeg;base64,abc");
    expect(compactImageUrl(`data:image/png;base64,${"a".repeat(200)}`, 100)).toBeUndefined();
  });
});
