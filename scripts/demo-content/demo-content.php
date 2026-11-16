<?php

/**
 * @file
 * Creates the Verde Kitchen demo content: terms, products and articles.
 *
 * Run it with Drush, which boots Drupal before it includes this file:
 *   ddev drush php:script scripts/demo-content/demo-content.php
 *
 * The script is idempotent: it first deletes every product, article, term of
 * the two vocabularies and menu link of the main and footer menus, then
 * creates them again. The two banners are updated in place.
 * Use it on a local site only.
 *
 * All names and texts are invented for this portfolio project.
 */

declare(strict_types=1);

use Drupal\block_content\Entity\BlockContent;
use Drupal\Core\File\FileExists;
use Drupal\Core\File\FileSystemInterface;
use Drupal\file\FileInterface;
use Drupal\menu_link_content\Entity\MenuLinkContent;
use Drupal\node\Entity\Node;
use Drupal\taxonomy\Entity\Term;

// --- Data -------------------------------------------------------------------

$categories = [
  'drinks' => 'Drinks',
  'bowls' => 'Bowls',
  'snacks' => 'Snacks',
  'breakfast' => 'Breakfast',
];

$dietary_tags = [
  'vegan' => 'Vegan',
  'vegetarian' => 'Vegetarian',
  'gluten-free' => 'Gluten-free',
  'dairy-free' => 'Dairy-free',
  'high-protein' => 'High protein',
  'no-added-sugar' => 'No added sugar',
];

