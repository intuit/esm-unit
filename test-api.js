/**
 * @fileinfo
 *
 * Import from this file into your unit tests themselves. It's a pure ES6 module
 * capable of running in modern web browsers without transpilation.
 *
 * For the test runner API that runs in Node, see index.js.
 */

import _assert from "./src/assert.js";

export const assert = _assert;

const api = window['__esmunit__api__'];
if (!api) {
  throw new Error("ESM Unit test runner not loaded");
}

const describeTestSuite = api['describeTestSuite'];
const addTest = api['addTest'];
const addLifecycleFunction = api['addLifecycleFunction'];
const runRootTestSuite = api['runRootTestSuite'];

/**
 * @param {!string} suiteName The name of your test suite
 * @param {!function} suiteFunc A function that, when run, defines your test suite
 */
export function describe(suiteName, suiteFunc) {
  if (typeof suiteName !== "string" || !suiteName) {
    throw new TypeError("Suite name is required");
  }
  describeTestSuite(suiteName, suiteFunc);
}

export function test(testName, func) {
  if (typeof testName !== "string" || !testName) {
    throw new TypeError("Test name is required");
  }

  addTest(testName, func);
}

/**
 * @param {!function} func
 */
export function before(func) {
  addLifecycleFunction("before", func);
}

/**
 * @param {!function} func
 */
export function beforeEach(func) {
  addLifecycleFunction("beforeEach", func);
}

/**
 * @param {!function} func
 */
export function after(func) {
  addLifecycleFunction("after", func);
}

/**
 * @param {!function} func
 */
export function afterEach(func) {
  addLifecycleFunction("afterEach", func);
}

export function runTests() {
  return runRootTestSuite();
}