module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: 'google',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    'linebreak-style': ['off'], // Already disabled for CRLF
    'no-unused-vars': ['off'], // Disable unused variables check
    'object-curly-spacing': ['off'], // Disable spacing inside curly braces
    'quotes': ['off'], // Disable single/double quote enforcement
    'max-len': ['off'], // Disable maximum line length
    'comma-dangle': ['off'], // Disable trailing comma requirement
    'arrow-parens': ['off'], // Disable parentheses requirement for arrow functions
    'eol-last': ['off'], // Disable newline at end of file requirement
  },
};
