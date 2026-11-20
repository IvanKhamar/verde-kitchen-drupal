/**
 * @file
 * Moves focus to the messages after a page load that shows them, usually
 * right after a form was sent: the result or the error summary is then the
 * first thing a keyboard or screen reader user meets.
 */
((Drupal, once) => {
  Drupal.behaviors.verdeMessages = {
    attach(context) {
      // Only the first group, and only once per page.
      const [first] = once('verde-messages', '[data-messages]', context);
      first?.focus();
    },
  };
})(Drupal, once);
