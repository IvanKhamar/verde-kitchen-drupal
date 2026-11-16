#!/usr/bin/env bash
#
# Installs the site from config/sync into an empty database, creates the demo
# content and checks that pages respond. CI runs it on every push; it proves the
# site can be built from scratch using only what is in the repository.
#
# Needs: Composer dependencies installed, an empty database in DB_URL.
#   DB_URL=mysql://user:pass@host:3306/dbname bash scripts/ci/install-test.sh

set -euo pipefail
: "${DB_URL:?Set DB_URL, for example mysql://user:pass@127.0.0.1:3306/drupal}"

drush=vendor/bin/drush
base_url=http://127.0.0.1:8888

$drush site:install --existing-config --db-url="$DB_URL" --yes
$drush php:script scripts/demo-content/demo-content.php

# The active configuration must match config/sync exactly.
changes=$($drush config:status --format=list 2>/dev/null)
if [ -n "$changes" ]; then
  echo "Active config differs from config/sync:"
  echo "$changes"
  exit 1
fi

# PHP's built-in web server is enough for a smoke test.
$drush runserver 127.0.0.1:8888 > /tmp/runserver.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid"' EXIT
for _ in $(seq 1 30); do
  curl --silent --output /dev/null "$base_url/" && break
  sleep 1
done

curl --fail --silent --show-error --output /dev/null "$base_url/"
nid=$($drush php:eval '$ids = \Drupal::entityQuery("node")->accessCheck(FALSE)->condition("type", "product")->sort("nid")->range(0, 1)->execute(); echo reset($ids);')
curl --fail --silent --show-error "$base_url/node/$nid" | grep --quiet 'Green Glow Smoothie'

echo "Install test passed."
