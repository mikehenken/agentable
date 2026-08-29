import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Match the TS compiler's convention: a leading underscore marks a
      // deliberately unused binding, and rest-sibling destructuring is the
      // idiomatic way to omit fields.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // Tests: a bare `expect(x).toBeVisible;` or `el.click;` is a no-op that
    // reads like an assertion. no-unused-expressions turns the whole class
    // into a lint error. allowShortCircuit stays off on purpose; chai-style
    // getter assertions in web-test-runner component tests are the one
    // legitimate bare-property idiom, so component tests keep the rule off.
    files: ['tests/**/*.{ts,tsx}'],
    ignores: ['tests/component/**'],
    rules: {
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: false, allowTernary: false },
      ],
    },
  },
  {
    // Component tests assert through chai property getters (`expect(el).to.exist;`)
    // which execute on access — bare expressions by design, so the base
    // tseslint-recommended rule is off here rather than merely un-tightened.
    files: ['tests/component/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
])
