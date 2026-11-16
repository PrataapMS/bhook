# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Bhook is a phone-first React PWA that finds nearby restaurants (India-focused), ranks them, and summarises their reviews with an LLM. The UI and API are deployed together on Netlify.

## Commands

Node 24 (`.nvmrc`). Copy `.env.example` to `.env` first; empty keys are fine (see Demo mode).

```bash
npm run dev                      # Netlify Dev on http://localhost:8888: Vite UI + functions, loads .env
npm test                         # Vitest (all tests)
npx vitest run shared/ranking.test.ts -t "priceFit"   # single file / single test by name
npm run typecheck                # tsc --noEmit across src, shared, server, netlify/functions
npm run build                    # vite build to dist/ (PWA manifest + service worker)
npm run check:keys               # verifies Google + OpenRouter keys at zero cost
```

There is no linter configured. Use port 8888, not Vite's 5173: plain `vite` has no `/api/*` routes.

## Architecture

The request flow is a deterministic pipeline, not a chat agent. The LLM only does narrow jobs (review summaries now, menu extraction later).

```
src/App.tsx ── POST /api/search  ──▶ netlify/functions/search.ts ─▶ server/places.ts (Google Places Text Search)
                                                                  └▶ shared/ranking.ts rankPlaces()
            ── POST /api/analyze ──▶ netlify/functions/analyze.ts ─▶ server/openrouter.ts (one call per place)
            ── POST /api/menu?method=website|web_search ──▶ netlify/functions/menu.ts ─▶ server/menu.ts (+ webpage.ts, menuCache.ts)
            ── GET  /api/health  ──▶ netlify/functions/health.ts (live vs mock, allowed models)
```

