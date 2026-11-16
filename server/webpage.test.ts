import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) => {
    if (host === "internal.example") return [{ address: "10.1.2.3", family: 4 }];
    if (host === "nowhere.example") throw new Error("ENOTFOUND");
    return [{ address: "93.184.216.34", family: 4 }];
  }),
}));

const { PageError, assertPublicUrl, fetchPage, findMenuLinks, htmlToText, isPublicAddress, looksLikeMenu } = await import("./webpage");

afterEach(() => vi.unstubAllGlobals());

describe("isPublicAddress", () => {
  it.each(["127.0.0.1", "10.0.0.5", "172.20.1.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:a9fe:a9fe", "not-an-ip"])(
    "blocks %s",
    (ip) => expect(isPublicAddress(ip)).toBe(false),
  );
  it.each(["93.184.216.34", "8.8.8.8", "2606:4700::1111"])("allows %s", (ip) => expect(isPublicAddress(ip)).toBe(true));
});

describe("assertPublicUrl", () => {
  it.each([
    "ftp://example.com",
    "http://user:pw@example.com",
    "http://example.com:8080/",
    "http://localhost/",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://internal.example/",
    "http://nowhere.example/",
    "not a url",
  ])("rejects %s", async (u) => {
    await expect(assertPublicUrl(u)).rejects.toBeInstanceOf(PageError);
  });
  it("accepts a public https site", async () => {
    await expect(assertPublicUrl("https://restaurant.example/menu")).resolves.toBeInstanceOf(URL);
  });
});

describe("fetchPage", () => {
  it("re-validates redirect targets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } })),
    );
    await expect(fetchPage("https://restaurant.example/")).rejects.toThrow("Private host");
  });

  it("stops after too many redirects", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 301, headers: { location: "/again" } }));
    vi.stubGlobal("fetch", fetch);
    await expect(fetchPage("https://restaurant.example/")).rejects.toThrow("redirects too many times");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("rejects PDFs and returns HTML", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("%PDF", { headers: { "content-type": "application/pdf" } })));
    await expect(fetchPage("https://restaurant.example/menu.pdf")).rejects.toThrow("PDF");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<p>hi</p>", { headers: { "content-type": "text/html" } })));
    await expect(fetchPage("https://restaurant.example/")).resolves.toEqual({ url: "https://restaurant.example/", html: "<p>hi</p>" });
  });
});

describe("htmlToText", () => {
  it("keeps visible text, drops scripts and chrome, decodes entities", () => {
    const html = `<html><head><title>x</title><style>p{}</style></head><body>
      <nav>Home | About</nav><script>alert(1)</script>
      <h2>Mains</h2><table><tr><td>Paneer tikka</td><td>&#8377;280</td></tr><tr><td>Dal &amp; rice</td><td>Rs. 150</td></tr></table>
      <footer>© 2026</footer></body></html>`;
    expect(htmlToText(html)).toBe("Mains\nPaneer tikka ₹280\nDal & rice Rs. 150");
  });
});

describe("findMenuLinks", () => {
  it("ranks same-site menu links and ignores files and other sites", () => {
    const html = `
      <a href="/about">About</a>
      <a href="https://www.zomato.com/x/menu">Zomato menu</a>
      <a href="/files/menu.pdf">Menu PDF</a>
      <a href="/our-food">Our menu</a>
      <a href="https://order.restaurant.example/menu">Order online</a>`;
    expect(findMenuLinks(html, "https://www.restaurant.example/")).toEqual([
      "https://www.restaurant.example/our-food",
      "https://order.restaurant.example/menu",
    ]);
  });
});

describe("looksLikeMenu", () => {
  const filler = "Welcome to our restaurant, serving the neighbourhood since 1998. ".repeat(4);
  it("needs length and prices", () => {
    expect(looksLikeMenu("Paneer tikka ₹280\nDal ₹150\nNaan ₹40")).toBe(false);
    expect(looksLikeMenu(filler)).toBe(false);
    expect(looksLikeMenu(`${filler}\nPaneer tikka 280\nDal makhani 250\nButter naan 60`)).toBe(true);
    expect(looksLikeMenu(`${filler}\nThali Rs. 180, Biryani Rs 320, Lassi 90/-`)).toBe(true);
  });
});
