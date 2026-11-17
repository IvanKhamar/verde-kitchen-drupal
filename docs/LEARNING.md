# Learning guide: Drupal theming in this project

A step-by-step walk through the ideas this project uses, with pointers to the real code, and
interview questions with short answers. Read it with the code open.

Before you start, turn on Twig debugging. Drupal then writes HTML comments that show which
template rendered each part of the page, and which other file names it would accept:

```bash
ddev drush theme:dev on    # Twig debug on, render caches off
ddev drush theme:dev off   # back to normal
```

(Or: Admin > Configuration > Development > Development settings.) Open a product page,
"View page source", and look for `<!-- THEME DEBUG -->` and `FILE NAME SUGGESTIONS`.

## 1. How Drupal turns content into HTML

Drupal never builds HTML directly from the database. It builds **render arrays**: nested PHP
arrays that describe what to show (`#theme`, `#type`, `#cache`, `#attached`…). At the end of
the request, the renderer turns them into HTML, template by template.

```text
node (entity) → view builder → render array → theme hook "node"
  → preprocess functions → template node--product--full.html.twig → HTML
```

What decides the parts:

| Question                         | Answer is in…                                           |
| -------------------------------- | ------------------------------------------------------- |
| Which fields, in which order?    | The **view display** (Manage display), in `config/sync` |
| How is a field shown?            | The field **formatter** (responsive image, label…)      |
| Which template?                  | **Theme hook suggestions** (section 3)                  |
| Which variables in the template? | **Preprocess functions** (section 4)                    |
| Which CSS and JS?                | **Libraries** attached on the way (section 6)           |

## 2. The theme files

- `verde.info.yml`: name, `base theme: false`, **regions**, and libraries for every page.
  A region is a slot in `page.html.twig` (`{{ page.header }}`) where blocks are placed.
- `verde.libraries.yml`: groups of CSS/JS files. Nothing loads unless a library is attached.
- `verde.theme`: PHP for the theme: preprocess functions, suggestion hooks, alter hooks.
- `verde.breakpoints.yml`: media queries for responsive image styles.
- `templates/`: Twig files that override Drupal's default templates.
- `components/`: Single Directory Components.

## 3. Templates and their suffixes (suggestions)

For every theme hook Drupal builds a list of **suggestions**, from specific to general, and
uses the first template file that exists. For a node:

```text
node--{nid}--{view_mode}   node--1--full.html.twig
node--{nid}                node--1.html.twig
node--{type}--{view_mode}  node--product--full.html.twig   ← this project (product page)
node--{type}               node--product.html.twig
node--{view_mode}          node--teaser.html.twig          ← this project (all cards)
node                       node.html.twig
```

A lesson learned here: the product page template was first called `node--product.html.twig`.
It is **more specific** than `node--teaser`, so product cards started to use the full page
template. The fix was the name `node--product--full.html.twig`.

Other suffixes in the project:

- `block--system-branding-block` (by block plugin), `block--system-menu-block--main` (plugin
  and derivative), `block--banner` (a suggestion the theme adds itself, see below);
- `menu--main` (menu machine name);
- `views-view--products--page-catalog` (view ID and display ID).

Adding your own suggestions: `verde_theme_suggestions_block_alter()` adds `block__BUNDLE` for
custom blocks, so every "banner" block uses `block--banner.html.twig`. In PHP the separator is
`__`; in file names it is `--`.

## 4. Preprocess functions

`THEME_preprocess_HOOK(array &$variables)` runs before the template. Whatever it puts in
`$variables` becomes a Twig variable. The functions in `verde.theme`:

| Function                                    | What it prepares                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `verde_preprocess_html()`                   | A body class per node type                                             |
| `verde_preprocess_node()`                   | Card props: title, URL, price, badges, meta, heading level; cache tags |
| `verde_preprocess_node__teaser()`           | Passes the "first row" flag to the image field                         |
| `verde_preprocess_field()`                  | Responsive image style, `loading`, `fetchpriority`                     |
| `verde_preprocess_menu__main()`             | Menu tree → plain `[{title, url, active}]` for the component           |
| `verde_preprocess_views_view_unformatted()` | Section heading and link; eager first cards                            |
| `verde_preprocess_block()`                  | Hero props for banner blocks                                           |

Rule of thumb used everywhere: **PHP prepares plain data, Twig decides the markup.** Objects
such as `Url` or entities are turned into strings and arrays before they reach a component.

Two Drupal details to remember:

- **Cacheability.** If preprocess reads data from another entity (a term), add that entity's
  cache tags, or the cached HTML will not update when the term changes
  (`CacheableMetadata::addCacheableDependency()` in `verde_preprocess_node()`). If the output
  depends on the request, add a cache context (`url.path.is_front`).
- **strict_types.** Values from the database are strings. `date()` needs an `int`, so
  `(int) $node->getCreatedTime()`; without the cast, PHP threw a TypeError here.

## 5. Twig in Drupal

- **Autoescape:** every `{{ variable }}` is escaped (`<` becomes `&lt;`). Render arrays and
  `Markup` objects are already safe and printed as they are. Never use `|raw` on user data.
