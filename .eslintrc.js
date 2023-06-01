const { defineConfig } = require('eslint-define-config')

module.exports = defineConfig({
  root: true,
  extends: ['@sxzz'],
  rules: {
    'unicorn/prefer-string-replace-all': 'off',
  },
})
