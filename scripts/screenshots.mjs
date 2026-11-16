// Regenerates the README images in docs/assets from the running app in demo mode.
//
//   USE_MOCKS=true npm run dev            # terminal 1
//   npm i --no-save puppeteer-core        # once
//   node scripts/screenshots.mjs          # terminal 2
//
// Set CHROME_PATH if Chrome isn't at the default macOS location.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:8888";
const OUT = resolve("docs/assets");
const executablePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

const health = await (await fetch(`${BASE}/api/health`)).json();
if (health.google !== "mock" || health.openrouter !== "mock") {
  throw new Error("Run the app with USE_MOCKS=true so screenshots never contain real Google content.");
}

const clickText = (t) =>
  page.evaluate((t) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === t)?.click(), t);

await page.goto(BASE, { waitUntil: "networkidle0" });
await page.type('input[placeholder="Indiranagar, Bengaluru"]', "Indiranagar, Bengaluru");
await page.evaluate(() => document.activeElement.blur());
await page.screenshot({ path: `${OUT}/screen-home.png` });

await clickText("Find places");
await page.waitForSelector(".list");
await page.waitForFunction(() => !document.body.innerText.includes("Reading the reviews"), { timeout: 20000 });
await pause(500);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: `${OUT}/screen-results.png` });

await clickText("Menu and prices");
await page.waitForSelector(".menu__items", { timeout: 20000 });
await page.evaluate(() => document.querySelector(".menu")?.scrollIntoView({ block: "center" }));
await pause(300);
await page.screenshot({ path: `${OUT}/screen-menu.png` });

// Composite images: README hero (1600x760) and GitHub social preview (1280x640).
const icon = readFileSync("public/icons/icon.svg", "utf8");
const img = (name) => `data:image/png;base64,${readFileSync(`${OUT}/screen-${name}.png`).toString("base64")}`;
const composite = (w, h, third) => `<!doctype html><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.s{width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;gap:48px;box-sizing:border-box;padding:40px;
background:linear-gradient(135deg,#1F2A5A 0%,#2c3a78 55%,#F6C9D3 140%)}
.b{color:#fff;max-width:380px}.b svg{width:96px;height:96px;border-radius:22px}
.b h1{font-size:64px;margin:16px 0 8px;letter-spacing:-1px}.b p{font-size:24px;line-height:1.35;color:#dfe4f5;margin:0}
.p{width:280px;border-radius:36px;padding:10px;background:#0d1330;box-shadow:0 24px 60px rgba(0,0,0,.35)}
.p img{width:100%;display:block;border-radius:28px}.m{transform:translateY(-18px)}</style>
<div class="s"><div class="b">${icon}<h1>Bhook</h1><p>Tell it what you're craving. It reads the reviews so you don't have to.</p></div>
<div class="p"><img src="${img("home")}"></div><div class="p m"><img src="${img("results")}"></div>
${third ? `<div class="p"><img src="${img("menu")}"></div>` : ""}</div>`;

for (const [file, w, h, third] of [["hero", 1600, 760, true], ["social-preview", 1280, 640, false]]) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await p.setContent(composite(w, h, third), { waitUntil: "load" });
  await p.screenshot({ path: `${OUT}/${file}.png` });
}

await browser.close();
console.log(`Wrote screenshots to ${OUT}`);
