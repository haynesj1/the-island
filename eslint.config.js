import js from '@eslint/js';
import ts from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';

export default [
  { ignores: ['dist/', '.astro/', 'node_modules/', 'public/sw.js', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...astro.configs.recommended,
  ...svelte.configs.recommended,
  {
    files: ['**/*.svelte'],
    languageOptions: { parser: svelteParser, parserOptions: { parser: ts.parser } },
  },
  { files: ['scripts/**', '*.config.*'], languageOptions: { globals: { process: 'readonly', Buffer: 'readonly', URL: 'readonly', console: 'readonly' } } },
];
