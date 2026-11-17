/**
 * Helpers shared by the component stories (*.stories.js).
 *
 * Drupal adds an "attributes" object to every component; Storybook has no
 * Drupal, so stories create one with the drupal-attribute package, which has
 * the same addClass() / setAttribute() API.
 */
import DrupalAttribute from 'drupal-attribute';

export const withAttributes = (args) => ({ attributes: new DrupalAttribute(), ...args });

// Demo images from the project (original illustrations, see CREDITS.md).
export { default as smoothieImage } from '../../../../../scripts/demo-content/images/green-glow-smoothie.png';
export { default as bowlImage } from '../../../../../scripts/demo-content/images/quinoa-power-bowl.png';
export { default as heroImage } from '../../../../../scripts/demo-content/images/banner-hero.png';
export { default as promoImage } from '../../../../../scripts/demo-content/images/banner-promo.png';
export { default as articleImage } from '../../../../../scripts/demo-content/images/green-shakshuka.png';

/** An <img> as a slot value, the way Drupal would pass a rendered image field. */
export const image = (src, alt) => `<img src="${src}" alt="${alt}" width="640" height="480">`;
