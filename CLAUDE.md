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
            ── GET  /api/health  ──▶ netlify/functions/health.ts (live vs mock, allowed models)
```

- **Layers.** `netlify/functions/*` are thin Netlify Functions v2 handlers, routed by `export const config = { path }` (there is no redirects file). Each handler validates and clamps input, then calls into `server/`. `server/` is server-only: env, HTTP helpers, Google and OpenRouter clients, demo data. `shared/` holds the types and ranking used by both the UI and the server. `src/` is the React UI. `App.tsx` contains the whole flow, and `api.ts` is the fetch client.
- **Reviews travel through the client.** `/api/search` returns places together with their Google reviews. The UI auto-summarises the top 3 (`AUTO_SUMMARISE`) by POSTing those reviews back to `/api/analyze`, which avoids a second paid Google call. Because the client sends them, the server re-caps and sanitises them. The returned `sentiment` re-scores a place client-side through `withSentiment()` in `shared/ranking.ts`.
- **Ranking** (`shared/ranking.ts`, spec in `docs/specs/02`): hard filters, then a weighted score made of a Bayesian rating (`PRIOR_REVIEWS` against a review-weighted area mean), Google's relevance order (`searchRank`), proximity, budget fit (INR bands) and sentiment. `WEIGHTS` must sum to 1. An `undefined` attribute from Google means "unknown" and must not filter a place out.
- **Demo mode per service.** `server/env.ts` is the only place that reads `process.env`. An empty `GOOGLE_PLACES_API_KEY` makes Google calls return generated places from `server/mocks.ts`. An empty `OPENROUTER_API_KEY` returns mock summaries. `USE_MOCKS=true` forces both. Responses carry `mock: true` so the UI can show a "Demo data" notice.
- **Errors.** Upstream failures throw `UpstreamError` and go through `handleError` in `server/http.ts`: a 429 passes through, anything else becomes a 502 with the truncated upstream message. The UI shows `error: detail`.
- **Model choice.** The client may request any OpenRouter model, but `resolveModel()` falls back to the default unless the slug is in `OPENROUTER_ALLOWED_MODELS`. Output is requested as strict JSON schema, and `extractJson()` tolerates models that ignore `response_format`.

## Constraints that aren't obvious from the code

- **Cost:** Google bills each call at the highest SKU of any field in the mask. `SEARCH_FIELDS` in `server/places.ts` is deliberately at "Enterprise + Atmosphere" so that reviews come back in the same call. Check `docs/specs/06-cost-and-guardrails.md` before you add a field. Photos are billed separately.
- **Google terms:** don't persist Places content (ratings, reviews, addresses) long-term. Storing place IDs is allowed. Keep the "Google Maps" attribution and show review author attribution.
- **Secrets:** keys live only in server code. Never put a key in a `VITE_`-prefixed variable, because those are bundled into the browser. `/api/health` must never return key values.
- **Review text is untrusted input to the LLM.** The system prompt treats it as data, and output is rendered only as text.
- **Service worker:** `vite.config.ts` excludes `/api/` from navigation fallback, and the SW must never cache API responses.
- **Honest output:** show missing data as missing; never guess it.

## Docs

`docs/PLAN.md` holds the phases and their status. Phases 0 to 2 are built; menus (Phase 3) and personalisation (Phase 4) exist only as specs in `docs/specs/04` and `05`. `docs/SETUP.md` lists the manual account steps. Read the relevant spec before you implement a phase.
