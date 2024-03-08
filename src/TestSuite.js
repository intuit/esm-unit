

export class TestSuite {
  constructor(name, descriptionFunc, sandbox=null, debug=false) {
    this.parentPath = "";
    this.sandbox = sandbox;
    this.debug = debug;
    this.name = name;
    this.lifecycleFunctions = {};
    this.descriptionFunc = descriptionFunc;
    this.initialized = false;
    this.requireTests = false; // Whether it fails if empty
    this.tests = {};
    this.results = null;
    this.timeout = 10000; // Offer way to configure this in future
  }

  setParent(parent) {
    this.parent = parent;
    this.parentPath = parent.path;
  }

  get path() {
    return this.parentPath ? `${this.parentPath} : ${this.name}` : this.name;
  }

  init() {
    try {
      currentlyDescribingTestSuite = this;
      const result = this.descriptionFunc();
      if (result !== undefined) {
        throw new Error("describe() cannot be asynchronous and should not return a value");
      }
    } catch (error) {
      this.results = {
        success: false,
        error: {
          message: error && error.message || String(error),
          stack: error && error.stack
        }
      };
      throw error;
    } finally {
      currentlyDescribingTestSuite = null;
      this.initialized = true;
    }
  }

  addLifecycleFunction(functionName, func) {
    if (functionName in this.lifecycleFunctions) {
      throw new Error(`Duplicate lifecycle function ${functionName} in ${this.path}`);
    }
    if ( !(functionName in this.lifecycleFunctions) ) {
      this.lifecycleFunctions[functionName] = [];
    }
    this.lifecycleFunctions[functionName] = func;
  }

  /**
   *
   * @param {string} functionName The lifecycle function. One of 'before', 'after', 'beforeEach', or 'afterEach'.
   * @param {string=} includeParent (optional) One of "bottom-up" or "top-down" to recursively call this on parent suites
   */
  _runLifecycleFunction(functionName, includeParent) {
    if (this.parent && includeParent === "bottom-up") {
      this.parent._runLifecycleFunction(functionName, includeParent);
    }

    return this._runOwnLifecycleFunction(functionName)
      .then(() => {
        if (this.parent && includeParent === "top-down") {
          this.parent._runLifecycleFunction(functionName, includeParent);
        }
      });
  }

  _runOwnLifecycleFunction(functionName) {
    const lifecycleFunction = this.lifecycleFunctions[functionName];
    if (lifecycleFunction) {
      return this._runWithTimeout(lifecycleFunction)
        .catch(error => this._handleError(error, `Error in lifecyle function ${functionName}`));
    } else {
      return Promise.resolve();
    }
  }

  validateName(testType, testName) {
    if (!testName || typeof testName !== "string") {
      throw new Error(`${testType} name is required`);
    }
    if (testName in this.tests) {
      throw new Error(`Duplicate ${testType} name ${testName} in ${this.path}`);
    }
    if (/[:]/.test(testName)) {
      // Reserved for use as separator and formatting characters
      throw new Error(`${testType} name ${testName} cannot include ":"`);
    }
  }

  addSubSuite(testSuite) {
    this.validateName("suite", testSuite.name);
    testSuite.setParent(this);
    this.tests[testSuite.name] = testSuite;
  }

  addTest(testName, testFunc) {
    this.validateName("test", testName);
    this.tests[testName] = testFunc;
  }

