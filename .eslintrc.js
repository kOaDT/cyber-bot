module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  plugins: ['security-node'],
  extends: ['prettier', 'plugin:security-node/recommended'],
  parserOptions: {
    ecmaVersion: 12,
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
};
