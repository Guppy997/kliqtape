import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Flat Config (ESLint 9+). Fehlte bisher ganz — `npm run lint` brach ab,
// obwohl das Skript seit dem ersten Commit in package.json stand.
export default defineConfig(
  { ignores: ['dist/', 'node_modules/', 'data/', 'media/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      // Unbenutzte Parameter mit _ sind Absicht (Express-Signaturen).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // In Tests sind lose JSON-Antworten normal.
    files: ['tests/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
