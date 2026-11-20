/**
 * Webpack builds the Verde theme's assets.
 *
 *   npm run build   production: compressed CSS, no source maps
 *   npm run watch   development: readable CSS with source maps, rebuilds on save
 *
 * Three kinds of output:
 * - src/scss/<name>.scss              -> dist/css/<name>.css (theme libraries)
 * - src/js/<widget>/index.jsx         -> dist/js/<widget>.js (React, bundled)
 * - components/<name>/<name>.scss     -> components/<name>/<name>.css
 *   Single Directory Components load <name>.css from their own folder, so the
 *   compiled file must sit next to the component. Those .css files are not committed.
 */
import fs from 'node:fs';
import path from 'node:path';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import RemoveEmptyScriptsPlugin from 'webpack-remove-empty-scripts';

const themePath = path.resolve(import.meta.dirname, 'web/themes/custom/verde');

// Library styles: one entry per file listed here.
const libraryEntries = {
  'dist/css/global': './src/scss/global.scss',
  'dist/css/product': './src/scss/pages/product.scss',
  'dist/css/article': './src/scss/pages/article.scss',
  'dist/css/contact': './src/scss/pages/contact.scss',
  'dist/css/catalog-filter': './src/scss/pages/catalog-filter.scss',
  // The React widget: one file with React included, loaded only on /products.
  'dist/js/catalog-filter': './src/js/catalog-filter/index.jsx',
  // Shopping list: a small script for every page, and the list page (React).
  'dist/js/shopping-list': './src/js/shopping-list/index.js',
  'dist/js/shopping-list-page': './src/js/shopping-list/page.jsx',
  'dist/css/shopping-list-page': './src/scss/pages/shopping-list-page.scss',
};

// Component styles: every components/<name>/<name>.scss found on disk.
const componentEntries = Object.fromEntries(
  fs
    .readdirSync(path.join(themePath, 'components'), { withFileTypes: true })
    .filter((dir) => dir.isDirectory())
    .map((dir) => `components/${dir.name}/${dir.name}`)
    .filter((name) => fs.existsSync(path.join(themePath, `${name}.scss`)))
    .map((name) => [name, `./${name}.scss`]),
);

export default (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    context: themePath,
    entry: { ...libraryEntries, ...componentEntries },
    output: {
      // Entry names contain their folder (dist/... or components/...), so the
      // output path is the theme folder itself. Do not enable output.clean here:
      // it would delete the whole theme.
      path: themePath,
      filename: '[name].js',
    },
    resolve: {
      extensions: ['.js', '.jsx'],
    },
    devtool: isProduction ? false : 'source-map',
    module: {
      rules: [
        {
          // Babel turns JSX into plain JavaScript. preset-env transforms only
          // what the browsers in "browserslist" do not support yet.
          // The options live here, not in babel.config.json, because the JSX
          // transform must know the Webpack mode: React's production build has
          // no jsxDEV() function, which the development transform calls.
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                '@babel/preset-env',
                ['@babel/preset-react', { runtime: 'automatic', development: !isProduction }],
              ],
            },
          },
        },
        {
          test: /\.scss$/,
          // Loaders run from last to first: Sass -> PostCSS -> css-loader -> extract.
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              // Leave url() paths as they are: Drupal serves the theme files itself.
              options: { url: false, sourceMap: !isProduction },
            },
            {
              loader: 'postcss-loader',
              // Autoprefixer adds vendor prefixes for the browsers in package.json "browserslist".
              options: { postcssOptions: { plugins: ['autoprefixer'] }, sourceMap: !isProduction },
            },
            {
              loader: 'sass-loader',
              options: {
                sourceMap: !isProduction,
                sassOptions: { style: isProduction ? 'compressed' : 'expanded' },
              },
            },
          ],
        },
      ],
    },
    plugins: [
      // A CSS-only entry would also create an empty .js file; this plugin removes it.
      new RemoveEmptyScriptsPlugin(),
      new MiniCssExtractPlugin({ filename: '[name].css' }),
    ],
    stats: 'minimal',
  };
};
