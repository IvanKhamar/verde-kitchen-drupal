/**
 * Webpack builds the Verde theme's assets.
 *
 *   npm run build   production: compressed CSS, no source maps
 *   npm run watch   development: readable CSS with source maps, rebuilds on save
 *
 * Two kinds of output:
 * - src/scss/<name>.scss              -> dist/css/<name>.css (theme libraries)
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
    },
    devtool: isProduction ? false : 'source-map',
    module: {
      rules: [
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
