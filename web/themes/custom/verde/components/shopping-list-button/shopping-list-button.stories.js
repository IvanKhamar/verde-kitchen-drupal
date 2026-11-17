import shoppingListButton from './shopping-list-button.twig';
import './shopping-list-button.scss';

export default {
  title: 'Components/Shopping list button',
  tags: ['autodocs'],
  render: (args) => shoppingListButton(args),
  args: {
    product_id: '0b8e6c2e-3d6f-4f7a-9c1e-2a4b6c8d0e1f',
    product_title: 'Green Glow Smoothie',
    add_label: 'Add to list',
    remove_label: 'Remove from list',
  },
};

export const NotOnTheList = {};

// shopping-list.js sets this state on the page; here it is shown statically.
export const OnTheList = {
  play: ({ canvasElement }) => {
    const button = canvasElement.querySelector('.shopping-list-button');
    button.classList.add('is-in-list');
    button.querySelector('[data-label="add"]').hidden = true;
    button.querySelector('[data-label="remove"]').hidden = false;
  },
};