// Keys: image slug. "featured" products are promoted to the home page.
$products = [
  'green-glow-smoothie' => [
    'title' => 'Green Glow Smoothie',
    'category' => 'drinks',
    'tags' => ['vegan', 'gluten-free', 'dairy-free'],
    'price' => '3.90',
    'featured' => TRUE,
    'summary' => 'Spinach, apple, cucumber and lime, blended cold for a fresh start to the day.',
    'body' => '<p>Our best-selling smoothie mixes baby spinach, green apple, cucumber and a squeeze of lime. It is thick enough to feel like a snack and light enough for every morning.</p><p>Shake well before drinking. Keep refrigerated.</p>',
    'alt' => 'Green smoothie bottle with a leaf on its label',
  ],
  'ginger-lemon-shot' => [
    'title' => 'Ginger Lemon Shot',
    'category' => 'drinks',
    'tags' => ['vegan', 'gluten-free', 'no-added-sugar'],
    'price' => '2.50',
    'featured' => FALSE,
    'summary' => 'A small, spicy shot of cold-pressed ginger and lemon.',
    'body' => '<p>Cold-pressed ginger root and lemon juice with a pinch of turmeric. One 60 ml bottle is one shot.</p><p>It is sharp and warming, so most people drink it in one go.</p>',
    'alt' => 'Small yellow bottle with a green cap',
  ],
  'oat-barista-drink' => [
    'title' => 'Oat Barista Drink',
    'category' => 'drinks',
    'tags' => ['vegan', 'dairy-free'],
    'price' => '2.80',
    'featured' => FALSE,
    'summary' => 'A creamy oat drink that foams well in coffee.',
    'body' => '<p>Made from oats and a little sunflower oil, this drink froths like milk and does not split in hot coffee.</p><p>Contains oats, which may contain traces of gluten.</p>',
    'alt' => 'Beige bottle of oat drink with a brown cap',
  ],
  'berry-kombucha' => [
    'title' => 'Berry Kombucha',
    'category' => 'drinks',
    'tags' => ['vegan', 'gluten-free'],
    'price' => '3.20',
    'featured' => FALSE,
    'summary' => 'Lightly sparkling fermented tea with raspberry and blackcurrant.',
    'body' => '<p>We brew green tea for ten days, then add raspberry and blackcurrant juice. The result is fruity, a little sour and naturally sparkling.</p><p>Contains live cultures. Keep cold and do not shake.</p>',
    'alt' => 'Pink bottle of berry kombucha with a leaf label',
  ],
  'quinoa-power-bowl' => [
    'title' => 'Quinoa Power Bowl',
    'category' => 'bowls',
    'tags' => ['vegan', 'gluten-free', 'high-protein'],
    'price' => '8.90',
    'featured' => TRUE,
    'summary' => 'Quinoa, roasted sweet potato, chickpeas and a lemon tahini dressing.',
    'body' => '<p>A filling lunch bowl with tri-colour quinoa, roasted sweet potato, chickpeas, kale and pickled red onion.</p><p>The lemon tahini dressing comes in a separate pot, so the greens stay crisp.</p>',
    'alt' => 'Green bowl filled with colourful vegetables and grains',
  ],
  'mediterranean-lentil-bowl' => [
    'title' => 'Mediterranean Lentil Bowl',
    'category' => 'bowls',
    'tags' => ['vegetarian', 'high-protein'],
    'price' => '8.50',
    'featured' => FALSE,
    'summary' => 'Green lentils, roasted peppers, feta and herbs with bulgur.',
    'body' => '<p>Warm-spiced green lentils on bulgur wheat, with roasted peppers, cherry tomatoes, cucumber and crumbled feta.</p><p>Finished with parsley, mint and an olive oil and lemon dressing.</p>',
    'alt' => 'Terracotta bowl with lentils and vegetables',
  ],
  'teriyaki-tofu-bowl' => [
    'title' => 'Teriyaki Tofu Bowl',
    'category' => 'bowls',
    'tags' => ['vegan', 'dairy-free', 'high-protein'],
    'price' => '9.20',
    'featured' => TRUE,
    'summary' => 'Glazed tofu, brown rice, edamame and crunchy vegetables.',
    'body' => '<p>Baked tofu in a sticky teriyaki glaze, served on brown rice with edamame, carrot, red cabbage and spring onion.</p><p>Contains soy and sesame.</p>',
    'alt' => 'Blue bowl with tofu, rice and vegetables',
  ],
  'almond-date-bar' => [
    'title' => 'Almond Date Bar',
    'category' => 'snacks',
    'tags' => ['vegan', 'gluten-free', 'no-added-sugar'],
    'price' => '1.90',
    'featured' => FALSE,
    'summary' => 'Three ingredients: dates, almonds and a pinch of sea salt.',
    'body' => '<p>A soft, chewy bar sweetened only by dates. Good in a bag for a walk or after sport.</p><p>Contains almonds.</p>',
    'alt' => 'Two brown snack bars with nuts',
  ],
  'sea-salt-chickpea-crisps' => [
    'title' => 'Sea Salt Chickpea Crisps',
    'category' => 'snacks',
    'tags' => ['vegan', 'gluten-free', 'high-protein'],
    'price' => '2.20',
    'featured' => FALSE,
    'summary' => 'Baked, not fried, crisps made from chickpea flour.',
    'body' => '<p>Thin and crunchy crisps baked from chickpea flour and seasoned with sea salt. They have more protein and less fat than potato crisps.</p>',
    'alt' => 'Golden snack packs with a green band',
  ],
  'cocoa-hazelnut-bites' => [
    'title' => 'Cocoa Hazelnut Bites',
    'category' => 'snacks',
    'tags' => ['vegan', 'gluten-free'],
    'price' => '2.40',
    'featured' => TRUE,
    'summary' => 'Bite-sized balls of hazelnut, cocoa and crispy rice.',
    'body' => '<p>Roasted hazelnuts, raw cocoa and crispy rice, rolled into small bites. One pack holds six pieces.</p><p>Contains hazelnuts.</p>',
    'alt' => 'Dark chocolate bars with a yellow band',
  ],
  'spelt-banana-loaf' => [
    'title' => 'Spelt Banana Loaf',
    'category' => 'snacks',
    'tags' => ['vegetarian'],
    'price' => '2.60',
    'featured' => FALSE,
    'summary' => 'A thick slice of banana bread made with wholegrain spelt.',
    'body' => '<p>Ripe bananas, wholegrain spelt flour, eggs and walnuts, baked in small batches.</p><p>Contains gluten, eggs and walnuts.</p>',
    'alt' => 'Two slices of banana loaf',
  ],
  'mango-overnight-oats' => [
    'title' => 'Mango Overnight Oats',
    'category' => 'breakfast',
    'tags' => ['vegetarian'],
    'price' => '3.60',
    'featured' => FALSE,
    'summary' => 'Oats soaked in yoghurt overnight, topped with mango.',
    'body' => '<p>Rolled oats soaked overnight in yoghurt and milk, layered with mango purée and a few pumpkin seeds.</p><p>Ready to eat straight from the jar.</p>',
    'alt' => 'Glass jar with layers of oats and orange mango',
  ],
  'buckwheat-granola' => [
    'title' => 'Buckwheat Granola',
    'category' => 'breakfast',
    'tags' => ['vegan', 'gluten-free'],
    'price' => '5.40',
    'featured' => FALSE,
    'summary' => 'Crunchy toasted buckwheat with seeds and a little maple syrup.',
    'body' => '<p>Toasted buckwheat groats, sunflower and pumpkin seeds, coconut flakes and a light coating of maple syrup. A 350 g bag gives about ten breakfasts.</p>',
    'alt' => 'Jar of brown granola with red berries on top',
  ],
  'chia-coconut-pudding' => [
    'title' => 'Chia Coconut Pudding',
    'category' => 'breakfast',
    'tags' => ['vegan', 'gluten-free', 'dairy-free'],
    'price' => '3.40',
    'featured' => FALSE,
    'summary' => 'Chia seeds set in coconut milk with a berry layer.',
    'body' => '<p>Chia seeds soaked in coconut milk until thick and creamy, with a layer of blackberry compote.</p><p>Eat cold, for breakfast or dessert.</p>',
    'alt' => 'Jar of chia pudding with a purple berry layer',
  ],
];

