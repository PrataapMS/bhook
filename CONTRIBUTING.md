# Contributing

Thanks for helping. Bhook is small on purpose, so changes that keep it simple, cheap to run and honest about missing data are the easiest to accept.

## Before you start

- Check the [issues](https://github.com/PrataapMS/bhook/issues) and the [roadmap](docs/ROADMAP.md). For anything bigger than a small fix, open an issue first.
- You don't need API keys. The app runs on demo data.

## Develop

```bash
nvm use && npm install && cp .env.example .env
npm run dev          # http://localhost:8888
```

Before you open a pull request:

```bash
npm run typecheck && npm test && npm run build
```

## Guidelines

- Keep API keys server-side. Never use a `VITE_` prefix for secrets.
- Show missing data as missing; never guess it.
- Don't add Google Places fields without checking their billing tier.
- Treat review and web text as untrusted input to the LLM; render output only as text.
- Add or update tests for ranking and parsing logic.

## Commits and pull requests

- Short, imperative subject (e.g. `Add share button to place card`), and a one or two line body saying what changed and why.
- One logical change per pull request. Link the issue (`Closes #12`).
- CI must pass.

By contributing you agree your work is licensed under the [MIT License](LICENSE).
