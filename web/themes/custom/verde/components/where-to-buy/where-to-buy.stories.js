import whereToBuy from './where-to-buy.twig';
import './where-to-buy.scss';

const strings = {
  heading: 'Where to buy',
  online_heading: 'Online',
  stores_heading: 'In stores',
  empty_text: 'Not in shops yet. Check back soon.',
  external_hint: '(external site)',
};

export default {
  title: 'Components/Where to buy',
  tags: ['autodocs'],
  decorators: [(story) => `<div style="max-width: 32rem">${story()}</div>`],
  render: (args) => whereToBuy(args),
  args: {
    ...strings,
    online: [
      { name: 'GreenBasket', url: 'https://www.example.com/greenbasket', label: 'Buy at GreenBasket' },
      { name: 'Daily Box', url: 'https://www.example.com/daily-box', label: 'Buy at Daily Box' },
    ],
    stores: [
      { name: 'FreshCorner', cities: 'Lviv, Kyiv, Kharkiv' },
      { name: 'Market 37', cities: 'Lviv, Odesa' },
    ],
  },
};

export const OnlineAndStores = {};

export const OnlyStores = { args: { online: [] } };

export const NotInShops = { args: { online: [], stores: [] } };
