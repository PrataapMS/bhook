// Menus come from restaurants' own sites or public web pages (not Google), so we may cache
// them (spec 06). Netlify Blobs, keyed by place ID. Best-effort: a cache failure never fails a lookup.
import { getStore } from "@netlify/blobs";
import type { MenuResult } from "../shared/types";

const DAY_MS = 24 * 60 * 60 * 1000;
export const TTL_FOUND_MS = 14 * DAY_MS;
/** Shorter, so a restaurant that publishes a menu later gets picked up. */
export const TTL_NOT_FOUND_MS = 3 * DAY_MS;

interface Entry {
  result: MenuResult;
  expiresAt: number;
}

const key = (placeId: string) => placeId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 200);

function store() {
  return getStore("menus");
}

export async function readMenu(placeId: string, now = Date.now()): Promise<MenuResult | null> {
  try {
    const entry = (await store().get(key(placeId), { type: "json" })) as Entry | null;
    return entry && entry.expiresAt > now ? { ...entry.result, cached: true } : null;
  } catch (err) {
    console.warn("menu cache read skipped:", (err as Error).message);
    return null;
  }
}

/**
 * Cache what's worth not paying for twice: any web-search answer (the costly step), and website
 * hits. A website miss isn't cached because the client follows it with a web search anyway.
 */
export function shouldCache(result: MenuResult): boolean {
  return !result.mock && (result.method === "web_search" || result.status !== "not_found");
}

export async function writeMenu(placeId: string, result: MenuResult, now = Date.now()): Promise<void> {
  if (!shouldCache(result)) return;
  const ttl = result.status === "not_found" ? TTL_NOT_FOUND_MS : TTL_FOUND_MS;
  try {
    await store().setJSON(key(placeId), { result: { ...result, cached: false }, expiresAt: now + ttl } satisfies Entry);
  } catch (err) {
    console.warn("menu cache write skipped:", (err as Error).message);
  }
}
