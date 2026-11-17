import '../badge/badge.scss';
import { articleImage, image, smoothieImage, withAttributes } from '../story-helpers.js';
import card from './card.twig';
import './card.scss';

export default {
  title: 'Components/Card',
  tags: ['autodocs'],
  // A card fills its grid cell; give it the width of one column.
  decorators: [(story) => `<div style="max-width: 20rem">${story()}</div>`],
  render: (args) => card(withAttributes(args)),
  argTypes: {
    heading_level: { control: 'inline-radio', options: [2, 3, 4] },
    badges: { control: 'object' },
    image: { control: false, description: 'Slot: a rendered image field.' },
    summary: { control: 'text', description: 'Slot: the summary text.' },
  },
  args: {
    title: 'Green Glow Smoothie',
    url: '#product',
    heading_level: 3,
    meta: 'Drinks',
    price: '€3.90',
    badges: ['Vegan', 'Gluten-free', 'Dairy-free'],
    image: image(smoothieImage, 'Green smoothie bottle with a leaf on its label'),
    summary: 'Spinach, apple, cucumber and lime, blended cold for a fresh start to the day.',
  },
};

export const Product = {};

export const Article = {
  args: {
    title: 'Green shakshuka in 20 minutes',
    meta: 'Recipe · 28 October 2026',
    price: '',
    badges: [],
    image: image(articleImage, 'Plate with green vegetables and yellow eggs'),
    summary: 'This version of the classic egg dish uses spinach, leek and peas instead of tomatoes.',
  },
};

export const WithoutImage = { args: { image: '' } };
