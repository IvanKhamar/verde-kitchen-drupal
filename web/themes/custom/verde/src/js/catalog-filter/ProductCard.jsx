import { formatPrice } from './api.js';

/**
 * A product card with the same markup and classes as the "card" SDC component
 * (components/card/card.twig), so the component's CSS styles both.
 *
 * React escapes every value it prints, like Twig does. This widget never uses
 * dangerouslySetInnerHTML, so text from the API cannot inject HTML.
 *
 * @param {object} props - Component props.
 * @param {object} props.product - A product from parseProducts().
 * @param {string} props.category - The category name.
 * @param {string[]} props.badges - Dietary tag names.
 * @returns {JSX.Element} The card.
 */
export default function ProductCard({ product, category, badges }) {
  const price = formatPrice(product.price);

  return (
    <article className="card">
      {product.image && (
        <div className="card__media">
          <img src={product.image.url} alt={product.image.alt} width="640" height="480" loading="lazy" />
        </div>
      )}
      <div className="card__body">
        {category && <p className="card__meta">{category}</p>}
        {/* The page <h1> is "Products", so cards use <h2>, as on the server. */}
        <h2 className="card__title">
          <a href={product.url} className="card__link">
            {product.title}
          </a>
        </h2>
        {product.summary && <div className="card__summary">{product.summary}</div>}
        {(badges.length > 0 || price) && (
          <div className="card__footer">
            {badges.length > 0 && (
              <ul className="card__badges" role="list">
                {badges.map((badge) => (
                  <li key={badge}>
                    <span className="badge badge--default">{badge}</span>
                  </li>
                ))}
              </ul>
            )}
            {price && <p className="card__price">{price}</p>}
          </div>
        )}
      </div>
    </article>
  );
}
