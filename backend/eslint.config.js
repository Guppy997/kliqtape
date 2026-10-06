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
    // Druck-Module (Album, Brief) bekommen ihre Daten uebergeben und duerfen
    // die Datenbank nicht selbst oeffnen — so bleiben Seite B und Hot Line
    // fuer den Export technisch unerreichbar (siehe album_posts in db.ts).
    files: ['src/print/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/db', '**/db.js', '**/server', '**/server.js'], message: 'Druck-Module bekommen Daten nur ueber ihre Source.' },
            { group: ['better-sqlite3'], message: 'Druck-Module oeffnen keine Datenbank.' },
          ],
        },
      ],
    },
  },
  {
    // In Tests sind lose JSON-Antworten normal.
    files: ['tests/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