$articles = [
  'green-shakshuka' => [
    'title' => 'Green shakshuka in 20 minutes',
    'type' => 'recipe',
    'created' => '2026-10-28 09:00',
    'body' => '<p>This version of the classic egg dish uses spinach, leek and peas instead of tomatoes. One pan, twenty minutes, very few dishes.</p><h2>Ingredients (2 portions)</h2><ul><li>1 leek, thinly sliced</li><li>200 g baby spinach</li><li>100 g frozen peas</li><li>4 eggs</li><li>50 g feta</li><li>Olive oil, salt, pepper, chilli flakes</li></ul><h2>Method</h2><ol><li>Soften the leek in olive oil for five minutes.</li><li>Add the spinach and peas and cook until the spinach wilts.</li><li>Make four hollows and crack an egg into each one.</li><li>Cover and cook for six to eight minutes, until the whites are set.</li><li>Finish with feta and chilli flakes.</li></ol>',
    'alt' => 'Plate with green vegetables and yellow eggs',
  ],
  'red-lentil-soup' => [
    'title' => 'Red lentil soup with lemon',
    'type' => 'recipe',
    'created' => '2026-10-14 09:00',
    'body' => '<p>Red lentils cook quickly and fall apart, so this soup turns creamy without any cream.</p><h2>Ingredients (4 portions)</h2><ul><li>250 g red lentils</li><li>1 onion and 1 carrot, chopped</li><li>2 cloves of garlic</li><li>1 tsp ground cumin</li><li>1.2 l vegetable stock</li><li>Juice of 1 lemon</li></ul><h2>Method</h2><ol><li>Fry the onion, carrot and garlic until soft.</li><li>Add the cumin, lentils and stock.</li><li>Simmer for 20 minutes, then blend until smooth.</li><li>Add the lemon juice and season to taste.</li></ol>',
    'alt' => 'Plate of red soup with herbs',
  ],
  'three-breakfast-smoothies' => [
    'title' => 'Three breakfast smoothies to try this week',
    'type' => 'recipe',
    'created' => '2026-09-30 09:00',
    'body' => '<p>Each smoothie takes five minutes and one blender. Add ice if your fruit is not frozen.</p><h2>Berry and oat</h2><p>A cup of frozen berries, two tablespoons of oats, a banana and 250 ml of oat drink.</p><h2>Green and fresh</h2><p>A handful of spinach, half a cucumber, a green apple and the juice of half a lime.</p><h2>Mango and ginger</h2><p>A cup of frozen mango, a thumb of fresh ginger, yoghurt and a little water.</p>',
    'alt' => 'Plate with pink, green and yellow fruit',
  ],
  'recyclable-bottles' => [
    'title' => 'Our drinks move to fully recyclable bottles',
    'type' => 'news',
    'created' => '2026-11-04 09:00',
    'body' => '<p>From next month, every Verde Kitchen drink will come in a bottle made from recycled plastic that can be recycled again.</p><p>The labels are now printed with water-based inks and peel off easily, so the bottles are simpler to sort.</p><p>Bottle prices stay the same.</p>',
    'alt' => 'Small plant growing in a pot',
  ],
  'autumn-menu' => [
    'title' => 'The autumn menu is here',
    'type' => 'news',
    'created' => '2026-10-07 09:00',
    'body' => '<p>Our autumn menu brings warming bowls, a new lentil soup and the return of the spelt banana loaf.</p><p>Everything on the menu is vegetarian, and most dishes are vegan. Ask our team about allergens in store.</p>',
    'alt' => 'Plant with two leaves in an orange pot',
  ],
];