  _runWithTimeout(testFunc, timeout = this.timeout) {
    return Promise.race([
      testFunc(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timed out after ${timeout}ms`));
        }, timeout)
      })
    ]);
  }

  _handleError(error, description) {
    if (!error || typeof error !== "object") {
      error = new Error(`Nonstandard error type: ${error}`);
    }
    if (!error.path) {
      error.path = this.path;
      if (description) {
        error.message = `${description}: ${error.message}`;
      }
    }
    throw error;
  }

  _runTest(test, childPath) {
    return Promise.resolve()
      .then(() => {
        if (test instanceof TestSuite) {
          return test.run(childPath, this.testAggregator);
        }
        return this._runWithTimeout(test);
      })
      .catch(error => this._handleError(error))
  }

  _recordResult(testName, results) {
    this.results[testName] = results;
    if (this.testAggregator) {
      (this.testAggregator)(this.path, testName, results);
    }
  }

  _recordSuccess(testName) {
    const test = this.tests[testName];
    if (test instanceof TestSuite) {
      this._recordResult(testName, {
        success: test.success,
        subTests: test.results,
      });
      this.success = this.success && test.success;
    } else {
      this._recordResult(testName, { success: true });
    }
  }

  _printErrorToConsole(error) {
    console.error(error + (error && error.stack ? `\n${error.stack}` : ''));
  }

  _recordFailure(testName, error) {
    const test = this.tests[testName];
    this.success = false;
    const results = {
      success: false,
      error: {
        message: error && error.message || String(error),
        stack: error.stack,
      }
    };
    if (test instanceof TestSuite) {
      results.subTests = {}; // Whole suite failed
    }
    this._recordResult(testName, results);
    this._printErrorToConsole(error);
  }

  hasTests() {
    return Object.keys(this.tests).length > 0;
  }

  /**
   * Loads any resources required to run this test
   *
   * @returns {Promise|undefined}
   */
  load() {
    if (this.sandbox) {
      return this.sandbox.load();
    }
  }

  preloadSubTests(allTestNames, startIndex, count) {
    for (let index = startIndex + 1; index <= startIndex + count; index++) {
      const nextTest = allTestNames[index] && this.tests[allTestNames[index]];
      if (nextTest && nextTest instanceof TestSuite) {
        nextTest.load();
      }
    }
  }

  /**
   * Runs all tests in this suite. Root (undescribed) test suite's run() should always resolve
   * unless it has a bug. Test suites declared with describe() could reject if the suite itself
   * has an error. That rejection should then be recorded by the parent or root test suite.
   *
   * @param {Array<string>=} testPath A path to a specific test (or suite) to run
   */
  run(testPath, testAggregator) {
    if (this.results) {
      throw new Error("Already ran test suite");
    }

    const onlyRunTest = testPath && testPath[0];
    const childPath = testPath && testPath.slice(1);

    this.results = {};
    this.success = true;
    this.testAggregator = testAggregator;

    return Promise.resolve()
      .then(() => this.load())
      .then(() => {
        if (!this.initialized) {
          this.init();
        }
        if (this.requireTests && !this.hasTests()) {
          throw new Error("No tests or test groups have been defined. This can happen if the test suite contains a syntax error.");
        }
      })
      .then(() => this._runLifecycleFunction("before"))
      .then(() => Object.keys(this.tests)
        .filter(testName => !onlyRunTest || testName === onlyRunTest)
        .reduce(
          (promise, testName, index, allTests) => {
            const test = this.tests[testName];
            const isSingleTest = !(test instanceof TestSuite);

            return promise
              .then(() => {
                this.preloadSubTests(allTests, index, 4);
                console.group(testName);
              })
              .then(() => isSingleTest && this._runLifecycleFunction("beforeEach", "bottom-up"))
              .then(() => this._runTest(test, childPath))
              .finally(() => isSingleTest && this._runLifecycleFunction("afterEach", "top-down"))
              .then(
                () => this._recordSuccess(testName),
                error => this._recordFailure(testName, error),
              )
              .then(() => {console.groupEnd()});
            },
            Promise.resolve()
        ))
      .then(() => this._runLifecycleFunction("after"))
      .catch(error => {
        this._printErrorToConsole(error);
        this.success = false;
        throw error;
      })
      .then(() => {
        if (this.sandbox) {
          this.sandbox.cleanup(!this.debug);
        }
        return this.results;
      });
  }
}


const globalRootTestSuite = new TestSuite("", () => {});
globalRootTestSuite.requireTests = true;

export function getRootTestSuite() {
  return globalRootTestSuite;
}

// The test suite currently being described
let currentlyDescribingTestSuite = null;

export function describeTestSuite(suiteName, func, rootTestSuite = globalRootTestSuite) {
  const parentTestSuite = currentlyDescribingTestSuite || rootTestSuite;
  const testSuite = new TestSuite(suiteName, func);
  parentTestSuite.addSubSuite(testSuite);
}

export function addTest(testName, func) {
  if (!currentlyDescribingTestSuite) {
    throw new Error(`Cannot call test() outside of describe()`);
  }
  currentlyDescribingTestSuite.addTest(testName, func);
}

export function addLifecycleFunction(functionName, func) {
  if (!currentlyDescribingTestSuite) {
    throw new Error(`Cannot call ${functionName} outside of describe()`);
  }
  currentlyDescribingTestSuite.addLifecycleFunction(functionName, func);
}

/**
 * Creates a new root test suite, which represents a single test file
 * run in an isolated iframe. Each sandbox has one root test suite.
 *
 * This should not be confused with the "global root test suite",
 * which runs in the parent frame and represents every test currently
 * being executed.
 *
 * @param {string} suiteName
 * @param {TestSuite} parentTestSuite
 * @returns
 */
export function createRootTestSuite(suiteName, parentTestSuite = globalRootTestSuite, sandbox = null, debug = false) {
  const rootTestSuite = new TestSuite(suiteName, () => {}, sandbox, debug);
  rootTestSuite.requireTests = true;
  parentTestSuite.addSubSuite(rootTestSuite);

  return {
    rootTestSuite,
    api: {
    "describeTestSuite": (suiteName, func) => describeTestSuite(suiteName, func, rootTestSuite),
    "addTest": addTest,
    "addLifecycleFunction": addLifecycleFunction,
    },
  };
}

export function runRootTestSuite(testPath, testAggregator) {
  return globalRootTestSuite.run(testPath, testAggregator);
}

