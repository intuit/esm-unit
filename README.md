# ESM Unit

Lightning-fast unit testing for native ECMAScript modules.

## Features

 * Run unit tests in real web browsers as pure ECMAScript modules, without any
   bundling or transpilation steps.
 * Easy debugging using any standard JavaScript debugger.
 * Each test file is run in an isolated iframe, with a clean window and DOM document
   to work with. Test files can't normally interfere with each others' mocks.
 * Quickly isolate and rerun any failing test by itself, by clicking "Isolate"
   in the debug browser window.

## Installation

 > npm add --save-dev esm-unit

### Usage:

#### Requirements

ESM Unit requires ECMAScript module code capable of running in current web browsers without any transpilation step. If your code uses nonstandard tools like JSX, or uses `import` to load anything other than native ES modules from local relative file paths, it will need to be converted before running this.

One option is to use a dev server to translate JSX to ESM code on the fly, and replacing nonstandard `import`s with their original API versions (such as `require()` for AMD packages). You can provide a custom dev server using the `--http-server` command line option.

Node 18 LTS or later is required to use ESM Unit. Node 20 LTS is required for development.

#### A test file

In `tests/suite.test.js`:

```js
import {
  describe,
  test,
  assert,
  before,
  beforeEach,
  after,
  afterEach
} from "esm-unit/test-api.js";
import { wait } from "./util/async.js";

describe("my tests", () => {
  // Describes a test suite

  before(() => {
    // Optional setup run before the first test in this suite
  });
  after(() => {
    // Optional teardown run after the last test in this suite
  });
  beforeEach(() => {
    // Optional setup run before every test in this suite
  });
  afterEach(() => {
    // Optional teardown run before every test in this suite
  });

  describe("these should pass", () => {
    test("synchronous test", () => {
        assert.equal(1, 1);
    });
    test("asynchronous test", async () => {
      await wait(10);
      assert.equal(1, 1);
    });
  });
  describe("testing failures", () => {
    test("synchronous failure", () => {
      assert.fail("This should fail");
    });
    test("asynchronous failure", async () => {
      await wait(10);
      assert.equal(1, "1", "Equality checks are strict");
    });
  });
});
```

Any test that returns a promise is treated as an asynchronous test.

#### Run a single test

In headless Chrome from the command line:

First, ensure `chromedriver` is installed and updated. You can do this by running `npm install -g chromedriver`, and ensure the path returned by `npm bin -g` is added to your `PATH` variable in `.bash_profile` for bash or `.zshrc` for zsh. Then from the root of your project:

 > esm-unit --suite=tests/suite.test.js --headless

To specify any other browser, provide the browser name via `--browser`:

 > esm-unit --suite=tests/suite.test.js --browser=firefox

To test multiple browsers in parallel and combine their coverage stats into a single report, this can be set multiple times:

 > esm-unit --suite=tests/suite.test.js --browser=chrome --browser=safari --browser=firefox

_Note: Browser logs are only printed from Chrome, and headless mode is only supported in Chrome and Firefox. Using other browsers may require installing their driver executable, such as `geckodriver`._

#### Debug a single test

To open the test in debug mode in your default web browser:

> esm-unit --debug --suite=tests/suite.test.js

If a test fails, you can click "Isolate" in the browser to rerun and debug _only_ that test.

#### Save a configuration for running and debugging multiple tests:

Save a config file in `esm-unit.json` in the root of your project:

```json
{
    "importMap": {
      "imports": {
        "esm-unit/": "/node_modules/esm-unit/"
      }
    },
    "testFiles": [
        "src/**/*.test.js"
    ]
}
```

Or in `esm-unit.js` to generate it with code:

```js
const { getLocale } = require("./utils.js");
module.exports = {
    "importMap": {
      "imports": {
        "esm-unit/": "/node_modules/esm-unit/",
      },
    },
    "testFiles": [
        "src/**/*.test.js",
    ],
    "appendParam": filePath => `?locale=${getLocale(filePath)}`,
};
```

`testFiles` can be file paths or glob patterns. If using glob patterns, you can also provide `"excludeTestFiles"` with an array of file paths or patterns to avoid.

Then run esm-unit (with or without `--debug`):

 > esm-unit --headless

#### Automatically run tests every time a file changes

Add `--watch` to scan your project's directory for any changes and automatically re-run
your tests. This can be configured by setting the root directory to `"watchDirectory"` in your esm-unit.json file:

```json
{
    "watchDirectory": "src",
    "testFiles": [
        "src/**/*.test.js"
    ]
}
```

The `--watch` and `--debug` options can't be used at the same time. With `--debug` on, refresh the web browser
to re-run tests.

#### All config options

