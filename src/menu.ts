import type { MenuItem } from "../shared/types";

export const MENU_PREVIEW = 8;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** True when a menu item is one the review summary said to order ("Chicken Biryani (Full)" ~ "chicken biryani"). */
export function isMustOrder(item: string, mustOrder: string[]): boolean {
  const a = norm(item);
  if (!a) return false;
  return mustOrder.some((m) => {
    const b = norm(m);
    return b !== "" && (a.includes(b) || b.includes(a));
  });
}

/** First `limit` items grouped by section, sections in order of first appearance. */
export function groupMenu(items: MenuItem[], limit = MENU_PREVIEW): { section?: string; items: MenuItem[] }[] {
  const groups = new Map<string, { section?: string; items: MenuItem[] }>();
  for (const item of items.slice(0, limit)) {
    const k = item.section ?? "";
    if (!groups.has(k)) groups.set(k, { section: item.section, items: [] });
    groups.get(k)!.items.push(item);
  }
  return [...groups.values()];
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
