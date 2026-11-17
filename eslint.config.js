/**
 * ESLint configuration (flat config format, ESLint 9).
 *
 * ESLint finds bugs and risky patterns in JavaScript. Formatting is left to
 * Prettier: eslint-config-prettier, applied last, turns off the style rules
 * that would conflict with it.
 */
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    // Code we do not own: Drupal core, contributed code, build output.
    ignores: [
      'vendor/**',
      'node_modules/**',
      'recipes/**',
      'reports/**',
      'web/core/**',
      'web/modules/contrib/**',
      'web/themes/contrib/**',
      'web/libraries/**',
      'web/sites/**',
      'web/themes/custom/*/dist/**',
    ],
  },

  js.configs.recommended,

  // Browser code in the theme. Drupal and once() are globals that core loads.
  {
    files: ['web/themes/custom/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, Drupal: 'readonly', drupalSettings: 'readonly', once: 'readonly' },
    },
  },

  // The React widget: React rules, hooks rules, and accessibility rules for JSX.
  {
    files: ['web/themes/custom/**/*.jsx'],
    ...react.configs.flat.recommended,
    settings: { react: { version: 'detect' } },
  },
  { files: ['web/themes/custom/**/*.jsx'], ...react.configs.flat['jsx-runtime'] },
  { files: ['web/themes/custom/**/*.{js,jsx}'], ...reactHooks.configs.flat.recommended },
  { files: ['web/themes/custom/**/*.jsx'], ...jsxA11y.flatConfigs.recommended },
  {
    files: ['web/themes/custom/**/*.jsx'],
    rules: {
      // Props are documented with JSDoc; the project has no PropTypes package.
      'react/prop-types': 'off',
      // <ul role="list"> is intentional: Safari drops list semantics when
      // list-style is none, and the Twig components use the same markup.
      'jsx-a11y/no-redundant-roles': ['error', { ul: ['list'] }],
    },
  },

  // Node.js code: build configuration, scripts and unit tests.
  {
    files: ['*.js', 'scripts/**/*.{js,mjs}', '**/*.test.js', 'tests/**/*.js'],
    languageOptions: { globals: globals.node },
  },

  prettier,
];
