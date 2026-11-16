// Fetches restaurant websites for menu extraction. The URL arrives from the client, so every
// hop is checked against private address ranges (SSRF) and size, time and redirect limits.
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

export const PAGE_TIMEOUT_MS = 5000;
export const PAGE_MAX_BYTES = 1.5 * 1024 * 1024;
export const MAX_REDIRECTS = 2;

/** The site couldn't be used (blocked, unreachable, not HTML). Becomes "not found", not a 5xx. */
export class PageError extends Error {}

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
blocked.addAddress("::", "ipv6");
blocked.addAddress("::1", "ipv6");
blocked.addSubnet("fc00::", 7, "ipv6");
blocked.addSubnet("fe80::", 10, "ipv6");

/** "::ffff:127.0.0.1" or "::ffff:7f00:1" → "127.0.0.1". Embedded IPv4 is judged by the IPv4 rules. */
function mappedV4(ip: string): string | null {
  const dotted = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (dotted) return dotted[1];
  const hex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!hex) return null;
  const [hi, lo] = [parseInt(hex[1], 16), parseInt(hex[2], 16)];
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".");
}

export function isPublicAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 0) return false;
  const v4 = v === 6 ? mappedV4(ip) : ip;
  if (v4) return !blocked.check(v4, "ipv4");
  return !blocked.check(ip, "ipv6");
}

/**
 * Rejects non-http(s), credentials, non-default ports and hosts resolving to private ranges.
 * DNS is resolved here and again by fetch, so a rebinding attacker could race it; acceptable for
 * a single-user app whose only secret-bearing neighbour is the cloud metadata range we block.
 */
export async function assertPublicUrl(raw: string | URL): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PageError("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new PageError("Only http(s) links are fetched");
  if (url.username || url.password) throw new PageError("Links with credentials are not fetched");
  if (url.port !== "") throw new PageError("Non-standard ports are not fetched");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new PageError("Private host");
  }
  const addresses = isIP(host) ? [host] : await lookup(host, { all: true }).then(
    (r) => r.map((a) => a.address),
    () => {
      throw new PageError("Website's domain doesn't resolve");
    },
  );
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) throw new PageError("Private host");
  return url;
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  const buf = new Uint8Array(Math.min(size, maxBytes));
  let offset = 0;
  for (const c of chunks) {
    const take = Math.min(c.byteLength, buf.byteLength - offset);
    buf.set(c.subarray(0, take), offset);
    offset += take;
    if (offset >= buf.byteLength) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

export interface Page {
  url: string;
  html: string;
}

/** GET an HTML page, following at most MAX_REDIRECTS, each hop re-validated. Truncates at the byte cap. */
export async function fetchPage(raw: string, signal?: AbortSignal): Promise<Page> {
  const timeout = AbortSignal.timeout(PAGE_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let url = await assertPublicUrl(raw);

  for (let hop = 0; ; hop++) {
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: combined,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; BhookMenuReader/0.1)",
          accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5",
          "accept-language": "en-IN,en;q=0.9",
        },
      });
    } catch (err) {
      // The overall deadline is the caller's to report; a slow or dead site is just "not found".
      if (signal?.aborted) throw err;
      throw new PageError(timeout.aborted ? "Website took too long to respond" : "Website couldn't be reached");
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel().catch(() => {});
      if (!location || hop >= MAX_REDIRECTS) throw new PageError("Website redirects too many times");
      url = await assertPublicUrl(new URL(location, url));
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw new PageError(`Website returned ${res.status}`);
    }
    const type = res.headers.get("content-type") ?? "";
    if (type && !/text\/html|application\/xhtml|text\/plain/i.test(type)) {
      await res.body?.cancel().catch(() => {});
      throw new PageError(/pdf/i.test(type) ? "Menu is a PDF (not supported yet)" : "Website isn't a web page");
    }
    return { url: url.toString(), html: await readCapped(res, PAGE_MAX_BYTES) };
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rupee: "₹" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Visible text of a page, one block per line. Drops scripts, styles, nav, header and footer. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template|head|nav|header|footer|iframe)\b[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|ul|ol|table|dd|dt)\s*>/gi, "\n")
      .replace(/<\/(td|th)\s*>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

const NON_PAGE = /\.(pdf|jpe?g|png|webp|gif|svg|zip|docx?)(\?|#|$)/i;

const sameSite = (a: string, b: string) => {
  const strip = (h: string) => h.replace(/^www\./, "");
  const [x, y] = [strip(a), strip(b)];
  return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`);
};

/** Same-site links that look like a menu page, best first. */
export function findMenuLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const scored = new Map<string, number>();
  for (const m of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let href: URL;
    try {
      href = new URL(decodeEntities(m[1]), base);
    } catch {
      continue;
    }
    if (href.protocol !== "http:" && href.protocol !== "https:") continue;
    if (!sameSite(href.hostname, base.hostname) || NON_PAGE.test(href.pathname)) continue;
    href.hash = "";
    if (href.toString() === base.toString()) continue;
    const text = htmlToText(m[2]).toLowerCase();
    const path = href.pathname.toLowerCase();
    const score = (path.includes("menu") ? 2 : 0) + (/\bmenu\b/.test(text) ? 2 : 0) + (/food|dishes|order/.test(path + text) ? 1 : 0);
    if (score >= 2) scored.set(href.toString(), Math.max(score, scored.get(href.toString()) ?? 0));
  }
  return [...scored.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u);
}

const PRICE_TOKEN = /(?:₹|\brs\.?|\binr)\s?\d{2,5}|\b\d{2,5}(?:\.00)?\s?\/-/gi;
const PRICED_LINE = /^[^\d\n]{3,60}?\s\d{2,4}(?:\.00)?$/gm;

/** Heuristic: enough text with enough prices that an LLM extraction is worth paying for. */
export function looksLikeMenu(text: string): boolean {
  if (text.length < 200) return false;
  const prices = (text.match(PRICE_TOKEN)?.length ?? 0) + (text.match(PRICED_LINE)?.length ?? 0);
  return prices >= 3;
}
