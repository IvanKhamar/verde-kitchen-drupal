/**
 * Global setup for every story: the theme's base styles (tokens, typography)
 * and the small part of the Drupal JavaScript API that component scripts use.
 */
import once from '@drupal/once';
import '../web/themes/custom/verde/src/scss/global.scss';

// Drupal core normally provides these globals (core/drupal, core/once).
window.once = once;
window.Drupal = window.Drupal ?? {
  behaviors: {},
  t: (text) => text,
  attachBehaviors(context = document) {
    Object.values(this.behaviors).forEach((behavior) => behavior.attach?.(context));
  },
};

export default {
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    a11y: {
      // Fail the a11y check of a story on violations (shown in the a11y panel).
      test: 'error',
    },
  },
};
