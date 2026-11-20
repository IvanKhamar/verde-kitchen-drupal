import formField from './form-field.twig';
import './form-field.scss';

// Drupal renders the label and the control; here they are written by hand.
const input = (id, extra = '') => `<input type="text" id="${id}" name="${id}" ${extra}>`;

export default {
  title: 'Components/Form field',
  tags: ['autodocs'],
  render: (args) => formField(args),
};

export const Text = {
  args: {
    type: 'textfield',
    label: '<label for="name">Name</label>',
    control: input('name', 'autocomplete="name"'),
  },
};

export const WithHint = {
  args: {
    type: 'textarea',
    label: '<label for="message">Message</label>',
    description: '<div id="message--description" class="description">From 10 to 2000 characters.</div>',
    control: '<textarea id="message" rows="5" aria-describedby="message--description"></textarea>',
  },
};

export const WithError = {
  args: {
    type: 'email',
    label: '<label for="email">Email</label>',
    error: 'The email address olena@ is not valid. Use the format name@example.com.',
    error_id: 'email--error',
    control: '<input type="email" id="email" value="olena@" aria-invalid="true" aria-describedby="email--error">',
  },
};

export const Checkbox = {
  args: {
    type: 'checkbox',
    label_position: 'after',
    label: '<label for="consent">I agree that Verde Kitchen processes my data to answer my message.</label>',
    description:
      '<div id="consent--description" class="description">How we handle it: <a href="#">privacy notice</a>.</div>',
    control: '<input type="checkbox" id="consent" aria-describedby="consent--description">',
  },
};
