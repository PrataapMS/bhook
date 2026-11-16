import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) }));

const { areaFrom, menuFromWebSearch, menuFromWebsite, menuStatus, normaliseItems, usableWebsite, MAX_ITEMS } = await import("./menu");
const { shouldCache } = await import("./menuCache");

afterEach(() => vi.unstubAllGlobals());

const req = { placeId: "p1", name: "Andhra Spice Mess", address: "12, 5th Cross, Koramangala 4th Block, Bengaluru, Karnataka 560034, India" };

describe("helpers", () => {
  it("areaFrom drops street, state+pin and country", () => {
    expect(areaFrom(req.address)).toBe("Koramangala 4th Block, Bengaluru");
    expect(areaFrom("")).toBe("");
  });

  it("usableWebsite skips social and delivery pages", () => {
    expect(usableWebsite("https://instagram.com/x")).toBeUndefined();
    expect(usableWebsite("https://www.zomato.com/bangalore/x")).toBeUndefined();
    expect(usableWebsite("javascript:alert(1)")).toBeUndefined();
    expect(usableWebsite(undefined)).toBeUndefined();
    expect(usableWebsite("https://andhraspice.in/")).toBe("https://andhraspice.in/");
  });

  it("normaliseItems clamps, dedupes and drops bad prices", () => {
    const items = normaliseItems([
      { name: " Gongura  mutton ", price: 420.4, section: "Mains", veg: false },
      { name: "gongura mutton", price: 1 },
      { name: "Free water", price: 0, veg: "yes" },
      { name: "", price: 100 },
      "junk",
      { name: "Thali", price: null, section: null, veg: null },
    ]);
    expect(items).toEqual([
      { name: "Gongura mutton", price: 420, section: "Mains", veg: false },
      { name: "Free water", price: undefined, section: undefined, veg: undefined },
      { name: "Thali", price: undefined, section: undefined, veg: undefined },
    ]);
    expect(normaliseItems(Array.from({ length: 50 }, (_, i) => ({ name: `Dish ${i}` })))).toHaveLength(MAX_ITEMS);
    expect(normaliseItems("nope")).toEqual([]);
  });

  it("menuStatus", () => {
    const priced = Array.from({ length: 5 }, (_, i) => ({ name: `d${i}`, price: 100 }));
    expect(menuStatus(priced)).toBe("found");
    expect(menuStatus(priced.map((p) => ({ name: p.name })))).toBe("partial");
    expect(menuStatus([], "₹800 for two")).toBe("partial");
    expect(menuStatus([])).toBe("not_found");
  });
});

const html = (body: string) => new Response(body, { headers: { "content-type": "text/html" } });
const llm = (content: object, annotations: object[] = []) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content), annotations } }] }), {
    headers: { "content-type": "application/json" },
  });

const MENU_PAGE = `<h2>Mains</h2>${"<p>Welcome to Andhra Spice, family run since 1998.</p>".repeat(4)}
  <p>Gongura mutton 420</p><p>Chicken biryani 320</p><p>Veg meals 180</p><p>Curd rice 120</p><p>Pesarattu 140</p>`;

describe("menuFromWebsite", () => {
  it("follows the menu link and extracts from it", async () => {
    const fetch = vi.fn(async (url: URL | string, init?: RequestInit) => {
      const u = String(url);
      if (u.startsWith("https://openrouter.ai")) {
        const body = JSON.parse(String(init?.body));
        expect(body.messages[1].content).toContain("Gongura mutton 420");
        expect(body.plugins).toBeUndefined();
        return llm({
          items: [
            { name: "Gongura mutton", price: 420, section: "Mains", veg: false },
            { name: "Chicken biryani", price: 320, section: "Mains", veg: false },
            { name: "Veg meals", price: 180, section: "Mains", veg: true },
            { name: "Curd rice", price: 120, section: "Mains", veg: true },
            { name: "Pesarattu", price: 140, section: "Mains", veg: true },
          ],
          priceNote: "Mains ₹120–420",
        });
      }
      if (u === "https://andhraspice.in/") return html(`<a href="/menu">Menu</a>`);
      if (u === "https://andhraspice.in/menu") return html(MENU_PAGE);
      throw new Error(`unexpected ${u}`);
    });
    vi.stubGlobal("fetch", fetch);
    const r = await menuFromWebsite({ ...req, websiteUri: "https://andhraspice.in/" }, new AbortController().signal);
    expect(r.status).toBe("found");
    expect(r.items).toHaveLength(5);
    expect(r.sources).toEqual([{ url: "https://andhraspice.in/menu" }]);
    expect(r.method).toBe("website");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("returns not_found without calling the LLM when the page has no text menu", async () => {
    const fetch = vi.fn(async () => html(`<a href="/menu">Menu</a><img src="menu.jpg">`));
    vi.stubGlobal("fetch", fetch);
    const r = await menuFromWebsite({ ...req, websiteUri: "https://andhraspice.in/" }, new AbortController().signal);
    expect(r).toMatchObject({ status: "not_found", reason: "Menu is probably an image or PDF" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("treats an unreachable site as not_found, not an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const r = await menuFromWebsite({ ...req, websiteUri: "https://andhraspice.in/" }, new AbortController().signal);
    expect(r).toMatchObject({ status: "not_found", reason: "Website returned 503" });
  });

  it("skips the fetch entirely without a usable website", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const r = await menuFromWebsite({ ...req, websiteUri: "https://instagram.com/andhra" }, new AbortController().signal);
    expect(r.reason).toBe("Website is a social or delivery page");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("menuFromWebSearch", () => {
  const items = [{ name: "Gongura mutton", price: 420, section: null, veg: null }];

  it("uses only plugin citations as sources", async () => {
    const fetch = vi.fn(async (_u: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.plugins).toEqual([{ id: "web", max_results: 5 }]);
      expect(body.messages[1].content).toContain("Koramangala 4th Block, Bengaluru");
      return llm({ items, priceNote: "" }, [
        { type: "url_citation", url_citation: { url: "https://blog.example/andhra", title: "Review" } },
        { type: "url_citation", url_citation: { url: "https://blog.example/andhra" } },
      ]);
    });
    vi.stubGlobal("fetch", fetch);
    const r = await menuFromWebSearch(req, new AbortController().signal);
    expect(r).toMatchObject({ status: "partial", method: "web_search", sources: [{ url: "https://blog.example/andhra", title: "Review" }] });
  });

  it("refuses items that have no citation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => llm({ items, priceNote: "" })));
    const r = await menuFromWebSearch(req, new AbortController().signal);
    expect(r).toMatchObject({ status: "not_found", items: [], reason: "No sources found online" });
  });
});

describe("shouldCache", () => {
  const base = { items: [], sources: [], asOf: "2026-11-16", model: "m", cached: false, mock: false };
  it("caches web-search answers and website hits, not website misses or mocks", () => {
    expect(shouldCache({ ...base, status: "not_found", method: "web_search" })).toBe(true);
    expect(shouldCache({ ...base, status: "found", method: "website" })).toBe(true);
    expect(shouldCache({ ...base, status: "not_found", method: "website" })).toBe(false);
    expect(shouldCache({ ...base, status: "found", method: "web_search", mock: true })).toBe(false);
  });
});