These options are also available in your `esm-unit.json` or `esm-unit.js` file:

 * `module` _(boolean)_: Whether to load test files as native ECMAScript modules. Defaults to true.
 * `testFiles` _(array of glob patterns)_: A list of paths to scan for test files.
 * `watchDirectory` _(path)_: Root directory to watch for changes when running with `--watch`
 * `includeScripts` _(array of paths)_: a list of JavaScript files to load as ordinary scripts before each test
 * `includeModules` _(array of paths)_: a list of JavaScript files to load as native ECMAScript modules before each test
 * `appendQuery` _(string|function)_: An optional query parameter, like `?env=test`, to append to each JavaScript file path. Useful with custom dev servers like [es6-module-server](https://www.npmjs.com/package/es6-module-server). If providing a function, it will take the test file path as an argument.
 * `coverage` _(object)_: Code coverage configuration. See below for details.
 * `failOnErrorLogs` _(boolean)_ Tests will be marked as failed if any errors appear in the browser console, such as uncaught tracebacks and console.error messages. (Chrome and MS Edge only).
 * `importMap` _(object)_: An [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap) following the WHATWG specification. The object set here will be included in a `<script type="importmap">` in test suites. When set, unit tests will only run in [web browsers with native support for import maps](https://caniuse.com/mdn-html_elements_script_type_importmap).

## Code Coverage

esm-unit supports integrated per-file code coverage enforcement.

Code coverage reports are enabled by default when running without `--debug`, but can be disabled with `--no-coverage`.

To enable coverage threshold enforcement, add a `coverage` configuration block to your `esm-unit.json` config file:

```json
"coverage": [
  {
    "includeFiles": [
      "src/**/*.js"
    ],
    "excludeFiles": [
      "src/**/*.test.js",
    ],
    "threshold": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  },
]
```

Add additional objects to the `coverage` array to override settings for individual files. Each file will use the thresholds of the last matching object.


## Assertions

Any assertion library is supported, as long as it can be loaded in web browsers as an ECMAScript module.

ESM Unit includes the following built-in assertions, based on the classic JSUnit API. `[description]` is an optional but recommended string message to be printed on failure.

| Function | Asserts that... |
|----------|-----------------|
| `assert(value, [description])` | `value` is truthy |
| `assert.true(value, [description])` | `value` is strictly `true` |
| `assert.false(value, [description])` | `value` is strictly `false` |
| `assert.equal(expected, actual, [description])` | `actual` is strictly equal to `expected` |
| `assert.notEqual(expected, actual, [description])` | `actual` is not strictly equal to `expected` |
| `assert.stringMatches(regExp, actual, [description])` | `actual` matches the regular expression `regExp` |
| `assert.deepEqual(expected, actual, [description])` | `actual` deeply matches the object provided in `expected` |
| `assert.instanceOf(child, constructor, [description])` | `child` is an instance of `constructor` |
| `assert.throws(func, [errorText], [description])` | `func` throws an error. If `errorText` is provided, that text must be contained within the error description. |
| `await assert.rejects(func or promise, [errorText], [description])` | `promise` rejects, or `func` returns a promise that rejects. If `errorText` is provided, that text must be contained within the error message. |
| `assert.fail([description])` | No assertion; always fails |

```js
import {describe, test, assert} from "../node_modules/esm-unit/test-api.js";

describe("math", () => {
  test("addition", () => {
    assert.equal(4, 2 + 2, "Math should work");
  });
});
```

## Stubs and Mocks

[Sinon](https://sinonjs.org) is recommended for stubbing and mocking, and performing assertions
against those mocks.

 > npm install --save-dev sinon

As it's a native ECMAScript module, you can add it to your import map in `esm-unit.json` for easier imports:

```json
    "importMap": {
      "imports": {
        "esm-unit/": "/node_modules/esm-unit/",
        "sinon": "/node_modules/sinon/pkg/sinon-esm.js"
      }
    },
    "testFiles": [
        "src/**/*.test.js"
    ]
```

Sinon's own assertion API can be used to validate mocks and spies.

```js
import {describe, test, beforeEach} from "esm-unit/test-api.js";
import sinon from "sinon";

describe("sinon's spies", () => {
  const sinonSandbox = sinon.createSandbox();
  afterEach(() => {
    sinonSandbox.restore();
  });

  test("console.log()", () => {
    sinonSandbox.spy(console, "log");
    console.log("Hello, World");
    sinon.assert.calledWith(console.log, "Hello, World");
  });
});
```

# Contributing

Feel free to open an [issue](https://github.com/intuit/esm-unit/issues) or a [pull request](https://github.com/intuit/esm-unit/pulls)!

Make sure to read our [code of conduct](./CODE_OF_CONDUCT.md).

We actively welcome pull requests. Learn how to [contribute](./CONTRIBUTING.md).

