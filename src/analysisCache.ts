import type { Review, ReviewAnalysis } from "../shared/types";

// Session-only cache of review summaries, so going back and searching again doesn't re-pay
// the LLM. sessionStorage (not localStorage) keeps derived Google content short-lived (spec 06).

const PREFIX = "bhook:analysis:";

type KV = Pick<Storage, "getItem" | "setItem">;

/** FNV-1a 32-bit. Not cryptographic; only detects that the review set changed. */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function cacheKey(placeId: string, model: string, reviews: Review[]): string {
  return `${PREFIX}${placeId}:${model}:${hashText(reviews.map((r) => r.text).join("\u0000"))}`;
}

function session(): KV | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function readCached(key: string, store: KV | null = session()): ReviewAnalysis | null {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as ReviewAnalysis) : null;
  } catch {
    return null;
  }
}

export function writeCached(key: string, value: ReviewAnalysis, store: KV | null = session()): void {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode: caching is best-effort */
  }
}
