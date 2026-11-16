# Verde Kitchen — Drupal 11 front-end portfolio project

A small marketing website for a **fictional** healthy food and drinks brand, built to
practise and demonstrate Drupal front-end development: a custom theme, Twig, Single
Directory Components, SCSS, a React widget fed by JSON:API, accessibility,
performance and SEO.

> Verde Kitchen is an invented brand. It is not connected to any real company.

**Status:** work in progress — phase 1 of 7 (local environment and project skeleton).

## Stack

| Area        | Tool                                                |
| ----------- | --------------------------------------------------- |
| Local env   | [DDEV](https://ddev.com/) 1.25 (Docker)             |
| CMS         | Drupal 11.4 (`drupal/recommended-project`), Drush 13 |
| Runtime     | PHP 8.4, MariaDB 11.8, Node.js 24                   |
| Theme       | Custom theme, Twig, Single Directory Components _(planned)_ |
| Front end   | SCSS, Webpack, React for one widget _(planned)_     |
| Data        | JSON:API (Drupal core) _(planned)_                  |
| Quality     | ESLint, Stylelint, Prettier, PHPCS, GitHub Actions _(planned)_ |

## Requirements

- [Docker](https://docs.docker.com/get-docker/) (Docker Desktop, or another provider DDEV supports)
- [DDEV](https://docs.ddev.com/en/stable/users/install/ddev-installation/) 1.25 or newer

PHP, Composer, Node.js and the database all run inside the DDEV containers, so nothing
else has to be installed on the host.

## Getting started

```bash
git clone https://github.com/IvanKhamar/verde-kitchen-drupal.git
cd verde-kitchen-drupal
ddev start
ddev composer install
ddev drush site:install minimal --account-name=admin --site-name="Verde Kitchen" -y
ddev launch
```

`site:install` prints a one-time generated admin password. To log in later without it,
run `ddev drush user:login`.

> From phase 2 on, the site is installed from the exported configuration
> (`--existing-config`) and a script creates the demo content. This section will be updated.

## Project structure

```text
.ddev/          DDEV configuration (PHP, database and Node versions)
config/sync/    Exported Drupal configuration
web/            Web root (Drupal core and contributed code are installed by Composer)
composer.json   PHP dependencies
```

## Secrets

No secret is stored in this repository. `settings.php` is committed without credentials:
DDEV generates `settings.ddev.php` (git-ignored) with the local database credentials and a
random hash salt. Outside DDEV, set the `DRUPAL_HASH_SALT` environment variable.
Every push is scanned with [gitleaks](https://github.com/gitleaks/gitleaks).

## Screenshots

_To be added in phase 7._

## Lighthouse and axe results

_To be added in phase 6._

## Documentation

- `docs/ARCHITECTURE.md` — theme structure and data flow _(planned)_
- `docs/LEARNING.md` — how Drupal theming works in this project _(planned)_
- `docs/design-tokens.md` — colours, typography, spacing, breakpoints _(planned)_

## License

Code: GPL-2.0-or-later, the same as Drupal (see `LICENSE.txt`).
