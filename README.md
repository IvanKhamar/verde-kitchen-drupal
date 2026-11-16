# Verde Kitchen — Drupal 11 front-end portfolio project

A small marketing website for a **fictional** healthy food and drinks brand, built to
practise and demonstrate Drupal front-end development: a custom theme, Twig, Single
Directory Components, SCSS, a React widget fed by JSON:API, accessibility,
performance and SEO.

> Verde Kitchen is an invented brand. It is not connected to any real company.

**Status:** work in progress — phase 2 of 7 (content model and demo content).

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
ddev site-setup
ddev launch
```

`ddev site-setup` (defined in `.ddev/commands/web/site-setup`) installs Drupal from the
exported configuration in `config/sync` and then creates the demo content. It deletes the
current database, so it is also the way to reset the site.

To log in as the administrator, run `ddev drush user:login` and open the link it prints.

The two steps can also be run one by one:

```bash
ddev drush site:install --existing-config --account-name=admin -y
ddev drush php:script scripts/demo-content/demo-content.php
```

## Content model

| Content type | Fields                                                                     |
| ------------ | -------------------------------------------------------------------------- |
| Product      | title, image, description (with summary), category, dietary tags, price (€) |
| Article      | title, article type (recipe / news), image, body                            |

| Vocabulary       | Terms                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| Product category | Drinks, Bowls, Snacks, Breakfast                                       |
| Dietary tag      | Vegan, Vegetarian, Gluten-free, Dairy-free, High protein, No added sugar |

Demo content: 14 products and 5 articles, created by
`scripts/demo-content/demo-content.php`. Products marked "Promoted to front page" will be
the featured products on the home page.

## Working with configuration

Content types, fields, displays and other settings live in `config/sync` as YAML files.
After changing settings in the admin UI, export them and commit the result:

```bash
ddev drush config:export -y
```

To apply configuration from the repository to your database (for example after `git pull`):

```bash
ddev drush config:import -y
```

## Project structure

```text
.ddev/                  DDEV configuration and the site-setup command
config/sync/            Exported Drupal configuration
scripts/demo-content/   Demo content script and its images
scripts/ci/             Scripts used by GitHub Actions
web/                    Web root (Drupal core and contributed code are installed by Composer)
composer.json           PHP dependencies
```

## Continuous integration

On every push GitHub Actions scans the history for secrets, validates and audits the
Composer dependencies, then installs the site from `config/sync` into an empty MariaDB
database, creates the demo content and requests a few pages
(`scripts/ci/install-test.sh`).

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

Image and content credits: `CREDITS.md`.

## License

Code: GPL-2.0-or-later, the same as Drupal (see `LICENSE.txt`).
