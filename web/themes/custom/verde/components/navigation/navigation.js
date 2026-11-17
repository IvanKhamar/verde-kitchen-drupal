/**
 * @file
 * Mobile toggle for the navigation component.
 *
 * Drupal.behaviors: Drupal calls attach() on page load and again whenever new
 * content is added with AJAX. once() makes sure each <nav> is set up a single
 * time, even if attach() runs many times.
 */
((Drupal, once) => {
  Drupal.behaviors.verdeNavigation = {
    attach(context) {
      once('verde-navigation', '[data-navigation]', context).forEach((nav) => {
        const toggle = nav.querySelector('.navigation__toggle');
        const list = nav.querySelector('.navigation__list');
        if (!toggle || !list) {
          return;
        }

        const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
        const setOpen = (open) => {
          toggle.setAttribute('aria-expanded', String(open));
          nav.classList.toggle('is-open', open);
        };

        // The layout (button shown, list collapsed) comes from CSS: see navigation.scss.

        toggle.addEventListener('click', () => setOpen(!isOpen()));

        // Escape closes the menu and returns focus to the button.
        nav.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && isOpen()) {
            setOpen(false);
            toggle.focus();
          }
        });

        // Close the menu when keyboard focus moves out of it.
        nav.addEventListener('focusout', (event) => {
          if (isOpen() && !nav.contains(event.relatedTarget)) {
            setOpen(false);
          }
        });
      });
    },
  };
})(Drupal, once);
