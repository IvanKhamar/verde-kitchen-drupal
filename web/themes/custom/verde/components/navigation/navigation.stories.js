import { withAttributes } from '../story-helpers.js';
import './navigation.js';
import './navigation.scss';
import navigation from './navigation.twig';

export default {
  title: 'Components/Navigation',
  tags: ['autodocs'],
  // The mobile panel is positioned against the header, as on the site.
  decorators: [(story) => `<header class="site-header"><div class="site-header__inner">${story()}</div></header>`],
  render: (args) => navigation(withAttributes(args)),
  // Drupal runs behaviors after the page loads; Storybook does it after each render.
  play: ({ canvasElement }) => window.Drupal.attachBehaviors(canvasElement),
  args: {
    label: 'Main',
    items: [
      { title: 'Home', url: '#', active: true },
      { title: 'Products', url: '#products', active: false },
      { title: 'Articles', url: '#articles', active: false },
    ],
  },
};

export const WideScreen = {};

// On a narrow viewport the links collapse behind the "Menu" button.
export const Phone = { globals: { viewport: { value: 'mobile1' } } };