// menu => [title, link URI]. "internal:" links point to paths on this site.
$menus = [
  'main' => [
    ['Home', 'internal:/'],
    ['Products', 'internal:/products'],
    ['Articles', 'internal:/articles'],
  ],
  'footer' => [
    ['Products', 'internal:/products'],
    ['Articles', 'internal:/articles'],
    ['Source code', 'https://github.com/IvanKhamar/verde-kitchen-drupal'],
  ],
];

// Banner blocks are content, but their placement (block.block.verde_home_*) is
// configuration that refers to them by UUID, so the UUIDs must stay fixed.
$banners = [
  'b2f1c6a0-5c0e-4f53-9a7e-1c2d3e4f5a60' => [
    'info' => 'Home hero',
    'variant' => 'hero',
    'heading' => 'Fresh food that feels good',
    'text' => 'Bowls, drinks and snacks made from simple ingredients. Everything is vegetarian, and most of it is vegan.',
    'link' => ['internal:/products', 'Browse products'],
    'image' => 'banner-hero',
    'alt' => 'Green bowl filled with colourful vegetables',
  ],
  'b2f1c6a0-5c0e-4f53-9a7e-1c2d3e4f5a61' => [
    'info' => 'Home promo',
    'variant' => 'promo',
    'heading' => 'The autumn menu is here',
    'text' => 'Warming bowls, a new lentil soup and the return of the spelt banana loaf.',
    // Replaced below with a link to the "autumn-menu" article.
    'link' => ['article:autumn-menu', 'See what is new'],
    'image' => 'banner-promo',
    'alt' => 'Jar with layers of orange and yellow fruit',
  ],
];

// --- Helpers ----------------------------------------------------------------

/**
 * Copies a demo image into the public files folder and returns its file entity.
 *
 * FileExists::Replace reuses the existing file entity on a second run,
 * so running the script twice does not create duplicate files.
 */
function verde_demo_image(string $slug, string $directory): FileInterface {
  $source = __DIR__ . "/images/$slug.png";
  $data = file_get_contents($source);
  if ($data === FALSE) {
    throw new RuntimeException("Missing demo image: $source");
  }
  $destination = "public://$directory";
  \Drupal::service('file_system')->prepareDirectory($destination, FileSystemInterface::CREATE_DIRECTORY);
  return \Drupal::service('file.repository')->writeData($data, "$destination/$slug.png", FileExists::Replace);
}

/**
 * Creates the terms of one vocabulary and returns their IDs keyed by slug.
 *
 * @return array<string, int>
 */
function verde_demo_terms(string $vid, array $names): array {
  $ids = [];
  $weight = 0;
  foreach ($names as $slug => $name) {
    $term = Term::create(['vid' => $vid, 'name' => $name, 'weight' => $weight++]);
    $term->save();
    $ids[$slug] = (int) $term->id();
  }
  return $ids;
}

