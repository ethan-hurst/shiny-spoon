module.exports = {
  '*.{js,jsx,ts,tsx}': [
    'eslint --fix',
    'prettier --config .prettierrc.json --write',
  ],
  '*.{json,md,mdx,css,scss}': ['prettier --config .prettierrc.json --write'],
}
