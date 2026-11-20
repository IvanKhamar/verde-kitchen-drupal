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

bash scripts/ci/install-site.sh

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

# The home page shows the hero banner (custom block placed by config, content
# created by the demo script) and the featured products view.
home=$(curl --fail --silent --show-error "$base_url/")
grep --quiet 'Fresh food that feels good' <<< "$home"
grep --quiet 'class="card"' <<< "$home"
curl --fail --silent --show-error --output /dev/null "$base_url/products"
# JSON:API serves products to the React filter, with the computed image URL
# from the verde_catalog module.
# The JSON is decoded rather than searched as text: JSON may escape "/" as "\/".
curl --fail --silent --show-error "$base_url/jsonapi/node/product?page%5Blimit%5D=1" | php -r '
  $document = json_decode(stream_get_contents(STDIN), true);
  $url = $document["data"][0]["attributes"]["card_image_url"] ?? "";
  exit(str_starts_with($url, "/sites/default/files/styles/card/") ? 0 : 1);
'
curl --fail --silent --show-error --output /dev/null "$base_url/articles"
nid=$($drush php:eval '$ids = \Drupal::entityQuery("node")->accessCheck(FALSE)->condition("type", "product")->sort("nid")->range(0, 1)->execute(); echo reset($ids);')
page=$(curl --fail --silent --show-error "$base_url/node/$nid")
grep --quiet 'Green Glow Smoothie' <<< "$page"
# The Verde theme is the default theme: its skip link is on every page.
grep --quiet 'class="skip-link"' <<< "$page"

# SEO: Pathauto made a clean URL; Metatag and the theme add meta tags and JSON-LD.
product=$(curl --fail --silent --show-error "$base_url/products/green-glow-smoothie")
grep --quiet '<meta name="description"' <<< "$product"
grep --quiet '<meta property="og:image"' <<< "$product"
grep --quiet '<script type="application/ld+json">' <<< "$product"
# Responsive images: srcset with WebP files.
grep --quiet 'srcset="[^"]*\.webp' <<< "$product"

# Security: a title with HTML (as a malicious editor could type) must be escaped by
# Twig, and in JSON-LD it must not be able to close the <script> element.
xss_nid=$($drush php:eval '$node = \Drupal\node\Entity\Node::create(["type" => "product", "title" => "<script>alert(1)</script> XSS test", "field_price" => "1.00"]); $node->save(); echo $node->id();')
xss_page=$(curl --fail --silent --show-error "$base_url/node/$xss_nid")
grep --quiet '&lt;script&gt;alert(1)&lt;/script&gt; XSS test' <<< "$xss_page"
if grep --quiet '<script>alert(1)' <<< "$xss_page"; then
  echo "Unescaped <script> found on the page."
  exit 1
fi
grep --quiet '\\u003Cscript\\u003Ealert(1)' <<< "$xss_page"
$drush entity:delete node "$xss_nid"

# Ukrainian: translated content under /uk, interface strings from the .po file.
home_uk=$(curl --fail --silent --show-error "$base_url/uk")
grep --quiet '<html lang="uk"' <<< "$home_uk"
grep --quiet 'Свіжа їжа, від якої добре' <<< "$home_uk"
grep --quiet 'Перейти до основного вмісту' <<< "$home_uk"
product_uk=$(curl --fail --silent --show-error "$base_url/uk/products/smuzi-zelene-syayvo")
grep --quiet 'hreflang="en"' <<< "$product_uk"

# The Privacy page in both languages, linked from the footer.
grep --quiet 'href="/uk/pryvatnist"' <<< "$home_uk"
grep --quiet 'What we collect' <<< "$(curl --fail --silent --show-error "$base_url/privacy")"
grep --quiet 'Що ми збираємо' <<< "$(curl --fail --silent --show-error "$base_url/uk/pryvatnist")"

# Contact messages module: installed, and its entity table exists.
$drush php:eval 'echo \Drupal::entityTypeManager()->getStorage("verde_lead")->getQuery()->accessCheck(FALSE)->count()->execute();' > /dev/null

echo "Install test passed."