// --- Clean up ---------------------------------------------------------------

$entity_type_manager = \Drupal::entityTypeManager();

$node_storage = $entity_type_manager->getStorage('node');
$node_ids = $node_storage->getQuery()
  ->accessCheck(FALSE)
  ->condition('type', ['product', 'article'], 'IN')
  ->execute();
$node_storage->delete($node_storage->loadMultiple($node_ids));

$term_storage = $entity_type_manager->getStorage('taxonomy_term');
$term_ids = $term_storage->getQuery()
  ->accessCheck(FALSE)
  ->condition('vid', ['product_category', 'dietary_tag'], 'IN')
  ->execute();
$term_storage->delete($term_storage->loadMultiple($term_ids));

$link_storage = $entity_type_manager->getStorage('menu_link_content');
$link_storage->delete($link_storage->loadByProperties(['menu_name' => array_keys($menus)]));

// Banners are updated, not deleted: deleting a custom block also deletes its
// placements (block.block.verde_home_*), because they depend on it.

// --- Create -----------------------------------------------------------------

$category_ids = verde_demo_terms('product_category', $categories);
$tag_ids = verde_demo_terms('dietary_tag', $dietary_tags);

// Fixed dates keep the order of products stable (useful for screenshots).
$created = strtotime('2026-09-01 09:00');
foreach ($products as $slug => $product) {
  $image = verde_demo_image($slug, 'products');
  Node::create([
    'type' => 'product',
    'title' => $product['title'],
    'uid' => 1,
    'status' => 1,
    'promote' => $product['featured'],
    'created' => $created++,
    'body' => [
      'value' => $product['body'],
      'summary' => $product['summary'],
      'format' => 'basic_html',
    ],
    'field_image' => ['target_id' => $image->id(), 'alt' => $product['alt']],
    'field_category' => $category_ids[$product['category']],
    'field_dietary_tags' => array_map(fn(string $tag) => $tag_ids[$tag], $product['tags']),
    'field_price' => $product['price'],
  ])->save();
}

$article_ids = [];
foreach ($articles as $slug => $article) {
  $image = verde_demo_image($slug, 'articles');
  $node = Node::create([
    'type' => 'article',
    'title' => $article['title'],
    'uid' => 1,
    'status' => 1,
    'promote' => FALSE,
    'created' => strtotime($article['created']),
    'body' => ['value' => $article['body'], 'format' => 'basic_html'],
    'field_image' => ['target_id' => $image->id(), 'alt' => $article['alt']],
    'field_article_type' => $article['type'],
  ]);
  $node->save();
  $article_ids[$slug] = $node->id();
}

foreach ($menus as $menu => $links) {
  foreach ($links as $weight => [$title, $uri]) {
    MenuLinkContent::create(['menu_name' => $menu, 'title' => $title, 'link' => ['uri' => $uri], 'weight' => $weight])->save();
  }
}

foreach ($banners as $uuid => $banner) {
  [$uri, $link_title] = $banner['link'];
  if (str_starts_with($uri, 'article:')) {
    // "entity:" links keep working when the article's URL alias changes.
    $uri = 'entity:node/' . $article_ids[substr($uri, strlen('article:'))];
  }
  $image = verde_demo_image($banner['image'], 'banners');
  $block = \Drupal::service('entity.repository')->loadEntityByUuid('block_content', $uuid)
    ?? BlockContent::create(['type' => 'banner', 'uuid' => $uuid]);
  $block->set('info', $banner['info']);
  $block->set('field_variant', $banner['variant']);
  $block->set('field_heading', $banner['heading']);
  $block->set('field_text', $banner['text']);
  $block->set('field_link', ['uri' => $uri, 'title' => $link_title]);
  $block->set('field_image', ['target_id' => $image->id(), 'alt' => $banner['alt']]);
  $block->save();
}

printf(
  "Demo content created: %d categories, %d dietary tags, %d products, %d articles, %d menu links, %d banners.\n",
  count($category_ids),
  count($tag_ids),
  count($products),
  count($articles),
  count($menus['main']) + count($menus['footer']),
  count($banners),
);
