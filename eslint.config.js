const { FlatCompat } = require('@eslint/eslintrc')
const js = require('@eslint/js')

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

module.exports = [
  js.configs.recommended,
  ...compat.extends('next/core-web-vitals'),
  ...compat.extends('plugin:prettier/recommended'),
]
