import { withAttributes } from '../story-helpers.js';
import button from './button.twig';
import './button.scss';

export default {
  title: 'Components/Button',
  tags: ['autodocs'],
  render: (args) => button(withAttributes(args)),
  argTypes: {
    label: { control: 'text' },
    url: { control: 'text', description: 'Leave empty to render a <button>.' },
    variant: { control: 'inline-radio', options: ['primary', 'secondary'] },
    type: { control: 'inline-radio', options: ['button', 'submit'] },
  },
  args: { label: 'Browse products', url: '#products', variant: 'primary' },
};

export const PrimaryLink = {};

export const SecondaryLink = { args: { label: 'See what is new', variant: 'secondary' } };

export const ButtonElement = { args: { label: 'Try again', url: '', type: 'button' } };
