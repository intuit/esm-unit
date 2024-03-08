/**
 * @fileinfo
 *
 * This file contains the Node test runner API. For the module you import into the unit
 * tests themselves, see test-api.js.
 */

import TestRunner from './test-runner/src/TestRunner.js';
import { loadDefaultConfig } from './test-runner/src/Config.js';

export async function initialize(configFile) {
  await loadDefaultConfig(configFile);
}

export const runTests = async function(options) {
  await initialize(options.config);

  let success;
  try {
    const runner = new TestRunner(options);
    success = await runner.runTests();
    console.log();
    console.log(
      success ? "SUCCEEDED" : "FAILED"
    );
  } catch (err) {
    success = false;
    console.error(err.stack || `Error: ${err}`);
  }
  return { success };
}

export { postprocessorCoverageMiddleware, staticCoverageMiddleware } from './test-runner/src/coverage.js';
export { configFileMiddleware} from './test-runner/src/configGenerator.js';
