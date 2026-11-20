import messages from './messages.twig';
import './messages.scss';

export default {
  title: 'Components/Messages',
  tags: ['autodocs'],
  render: (args) => messages(args),
};

export const Status = {
  args: {
    type: 'status',
    heading: 'Status message',
    heading_id: 'messages-status',
    content: '<p>Thank you! We have your message and will answer within two working days.</p>',
  },
};

// Inline Form Errors writes this summary, with links to the fields.
export const ErrorSummary = {
  args: {
    type: 'error',
    heading: 'Error message',
    heading_id: 'messages-error',
    content: '<p>2 errors have been found: <a href="#name">Name</a>, <a href="#email">Email</a></p>',
  },
};

export const Warning = {
  args: {
    type: 'warning',
    heading: 'Warning message',
    heading_id: 'messages-warning',
    content: '<p>The shop is closed on public holidays.</p>',
  },
};
