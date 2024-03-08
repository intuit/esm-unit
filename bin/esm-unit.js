#!/usr/bin/env node

"use strict";

import {runTests} from '../index.js';
import * as args from './_args.js';
import fs from 'fs';

const DESCRIPTION = `Runs unit tests. This must be run from the same directory as your node_modules. Either --config or --suite must be specified.`;

function getOptions() {
  const parser = args.getParser(DESCRIPTION);
  parser.add_argument('--debug', {action: "store_true", help: "Start the test server and launch the default web browser for manual testing. Close the server with Control-C when done."});
  parser.add_argument('--browser', {dest: "browsers", action: "append", help: "Which browser to test in. Defaults to Chrome. Can be set multiple times."});
  parser.add_argument('--headless', {action: "store_true", help: "Run in Chrome Headless"});
  parser.add_argument('--no-headless', {action: "store_false", dest: "headless"})
  parser.add_argument('--config', {dest: "config", action: "store", type: args.existing_file, help: "Location of your configuration JSON file. Defaults to `esm-unit.json`"});
  parser.add_argument('--suite', {dest: "testFile", action: "store", type: args.existing_file, help: "Run just that one test file."});
  parser.add_argument('--remote', {dest: "remote", nargs: "?", action: "store", default: false, help: "test: whether to run remote tests. Optionally specify name of remote configuration."});
  parser.add_argument('--http-server', {dest: "httpServer", action: "store", type:args.url, help: "To use your own dev server instead of esm-unit's, provide its base URL."});
  parser.add_argument('--verbose', {dest: "verbose", action: "store_true", help: "Print verbose degugging info."});
  parser.add_argument('--coverage', {dest: "coverage", action: "store_true", help: "Whether to record and record and enforce code coverage. Defaults to true unless --debug is set. If you also use a custom --http-server, you must ensure files it serves have been instrumented using esm-unit's Node API, or coverage will be automatically skipped.", default: args.SUPPRESS})
  parser.add_argument('--watch', {dest: "watch", action: "store_true", help: "Stay running, and re-run whenever a source file changes. Not usable with --debug."})
  parser.add_argument('--no-coverage', {dest: "coverage", action: "store_false", help: "Disable test coverage", default: args.SUPPRESS})

  const options = parser.parse_args();

  if (!options.browsers?.length) {
    options.browsers = ["chrome"];
  }

  if (options.remote === undefined) {
    // Option was specified without a value
    options.remote = "default";
  }

  if (options.config === undefined || options.config === null) {
    for (let configPath of ["esm-unit.js", "esm-unit.json"]) {
      if (fs.existsSync(configPath)) {
        options.config = configPath;
      }
    }
    if (!options.config) {
      throw new Error(`Unable to find esm-unit config file`);
    }
  }

  if (options.coverage === undefined || options.coverage === null) {
    options.coverage = !options.debug;
  }

  return options;
}


async function main() {
  try {
    const options = getOptions();
    const { success } = await runTests(options);
    process.exit(success ? 0 : 1);
  } catch (err) {
    console.error(err.stack || "Error: "+err);
    process.exit(1);
  }
}

main();