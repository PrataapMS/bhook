# Manual setup

Everything here needs your accounts, card or judgement, so it can't be automated. Total time: about an hour. The app runs on demo data until you finish, so do these in any order.

When you're done, `npm run check:keys` should show all green ticks.

## 1. Local machine (5 min)

- [ ] Install **Node 24** (`nvm install 24`) and **git**.
- [ ] `npm install`, `cp .env.example .env`, `npm run dev`, open http://localhost:8888. You should see the app with a "Demo data" notice.

## 2. Google Places API (30 min)

Use a billing account with an **Indian billing address**: India has its own price list with a 7x larger free allowance for the SKU this app uses (see [specs/06](specs/06-cost-and-guardrails.md)).

- [ ] Go to console.cloud.google.com and create a project, e.g. `bhook`.
- [ ] Billing: create or attach a billing account (card required even for free usage). Indian cards may need international/online transactions enabled.
- [ ] APIs & Services, Library: enable **Places API (New)**. Not the legacy "Places API".
- [ ] APIs & Services, Credentials: **Create credentials, API key**. Then edit the key:
  - API restrictions: **Restrict key**, select only Places API (New).
  - Application restrictions: leave as None. The key lives only in server-side functions, never in the browser.
- [ ] Quotas: in Places API (New), Quotas & System Limits, set a **per-day cap** on Text Search requests (start with 300/day). This is the control that actually stops spend; budgets only alert.
- [ ] Billing, Budgets & alerts: add a budget of about ₹500/month with email alerts at 50/90/100%.
- [ ] Put the key in `.env` as `GOOGLE_PLACES_API_KEY`.

## 3. OpenRouter (10 min)

- [ ] Sign up at openrouter.ai.
- [ ] Credits: add a small amount (e.g. $5). OpenRouter charges a small fee on credit purchases; model prices themselves are pass-through.
- [ ] Keys: create a key and **set a credit limit on the key** (e.g. $3/month) as a hard stop.
- [ ] Put it in `.env` as `OPENROUTER_API_KEY`.
- [ ] Optional: change `OPENROUTER_MODEL_REVIEWS` and `OPENROUTER_ALLOWED_MODELS`. Any slug from openrouter.ai/models works; `check:keys` confirms each one exists.
- [ ] Optional privacy: in OpenRouter settings, decide whether to allow providers that train on prompts. Reviews are public text, so the risk is low, but it's your call.

## 4. Deploy to Netlify (15 min)

- [ ] Create a GitHub repo and push this project (`.env` is gitignored, keep it that way).
- [ ] At app.netlify.com: **Add new project, Import from Git**, pick the repo. Build settings are read from `netlify.toml`, so accept the defaults.
- [ ] Add environment variables, either in Site configuration, Environment variables, or from your terminal:
  ```bash
  npx netlify login
  npx netlify link        # pick the site you just created
  npx netlify env:import .env
  ```
- [ ] Trigger a deploy. Open `https://<your-site>.netlify.app/api/health`: both services should say `"live"`.
- [ ] Free-plan note: production deploys cost credits (about 20/month fit in the free allowance). Iterate locally and on deploy previews; deploy to production a few times a week.

## 5. Install on your phone (2 min)

- [ ] Android, Chrome: open the site, menu, **Install app** (or Add to Home screen).
- [ ] iPhone, Safari: Share, **Add to Home Screen**.
- [ ] Allow location when asked.

## Gotchas

- **GPS on your phone needs HTTPS.** Browsing to your laptop's LAN IP over plain http blocks geolocation. Locally, type an area instead, or test on a Netlify deploy preview.
- **Key errors.** A 403 from Google usually means Places API (New) isn't enabled, billing isn't attached, or the key restriction excludes it. `check:keys` prints the exact Google message.
- **Never** put either key in a `VITE_`-prefixed variable. Those are bundled into the browser code.
