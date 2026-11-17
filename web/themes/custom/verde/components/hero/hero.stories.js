import '../button/button.scss';
import { heroImage, image, promoImage, withAttributes } from '../story-helpers.js';
import hero from './hero.twig';
import './hero.scss';

export default {
  title: 'Components/Hero',
  tags: ['autodocs'],
  render: (args) => hero(withAttributes(args)),
  argTypes: {
    variant: { control: 'inline-radio', options: ['hero', 'promo'] },
    image: { control: false, description: 'Slot: a rendered image field.' },
  },
  args: {
    heading: 'Fresh food that feels good',
    text: 'Bowls, drinks and snacks made from simple ingredients. Everything is vegetarian, and most of it is vegan.',
    cta_label: 'Browse products',
    cta_url: '#products',
    variant: 'hero',
    image: image(heroImage, 'Green bowl filled with colourful vegetables'),
  },
};

export const Hero = {};

export const Promo = {
  args: {
    heading: 'The autumn menu is here',
    text: 'Warming bowls, a new lentil soup and the return of the spelt banana loaf.',
    cta_label: 'See what is new',
    variant: 'promo',
    image: image(promoImage, 'Jar with layers of orange and yellow fruit'),
  },
};
