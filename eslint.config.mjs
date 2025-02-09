import securityNode from 'eslint-plugin-security-node';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const config = [
  ...compat.extends('prettier', 'plugin:security-node/recommended'),
  {
    plugins: {
      'security-node': securityNode,
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.commonjs,
      },

      ecmaVersion: 12,
      sourceType: 'module',
    },

    rules: {
      'max-len': [
        'error',
        {
          code: 120,
          tabWidth: 2,
        },
      ],

      'no-unused-vars': 1,
      'no-tabs': 0,
    },
  },
];

export default config;