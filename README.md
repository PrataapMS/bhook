# Bhook

A phone-first PWA that finds nearby restaurants for what you're craving, ranks them by what reviewers actually say, and tells you what to order.

Runs fully on **demo data** with no API keys, so you can develop before any account exists.

## Quick start

```bash
nvm use            # Node 24 (see .nvmrc)
npm install
cp .env.example .env
npm run dev        # http://localhost:8888  (UI + API together via Netlify Dev)
```

Add keys to `.env` when you have them, then:

```bash
npm run check:keys # verifies Google + OpenRouter keys at zero cost
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite + Netlify Functions on port 8888, loads `.env` |
| `npm test` | Ranking unit tests (Vitest) |
| `npm run typecheck` | TypeScript across UI, server and functions |
| `npm run build` | Production build into `dist/` (PWA manifest + service worker) |
| `npm run check:keys` | Free checks that your keys work and models exist |

## Layout

```
src/                 PWA (React). App.tsx is the whole flow; components/ holds the two building blocks.
shared/              Types and ranking used by both UI and server. ranking.test.ts lives here.
server/              Server-only code: Google Places client, OpenRouter client, env, demo data.
netlify/functions/   HTTP endpoints: /api/search, /api/analyze, /api/health
scripts/             check-keys.mjs
docs/                PLAN.md, SETUP.md (your manual to-dos) and specs/ (the detail)
```

## Docs

- [docs/SETUP.md](docs/SETUP.md): the accounts and settings only you can do
- [docs/PLAN.md](docs/PLAN.md): phases and what's built
- [docs/specs/](docs/specs/): architecture, ranking, reviews, menus, personalisation, cost and guardrails