- **Layers.** `netlify/functions/*` are thin Netlify Functions v2 handlers, routed by `export const config = { path }` (there is no redirects file). Each handler validates and clamps input, then calls into `server/`. `server/` is server-only: env, HTTP helpers, Google and OpenRouter clients, demo data. `shared/` holds the types and ranking used by both the UI and the server. `src/` is the React UI. `App.tsx` contains the whole flow, and `api.ts` is the fetch client.
- **Reviews travel through the client.** `/api/search` returns places together with their Google reviews. The UI auto-summarises the top 3 (`AUTO_SUMMARISE`) by POSTing those reviews back to `/api/analyze`, which avoids a second paid Google call. Because the client sends them, the server re-caps and sanitises them. The returned `sentiment` re-scores a place client-side through `withSentiment()` in `shared/ranking.ts`.
- **Ranking** (`shared/ranking.ts`, spec in `docs/specs/02`): hard filters, then a weighted score made of a Bayesian rating (`PRIOR_REVIEWS` against a review-weighted area mean), Google's relevance order (`searchRank`), proximity, budget fit (INR bands) and sentiment. `WEIGHTS` must sum to 1. An `undefined` attribute from Google means "unknown" and must not filter a place out.
- **Demo mode per service.** `server/env.ts` is the only place that reads `process.env`. An empty `GOOGLE_PLACES_API_KEY` makes Google calls return generated places from `server/mocks.ts`. An empty `OPENROUTER_API_KEY` returns mock summaries. `USE_MOCKS=true` forces both. Responses carry `mock: true` so the UI can show a "Demo data" notice.
- **Errors.** Upstream failures throw `UpstreamError` and go through `handleError` in `server/http.ts`: a 429 passes through, anything else becomes a 502 with the truncated upstream message. The UI shows `error: detail`.
- **Menus (on tap only).** The client calls `?method=website` (fetch the restaurant's own site, LLM extracts) and, only if that is `not_found`, `?method=web_search` (OpenRouter web plugin, ~$0.02). Two requests keep each inside the function timeout. Results are cached in Netlify Blobs (`menus` store). `server/webpage.ts` guards the client-supplied URL against SSRF; keep that check on every hop.
- **Model choice.** The client may request any OpenRouter model, but `resolveModel()` falls back to the default unless the slug is in `OPENROUTER_ALLOWED_MODELS`. Output is requested as strict JSON schema, and `extractJson()` tolerates models that ignore `response_format`.

## Constraints that aren't obvious from the code

- **Cost:** Google bills each call at the highest SKU of any field in the mask. `SEARCH_FIELDS` in `server/places.ts` is deliberately at "Enterprise + Atmosphere" so that reviews come back in the same call. Check `docs/specs/06-cost-and-guardrails.md` before you add a field. Photos are billed separately.
- **Google terms:** don't persist Places content (ratings, reviews, addresses) long-term. Storing place IDs is allowed. Keep the "Google Maps" attribution and show review author attribution.
- **Secrets:** keys live only in server code. Never put a key in a `VITE_`-prefixed variable, because those are bundled into the browser. `/api/health` must never return key values.
- **Review text is untrusted input to the LLM.** The system prompt treats it as data, and output is rendered only as text.
- **Service worker:** `vite.config.ts` excludes `/api/` from navigation fallback, and the SW must never cache API responses.
- **Honest output:** show missing data as missing; never guess it.

## Docs

Public (committed): `README.md`, `docs/ROADMAP.md` (features and roadmap), `docs/SETUP.md` (manual account steps), `docs/DISTRIBUTION.md` (README, screenshots, release checklist), `CONTRIBUTING.md`, `SECURITY.md`.

Local only (gitignored, may be absent in a fresh clone): `docs/PLAN.md` (phases, status, definitions of done) and `docs/specs/` (design decisions). Phases 0 to 3 are built; personalisation (Phase 4) exists only as a spec in `docs/specs/05`. Read the relevant spec, if present, before you implement a phase.

## Working rules (apply in every session)

### Task tracking

Work is tracked in the GitHub Project **Bhook** (#4, https://github.com/users/PrataapMS/projects/4) with issues in `PrataapMS/bhook`, grouped by milestones (`v1.0 Launch`, `Personalisation`, `Polish`).

At the start of a session, unless the user gives a specific task:

1. `gh project item-list 4 --owner PrataapMS --format json --limit 100` and pick the next item: Status `Todo`, highest Priority (P0 > P1 > P2), earliest milestone. Skip issues labelled `manual` (they need the owner's accounts or approval); list them for the user instead.
2. Read the issue (`gh issue view <n>`), then move it to In Progress:
   `gh project item-edit --project-id PVT_kwHOAQ4vwc4Br3lt --id <item-id> --field-id PVTSSF_lAHOAQ4vwc4Br3ltzhqIQP4 --single-select-option-id 47fc9ee4`
   (Status options: Todo `f75ad846`, In Progress `47fc9ee4`, Done `98236657`. Priority field `PVTSSF_lAHOAQ4vwc4Br3ltzhqIRdA`: P0 `2c76cead`, P1 `1d4b5018`, P2 `f4318fad`.)
3. When done: commit with `Closes #<n>` in the body, set Status to Done, update local `docs/PLAN.md`, and update `docs/ROADMAP.md` / `README.md` if a user-visible feature shipped (see `docs/DISTRIBUTION.md`).
4. New work found along the way becomes a new issue added to the project (`gh issue create ...` then `gh project item-add 4 --owner PrataapMS --url <issue-url>`), with Priority and milestone set.

### Commits

- Author is the repo owner only. Never add `Co-Authored-By` or any other trailer.
- Short imperative subject (about 50 chars, no trailing period) and a one or two line body saying what changed and why.
- One logical change per commit. Run `npm run typecheck && npm test` first.
- Never commit `docs/PLAN.md`, `docs/specs/`, `CLAUDE.local.md`, `.env` or other local planning notes. Public docs describe features and roadmap, never internal decisions, rationale or per-call costs.
- Commit and push only when the user asks. `main` is protected by a ruleset: only the owner can push; no force-push or deletion.

### Versioning and deploys

- The Deploy workflow (`.github/workflows/deploy.yml`) deploys to Netlify only when the **major** version in `package.json` changes, or on a manual run, and then waits for approval on the `production` environment. Netlify's own Git builds are disabled (`ignore` in `netlify.toml`).
- Never deploy to Netlify (no major bump, no `netlify deploy`, no manual workflow run) unless the user explicitly confirms in the current session. Use `npm version minor|patch --no-git-tag-version` for non-deploy releases.
