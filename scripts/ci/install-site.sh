#!/usr/bin/env bash
#
# Installs the site from config/sync into an empty database and adds the
# Ukrainian interface translations and the demo content. Used by the install
# test (CI) and by the GitHub Pages build.
#
#   DB_URL=mysql://user:pass@host:3306/dbname bash scripts/ci/install-site.sh

set -euo pipefail
: "${DB_URL:?Set DB_URL, for example mysql://user:pass@127.0.0.1:3306/drupal}"

drush=vendor/bin/drush

# A random admin password that is never printed: without --account-pass, Drush
# would print a generated one, and CI logs of a public repository are public.
$drush site:install --existing-config --db-url="$DB_URL" --account-pass="$(openssl rand -hex 24)" --yes
# Ukrainian interface translations (localize.drupal.org and the theme's .po file).
$drush locale:check
$drush locale:update
$drush php:script scripts/demo-content/demo-content.php
