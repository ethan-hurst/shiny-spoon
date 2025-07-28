module.exports = {
  '*.{js,jsx,ts,tsx}': [
    'prettier --config .prettierrc.json --write',
  ],
  '*.{json,md,mdx,css,scss}': ['prettier --config .prettierrc.json --write'],
}
