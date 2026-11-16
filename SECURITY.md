# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through GitHub: the repository's **Security** tab, **Report a vulnerability**. You'll get a reply within a week.

Useful things to include: what's affected, steps to reproduce, and the impact you expect.

## Scope

Bhook only supports the latest version on `main`. Areas of particular interest:

- API keys leaking to the browser or through `/api/health`
- Server-side request forgery through the menu fetcher
- Prompt injection through review or menu text that changes what the app renders or does
