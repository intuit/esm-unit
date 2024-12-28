/* global require module */

module.exports = {
  testFiles: ["src/**/*.test.js", "src/**/*.spec.js"],
  importMap: {
    imports: {
      "esm-unit/": "/",
    },
  },
  module: true,
  testFiles: ["tests/integration/*.test.js"],
};
