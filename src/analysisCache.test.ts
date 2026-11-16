import { describe, expect, it } from "vitest";
import type { Review, ReviewAnalysis } from "../shared/types";
import { cacheKey, hashText, readCached, writeCached } from "./analysisCache";

const review = (text: string): Review => ({ rating: 4, text, author: "A", when: "1 week ago" });

const analysis: ReviewAnalysis = {
  verdict: "Good",
  pros: [],
  cons: [],
  mustOrder: [],
  redFlags: [],
  sentiment: 0.8,
  trend: "steady",
  model: "m",
  mock: true,
};

function memoryStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("analysisCache", () => {
  it("hash is stable and sensitive to content", () => {
    expect(hashText("abc")).toBe(hashText("abc"));
    expect(hashText("abc")).not.toBe(hashText("abd"));
  });

  it("key changes with model and review text", () => {
    const base = cacheKey("p1", "m1", [review("tasty")]);
    expect(cacheKey("p1", "m1", [review("tasty")])).toBe(base);
    expect(cacheKey("p1", "m2", [review("tasty")])).not.toBe(base);
    expect(cacheKey("p1", "m1", [review("bland")])).not.toBe(base);
    expect(cacheKey("p1", "m1", [review("ta"), review("sty")])).not.toBe(cacheKey("p1", "m1", [review("tasty")]));
  });

  it("round-trips and tolerates missing or broken storage", () => {
    const store = memoryStore();
    writeCached("k", analysis, store);
    expect(readCached("k", store)).toEqual(analysis);
    expect(readCached("missing", store)).toBeNull();
    store.setItem("bad", "{not json");
    expect(readCached("bad", store)).toBeNull();
    expect(readCached("k", null)).toBeNull();
    const throwing = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("quota"); } };
    expect(() => writeCached("k", analysis, throwing)).not.toThrow();
    expect(readCached("k", throwing)).toBeNull();
  });
});
