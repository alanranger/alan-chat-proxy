import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['api/**/*.js', 'public/**/*.js', 'scripts/**/*.js'],
    rules: {
      'complexity': ['error', 15],
      'max-params': ['error', 4],
      'max-statements': ['error', 20],
      'max-depth': ['error', 4]
    }
  }
];
