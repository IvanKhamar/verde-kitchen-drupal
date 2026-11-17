import '../badge/badge.scss';
import card from '../card/card.twig';
import '../card/card.scss';
import { bowlImage, image, smoothieImage, withAttributes } from '../story-helpers.js';
import teaserGrid from './teaser-grid.twig';
import './teaser-grid.scss';

const cards = [
  ['Green Glow Smoothie', 'Drinks', '€3.90', ['Vegan', 'Gluten-free'], smoothieImage],
  ['Quinoa Power Bowl', 'Bowls', '€8.90', ['Vegan', 'High protein'], bowlImage],
  ['Berry Kombucha', 'Drinks', '€3.20', ['Vegan'], smoothieImage],
];

// The items slot gets <li> elements, as views-view-unformatted.html.twig builds them.
const items = cards
  .map(
    ([title, meta, price, badges, src]) =>
      `<li class="teaser-grid__item">${card(
        withAttributes({ title, url: '#', meta, price, badges, heading_level: 3, image: image(src, title) }),
      )}</li>`,
  )
  .join('');

export default {
  title: 'Components/Teaser grid',
  tags: ['autodocs'],
  render: (args) => teaserGrid(withAttributes(args)),
  argTypes: { items: { control: false, description: 'Slot: the <li> grid items.' } },
  args: { heading: 'Featured products', link_label: 'All products', link_url: '#products', items },
};

export const WithHeading = {};

export const WithoutHeading = { args: { heading: '', link_label: '', link_url: '' } };