- **`attributes`:** an object, not a string: `attributes.addClass('card')`,
  `.setAttribute('aria-label', …)`. Every template and component gets one.
- **Useful filters:** `|t` (translate), `|clean_class`, `|clean_unique_id` (unique `id` for
  `aria-labelledby`), `|without('field_image')` (print the other fields), `|render`.
- **`attach_library('verde/product')`** in a template attaches CSS/JS only where it is needed.
- **`{% extends %}` + `{% block %}`:** `block--system-branding-block` reuses `block.html.twig`
  and replaces only its `content` block.
- **`{% set items %}…{% endset %}`** captures markup into a variable (used to fill a component
  slot in `views-view-unformatted.html.twig`).

## 6. Libraries

```yaml
# verde.libraries.yml
catalog-filter:
  css:
    theme:
      dist/css/catalog-filter.css: {}
  js:
    dist/js/catalog-filter.js: { minified: true }
  dependencies:
    - core/drupal
    - core/once
    - core/components.verde--button
```

Ways to attach a library: the theme's `.info.yml` (every page), `{{ attach_library() }}` in
Twig, `#attached` in a render array, or automatically for an SDC component. Drupal then
**aggregates** the files of a page into a few bundles.

One lesson: React renders the same markup as the `button` component, but the component's CSS
is only attached where Twig renders the component. The widget library therefore depends on
`core/components.verde--button`.

## 7. Single Directory Components (SDC)

```yaml
# components/card/card.component.yml (shortened)
props:
  type: object
  required: [title, url]
  properties:
    title: { type: string }
    heading_level: { type: integer, enum: [2, 3, 4] }
    badges: { type: array, items: { type: string } }
slots:
  image: {}
  summary: {}
```

```twig
{# node--teaser.html.twig #}
{{ include('verde:card', card|merge({
  image: content.field_image,
  summary: content.body,
}), with_context = false) }}
```

- **Props** are plain values with a schema. When PHP assertions are on (DDEV), Drupal checks
  them and throws an error for a wrong type, which finds bugs early.
- **Slots** take any markup. Here they receive rendered fields, so the image keeps its
  responsive image style.
- `with_context = false` gives the component only what is passed, nothing from the template.
- CSS and JS files in the folder are attached automatically, only where the component is used.

## 8. Views and blocks

- **Views** list content: `products` (catalog + featured on the home page) and `articles`
  (listing + "Latest" block). The display ID matters for templates (`page_catalog`) and
  preprocess (`$view->current_display`).
- **Blocks** are placed in regions (configuration: `block.block.*`), with visibility
  conditions such as "only on `<front>`".
- **Custom blocks** (`block_content`) hold editable content. The banners are custom blocks; their
  placement refers to them by UUID, so the demo script keeps the UUIDs fixed. Deleting a
  custom block also deletes its placements (a config dependency), which happened here once.

## 9. How React gets its data

1. The catalog template prints `<div data-catalog-filter data-api-base="/jsonapi" …>` and
   attaches `verde/catalog-filter`.
2. `index.jsx` registers `Drupal.behaviors.verdeCatalogFilter`. Drupal calls `attach()` on
   page load and after AJAX; `once()` makes sure React mounts once.
3. `CatalogFilter.jsx` calls JSON:API through `api.js`:

   ```text
   /jsonapi/node/product
     ?filter[status]=1
     &filter[category][condition][path]=field_category.id
     &filter[category][condition][value]=<term UUID>
     &fields[node--product]=title,path,body,field_price,…,card_image_url
     &sort=title
   ```

4. Dietary tags are filtered in the browser ("all selected tags"); see `filterByTags()`.
5. Card images use `card_image_url`, a computed field from the `verde_catalog` module.

## 10. Performance, accessibility, SEO in practice

- **LCP image:** never lazy. `loading="eager"` + `fetchpriority="high"` for the hero and the
  main image (`verde_preprocess_field()`).
- **CLS:** reserve space for things that appear later. The mobile menu and the filter get
  their final layout from CSS with `@media (scripting: enabled)` before any script runs.
- **Responsive images:** `srcset` lists files, `sizes` says how wide the image is on screen.
- **Accessibility:** skip link, landmarks, one `<h1>`, no skipped heading levels, visible
  focus, contrast checked per colour pair, live region for filter results.
- **SEO:** Pathauto, Metatag, Open Graph, JSON-LD (encoded with `JSON_HEX_TAG`).

## 11. Try it yourself

1. Add a `field--field-price.html.twig` template that wraps the price in `<data value="…">`.
   Check with Twig debug that Drupal picks it.
2. Add a `variant: outline` to the badge component. Update the schema first, then the CSS.
3. Show the product category as a badge on article cards: what would you change in
   `verde_preprocess_node()`? Which cache tags are needed?
4. Add "Sort by price" to the React widget. Which JSON:API parameter is it?
5. Make the `teaser-grid` heading level a prop. Where would the value come from?

## Interview questions

