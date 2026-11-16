# Verde Kitchen — Drupal 11 front-end portfolio project

A small marketing website for a **fictional** healthy food and drinks brand, built to
practise and demonstrate Drupal front-end development: a custom theme, Twig, Single
Directory Components, SCSS, a React widget fed by JSON:API, accessibility,
performance and SEO.

> Verde Kitchen is an invented brand. It is not connected to any real company.

**Status:** work in progress — phase 4 of 7 (components, page templates, preprocess functions).

## Stack

| Area        | Tool                                                |
| ----------- | --------------------------------------------------- |
| Local env   | [DDEV](https://ddev.com/) 1.25 (Docker)             |
| CMS         | Drupal 11.4 (`drupal/recommended-project`), Drush 13 |
| Runtime     | PHP 8.4, MariaDB 11.8, Node.js 24                   |
| Theme       | Custom theme `verde` (no base theme), Twig, Single Directory Components, Views |
| Front end   | SCSS with design tokens, Webpack 5, PostCSS/Autoprefixer; React widget _(planned)_ |
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
ddev npm ci
ddev npm run build
ddev site-setup
ddev launch
```

`npm run build` compiles the theme's SCSS into `web/themes/custom/verde/dist/`. The
built files are not committed, so this step is required.

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

| Custom block type | Fields                                                  |
| ----------------- | ------------------------------------------------------- |
| Banner            | variant (hero / promo), heading, text, link, image      |

Demo content: 14 products, 5 articles, 2 banners and the main and footer menu links,
created by `scripts/demo-content/demo-content.php`. Products marked "Promoted to front
page" are the featured products on the home page.

## Pages

| Path        | What it shows                                                        | Built with                     |
| ----------- | -------------------------------------------------------------------- | ------------------------------ |
| `/`         | Hero, featured products, promo banner, latest articles               | Views page + blocks on `<front>` |
| `/products` | Product catalog                                                      | View `products`                |
| `/articles` | Recipes and news, newest first, 6 per page                           | View `articles`                |
| `/node/N`   | Product or article page                                              | `node--TYPE--full.html.twig`   |

## Components

The theme's UI parts are [Single Directory Components](https://www.drupal.org/docs/develop/theming-drupal/using-single-directory-components)
in `web/themes/custom/verde/components/`. Each folder holds the component's metadata
(`*.component.yml`, with a JSON schema for its props), Twig template, SCSS and, if needed, JS.

| Component     | Used for                                                        |
| ------------- | --------------------------------------------------------------- |
| `button`      | Calls to action (link or `<button>`)                            |
| `badge`       | Dietary tags, article type                                      |
| `card`        | Product and article teasers; the whole card is clickable        |
| `hero`        | Home hero (`<h1>`) and promo banner                             |
| `teaser-grid` | Every list of cards; responsive grid without media queries      |
| `navigation`  | Main menu with an accessible mobile toggle (disclosure pattern) |

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

## Front-end build

`package.json` and `webpack.config.js` sit in the project root, outside the web root,
so `node_modules/` is never served by the web server.

| Command               | What it does                                                   |
| --------------------- | -------------------------------------------------------------- |
| `ddev npm run build`  | Production build: compressed CSS, no source maps               |
| `ddev npm run watch`  | Development build with source maps; rebuilds when a file changes |

Node.js runs in the DDEV container (version 24, see `.nvmrc`). With Node.js 24 on the
host, the same commands work without `ddev`.

`scripts/screenshots.mjs` takes full-page screenshots at 360, 768 and 1280 px with a
local Chrome or Edge (no npm packages needed):

```bash
CHROME_PATH="/path/to/chrome" BASE_URL="http://127.0.0.1:PORT" node scripts/screenshots.mjs
```

`ddev describe` shows the `127.0.0.1` address. Recent Chromium versions block pages on
public domains that resolve to `127.0.0.1` (such as `*.ddev.site`), so use that direct address.

While working on the theme, turn off CSS/JS aggregation and Twig caching
(Admin > Configuration > Development > Development settings), so changes show up
on reload.

## Project structure

```text
.ddev/                  DDEV configuration and the site-setup command
config/sync/            Exported Drupal configuration
scripts/demo-content/   Demo content script and its images
scripts/ci/             Scripts used by GitHub Actions
web/                    Web root (Drupal core and contributed code are installed by Composer)
web/themes/custom/verde/
  verde.info.yml        Theme definition: regions, global library
  verde.libraries.yml   CSS/JS libraries
  verde.theme           Preprocess functions and template suggestions (PHP)
  components/           Single Directory Components (Twig, SCSS, JS)
  templates/            Twig templates that override Drupal's defaults
  src/scss/             SCSS sources: abstracts (tokens, mixins), base, layout, components, pages
  dist/                 Build output (not committed)
docs/                   Project documentation
composer.json           PHP dependencies
package.json            Front-end build tools and npm scripts
webpack.config.js       Webpack configuration
```

## Continuous integration

On every push GitHub Actions scans the history for secrets, validates and audits the
Composer and npm dependencies, builds the theme assets, then installs the site from `config/sync` into an empty MariaDB
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
- [`docs/design-tokens.md`](docs/design-tokens.md) — colours (with WCAG contrast ratios), typography, spacing, breakpoints

Image and content credits: `CREDITS.md`.

## License

Code: GPL-2.0-or-later, the same as Drupal (see `LICENSE.txt`).
