# Distribution checklist

How Bhook presents itself on GitHub, and what to refresh when it changes. Review this at every release.

## What makes up the public face

| Item | Where | Refresh when |
|---|---|---|
| README (pitch, badges, screenshots, setup) | [`README.md`](../README.md) | A feature ships, setup changes, or a badge breaks |
| Screenshots and hero image | [`docs/assets/`](assets/) | The UI changes visibly |
| Social preview (link cards on Slack, X, LinkedIn) | `docs/assets/social-preview.png`, uploaded in repo **Settings, General, Social preview** | The hero image changes |
| Description, website and topics | Repo **About** panel (`gh repo edit`) | The pitch or live URL changes |
| Roadmap | [`docs/ROADMAP.md`](ROADMAP.md) and the [project board](https://github.com/users/PrataapMS/projects/4) | A milestone ships or scope changes |
| Release notes | GitHub Releases, created by the Deploy workflow | Each major version |
| Contributor docs | `CONTRIBUTING.md`, `SECURITY.md`, issue and PR templates | Process changes |

## Refresh screenshots

Screenshots must use demo data only (Google's terms don't allow republishing its place content). The script refuses to run otherwise.

```bash
USE_MOCKS=true npm run dev          # terminal 1
npm i --no-save puppeteer-core      # terminal 2, once
node scripts/screenshots.mjs        # writes docs/assets/*.png
```

Then upload `docs/assets/social-preview.png` in Settings, General, Social preview (GitHub has no API for this).

## Release checklist

1. Board items for the milestone are Done; `docs/ROADMAP.md` moves them to **Shipped**.
2. README features and screenshots match the app.
3. `npm version major` (deploys) or `npm version minor`/`patch` (no deploy), then push.
4. Approve the **production** environment in the Deploy run.
5. After the first deploy: add the live URL to the About panel (`gh repo edit --homepage <url>`) and a "Try it" link at the top of the README.

## About panel

```bash
gh repo edit PrataapMS/bhook \
  --description "Phone-first PWA that finds nearby restaurants, ranks them by what reviewers say, and tells you what to order." \
  --add-topic pwa,react,typescript,vite,netlify,restaurants,food,india,google-places-api,openrouter,llm,review-summarization
```

## Badge health

Badges in the README come from GitHub Actions (CI, CodeQL) and shields.io (static). If one shows "failing" or "not found", check the workflow name or the shields URL first.

## Tone

- Lead with what the user gets, not the tech.
- Say "demo data" wherever screenshots or examples use it.
- Keep AI caveats visible: summaries and menus can be wrong.
- Never mention internal decisions or costs per call in public docs; those stay in local notes.