**1. What is the difference between a template and a preprocess function?**
A preprocess function (PHP) prepares variables; the template (Twig) turns them into markup.
`verde_preprocess_node()` computes the formatted price; `card.twig` decides where it goes.

**2. How does Drupal choose a template? How do you add your own suggestion?**
It builds a list of suggestions from specific to general (`node--product--full`, …,
`node`) and uses the first file that exists. Add suggestions with
`hook_theme_suggestions_HOOK_alter()`, as `verde_theme_suggestions_block_alter()` does for
block types.

**3. How do you add CSS or JS to only one page type?**
Define a library and attach it where it is needed: `{{ attach_library('verde/product') }}` in
`node--product--full.html.twig`, or rely on SDC, which attaches component assets
automatically. The React bundle is only on `/products`.

**4. What are `Drupal.behaviors` and `once()`? Why not `DOMContentLoaded`?**
Behaviors are run by Drupal on page load and again whenever new content arrives through AJAX,
with that content as `context`. `once()` marks processed elements so the code runs once per
element. `DOMContentLoaded` fires only once and misses AJAX content.

**5. How does Twig protect against XSS in Drupal?**
Autoescape: printed variables are HTML-escaped. Render arrays and `Markup` objects are
sanitised by Drupal. Avoid `|raw` on user input. In JSON-LD this project uses
`JSON_HEX_TAG`, because Twig escaping does not apply inside a `<script>` built in PHP.

**6. What are cache tags and cache contexts? Give an example.**
Tags say what the output depends on (`taxonomy_term:3`); saving that entity invalidates the
cached output. Contexts say what it varies by (`url.path.is_front`). Cards use both: term tags
for dietary tags, the front-page context for the heading level.

**7. What are Single Directory Components, and why use them?**
A component folder with metadata (props schema, slots), Twig, CSS and JS. Assets load
automatically where the component is used; props are validated; components are reusable and
independent of Drupal entities, like components in a design system.

**8. Props or slots?**
Props for plain, typed values (title, URL, variant); slots for markup that Drupal renders
(an image field with its image style, formatted text).

**9. How do you put a React app into a Drupal page?**
A mount element in a template with settings in `data-*` attributes (or `drupalSettings`), a
library with the bundle, and a behavior that calls `createRoot()` inside `once()`. Keep a
server-rendered fallback for no-JS and API errors.

**10. How do you filter JSON:API? What surprised you?**
`filter[name][condition][path|operator|value]`, plus `fields[]` for smaller responses and
`include` for related entities. Two conditions on the same multi-value field (tag A **and**
tag B) returned nothing: Drupal joins the field table once, and one row holds one value. The
widget filters tags in the browser instead.

**11. How did you make images fast?**
Responsive image styles with `srcset` and `sizes`, WebP, `width`/`height` attributes, `lazy`
below the fold, `eager` and `fetchpriority="high"` for the LCP image.

**12. What was the biggest Lighthouse problem and how did you fix it?**
CLS 0.32 on every page: the mobile menu collapsed only after its script ran. CSS now sets the
JavaScript layout with `@media (scripting: enabled)`, and the filter's space is reserved:
CLS 0. On the catalog, React replaced the painted list with identical cards and delayed LCP;
now the server list stays until a filter is used.

**13. How do you make a mobile menu accessible?**
A real `<button>` with `aria-expanded` and `aria-controls`, a `<nav>` with a label, links in a
list, Escape to close and return focus, visible focus styles, 44 px targets. Not
`role="menu"`: that is for application menus with arrow-key navigation.

**14. How do you announce dynamic results to screen readers?**
A live region (`role="status"`, polite) that exists in the DOM before its text changes; the
widget updates it with "3 products found".

**15. How does configuration management work?**
Settings are exported to YAML (`drush config:export`) and committed; other environments import
them (`config:import`) or install from them (`site:install --existing-config`). Content is
not configuration: it is created by a script or migrated.

**16. How do you keep secrets out of the repository?**
`settings.php` has no credentials; DDEV writes `settings.ddev.php` (git-ignored), the hash
salt comes from the environment, gitleaks scans every push, and GitHub push protection is on.

**17. Where does SEO metadata come from?**
Metatag defaults with tokens (`[node:summary]`, `[node:field_image:social:url]`), Metatag
Views for listings, Pathauto for clean URLs, and JSON-LD built in `verde_page_attachments_alter()`.

**18. How do you check code quality?**
ESLint (with React, hooks and JSX accessibility rules), Stylelint (SCSS, BEM class names),
Prettier, PHP_CodeSniffer with the Drupal standards, unit tests for the API helpers, an
install test, and Lighthouse + axe, all in GitHub Actions.

**19. What is the difference between Sass variables and CSS custom properties?**
Sass variables exist only at build time; custom properties exist in the browser and can
change at runtime or per component. Tokens are Sass maps turned into custom properties;
breakpoints stay in Sass because `var()` does not work in `@media`.

**20. Why no base theme?**
The theme controls every line of markup it overrides, and nothing extra is loaded. The cost:
more templates to write. A base theme or the Starterkit generator is a good choice when a
project needs many templates quickly.
