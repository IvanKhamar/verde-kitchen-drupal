# Security policy

This is a portfolio project with a fictional brand; it handles no real customer data. Security
reports are still welcome.

## Reporting a vulnerability

Please report a vulnerability privately through GitHub:
**Security → Report a vulnerability** on this repository (private vulnerability reporting).
Do not open a public issue for it.

Include what is affected, how to reproduce it, and the impact you expect. You will get an
answer within a week.

## What the project does

- **No secrets in the repository.** Credentials come from the environment or from files that
  are not committed (`settings.ddev.php`). A pre-commit hook and CI scan every change with
  gitleaks (`.gitleaks.toml`); GitHub secret scanning with push protection is on.
- **Dependencies** are checked by `composer audit` and `npm audit` in CI, and kept up to date
  by Dependabot.
- **Code scanning:** GitHub CodeQL analyses the JavaScript and the GitHub Actions workflows.
- **HTTP headers:** a strict Content Security Policy for visitors (no inline scripts or
  styles, no framing), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`.
- **Drupal:** JSON:API is read-only, only administrators create accounts, error messages are
  hidden from visitors, trusted host patterns are set on every server.
- **Output escaping:** Twig and React escape text; JSON-LD is encoded with `JSON_HEX_TAG`.
  Regression tests check all three with HTML in a product title.

Details: the "Security" section of [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
