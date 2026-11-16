/**
 * Webpack builds the Verde theme's assets from src/ into dist/.
 *
 *   npm run build   production: compressed CSS, no source maps
 *   npm run watch   development: readable CSS with source maps, rebuilds on save
 *
 * Each entry becomes one file in dist/. Drupal libraries (verde.libraries.yml)
 * point at those files, and Drupal decides on which pages to load them.
 */
import path from 'node:path';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import RemoveEmptyScriptsPlugin from 'webpack-remove-empty-scripts';

const themePath = path.resolve(import.meta.dirname, 'web/themes/custom/verde');

export default (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    context: themePath,
    entry: {
      // Key = output path inside dist/ (without the extension).
      'css/global': './src/scss/global.scss',
    },
    output: {
      path: path.join(themePath, 'dist'),
      // Delete old files in dist/ before each build.
      clean: true,
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
