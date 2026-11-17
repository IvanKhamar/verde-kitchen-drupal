/**
 * Storybook: a catalogue of the theme's Single Directory Components.
 *
 * Storybook renders the components' real Twig templates in the browser, without
 * a running Drupal site: vite-plugin-twig-drupal compiles *.twig files with
 * Twig.js and adds Drupal's Twig extensions (t, clean_unique_id, attributes…).
 * The namespace "verde" maps the SDC syntax include('verde:card') to
 * components/card/card.twig, as Drupal does.
 */
import path from 'node:path';
import twig from 'vite-plugin-twig-drupal';

const components = path.resolve(import.meta.dirname, '../web/themes/custom/verde/components');

// Drupal's |clean_unique_id filter (Html::getUniqueId()), which the Twig
// extensions package does not include: a clean HTML id, with "--2", "--3"…
// added when the same id is used again on the page.
const cleanUniqueId = (twigInstance) => {
  const seen = new Map();
  twigInstance.extendFilter('clean_unique_id', (value) => {
    const id = String(value)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const count = (seen.get(id) ?? 0) + 1;
    seen.set(id, count);
    return count === 1 ? id : `${id}--${count}`;
  });
};

export default {
  stories: ['../web/themes/custom/verde/components/**/*.stories.js'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: { name: '@storybook/html-vite', options: {} },
  core: { disableTelemetry: true },
  async viteFinal(config) {
    config.plugins = [
      ...(config.plugins ?? []),
      twig({ namespaces: { verde: components }, functions: { cleanUniqueId } }),
    ];
    config.resolve ??= {};
    config.resolve.alias = [
      ...[config.resolve.alias ?? []].flat(),
      // See shims/locutus-date.js.
      { find: 'locutus/php/datetime/date.js', replacement: path.resolve(import.meta.dirname, 'shims/locutus-date.js') },
    ];
    return config;
  },
};
