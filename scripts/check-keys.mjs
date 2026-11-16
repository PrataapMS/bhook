// Verifies your .env keys without spending money:
//  - Google: an IDs-only Text Search (free, unlimited SKU)
//  - OpenRouter: reads key info (no completion is made)
// Run: npm run check:keys

const ok = (m) => console.log(`  \x1b[32m✔\x1b[0m ${m}`);
const bad = (m) => console.log(`  \x1b[31m✘\x1b[0m ${m}`);
let failed = false;

async function checkGoogle() {
  console.log("Google Places API (New)");
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return bad("GOOGLE_PLACES_API_KEY is empty (app will use demo places)");
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id" },
    body: JSON.stringify({ textQuery: "restaurant in Bengaluru", pageSize: 1 }),
  });
  if (res.ok) return ok("Key works and Places API (New) is enabled");
  failed = true;
  const msg = (await res.json().catch(() => ({})))?.error?.message ?? res.statusText;
  bad(`${res.status}: ${msg}`);
  if (res.status === 403) console.log("    Enable 'Places API (New)' and check the key's API restrictions + billing.");
}

async function checkOpenRouter() {
  console.log("OpenRouter");
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return bad("OPENROUTER_API_KEY is empty (app will use demo summaries)");
  const res = await fetch("https://openrouter.ai/api/v1/key", { headers: { authorization: `Bearer ${key}` } });
  if (!res.ok) {
    failed = true;
    return bad(`${res.status}: key rejected`);
  }
  const { data } = await res.json();
  ok(`Key works${data?.limit != null ? `, limit $${data.limit}` : ", no spend limit set (set one!)"}`);

  const models = (process.env.OPENROUTER_ALLOWED_MODELS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const wanted = [...new Set([process.env.OPENROUTER_MODEL_REVIEWS || "anthropic/claude-haiku-4.5", ...models])];
  const list = await fetch("https://openrouter.ai/api/v1/models").then((r) => r.json()).catch(() => null);
  const ids = new Set((list?.data ?? []).map((m) => m.id));
  for (const m of wanted) {
    if (ids.has(m)) ok(`Model available: ${m}`);
    else {
      failed = true;
      bad(`Model not found on OpenRouter: ${m}`);
    }
  }
}

await checkGoogle();
await checkOpenRouter();
process.exit(failed ? 1 : 0);
