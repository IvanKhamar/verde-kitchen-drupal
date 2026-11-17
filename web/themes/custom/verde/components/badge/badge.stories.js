import { withAttributes } from '../story-helpers.js';
import badge from './badge.twig';
import './badge.scss';

export default {
  title: 'Components/Badge',
  tags: ['autodocs'],
  render: (args) => badge(withAttributes(args)),
  argTypes: {
    label: { control: 'text' },
    variant: { control: 'inline-radio', options: ['default', 'accent'] },
  },
  args: { label: 'Vegan', variant: 'default' },
};

export const Default = {};

export const Accent = { args: { label: 'Recipe', variant: 'accent' } };
