// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', 'dist-reader-check/**', 'dist-native-check/**', 'dist-ci/**', '.expo/**'],
    rules: {
      // React Compiler guidance is useful, but these rules currently flag several
      // established React Native patterns in the app. Keep them visible without
      // blocking release lint; runtime/type/security checks still remain blocking.
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
]);
