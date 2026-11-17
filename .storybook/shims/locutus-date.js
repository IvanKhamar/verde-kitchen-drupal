// drupal-twig-extensions imports a default export from 'locutus/php/datetime/date.js'
// (locutus 2). The project overrides locutus to 3.x, which fixes a critical
// security advisory (npm audit) but exports date() by name, so this shim
// re-exports it as the default. Used only by Twig's format_date filter.
export { date as default } from 'locutus/php/datetime/date';
