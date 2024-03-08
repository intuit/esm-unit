import AssertionError from "./AssertionError.js";
import { findDeepDifference } from "./deepCompare.js";

const str = function(val) {
  switch (typeof val) {
    case "function":
      return `function ${val.name || 'anonymous'}`;
    case "object":
    case "string":
      return JSON.stringify(val);
    default:
      return String(val);
  }
}

/**
 * Asserts value is truthy
 *
 * @param {*} value The value being tested.
 * @param {string=} description An optional message explaining the failure.
 */
export default function assert(value, description) {
  if (!value) {
    throw new AssertionError(`Expected ${value} to be truthy`, description);
  }
}

/**
 * Always fails
 *
 * @param {string=} description An optional message explaining the failure.
 */
assert.fail = function fail(description) {
  throw new AssertionError("Call to fail()", description);
};

/**
 * Asserts two values are strictly equal
 *
 * @param {*} expected The expected value.
 * @param {*} actual The actual value.
 * @param {string=} description An optional message explaining the failure.
 */
assert.equal = function assertEqual(expected, actual, description) {
  if (expected !== actual) {
    throw new AssertionError(`Expected ${str(actual)} to strictly equal ${str(expected)}`, description);
  }
};
assert.equals = assert.equal;

/**
 * Asserts the given value strictly equals one of several options
 *
 * @param {!Array<*>} expected The expected value.
 * @param {*} actual The actual value.
 * @param {string=} description An optional message explaining the failure.
 */
 assert.equalsOneOf = function assertEqualsOneof(expected, actual, description) {
  if (!expected.includes(actual)) {
    throw new AssertionError(`Expected ${str(actual)} to strictly equal one of ${str(expected)}`, description);
  }
};

/**
 * Asserts two values are strictly equal
 *
 * @param {!RegExp} regExp A regular express
 * @param {!string} actual The actual value.
 * @param {string=} description An optional message explaining the failure.
 */
assert.stringMatches = function assertEqual(regExp, actual, description) {
  if (!regExp.test(actual)) {
    throw new AssertionError(`Expected ${str(actual)} to match ${regExp}`, description);
  }
};

/**
 * Asserts a value is strictly true
 *
 * @param {*} actual The actual value.
 * @param {string=} description An optional message explaining the failure.
 */
assert.true = function assertTrue(actual, description) {
  return assert.equal(true, actual, description)
};

/**
 * Asserts a value is strictly false
 *
 * @param {*} actual The actual value.
 * @param {string=} description An optional message explaining the failure.
 */
assert.false = function assertFalse(actual, description) {
  return assert.equal(false, actual, description)
};

/**
 * Asserts two values are not strictly equal
 *
 * @param {*} expected The expected value.
 * @param {*} actual The actual value.
 * @param {string=} description An optional message explaining the failure.
 */
assert.notEqual = function assertNotEqual(expected, actual, description) {
  if (expected === actual) {
    throw new AssertionError(`Expected ${str(expected)} to not strictly equal ${str(actual)}`, description);
  }
};

/**
 * Asserts an error is thrown by the provided function, and optionally matches it against a string.
 * Returns the error object for further testing.
 *
 * @param {function()} A callback function
 * @param {string=} errorText A string the error message should contain
 * @param {string=} description An optional message explaining the failure.
 * @returns {*} The error that was thrown
 */

assert.throws = function assertThrows(func, errorText, description) {
  if (typeof func !== "function") {
    throw new TypeError("assert.throws expects a function");
  }
  try {
    func();
    throw new AssertionError("Expected function to throw an error", description);
  } catch (error) {
    if (error instanceof AssertionError) {
      throw error;
    }
    if (errorText && !String(error).includes(errorText)) {
      throw new AssertionError(`Expected function to throw an error containing ${errorText}, but it was "${error}"`, description);
    }
    return error;
  }
}

/**
 * Asserts the provided promise or async function rejects, and optionally matches
 * its rejected value against a string.
 * Resolves to the rejection error or value for further testing.
 *
 * @param {function()|Promise} functionOrPromise A callback function or a promise
 * @param {string=} errorText A string the error message should contain
 * @param {string=} description An optional message explaining the failure.
 * @returns {*} The error or value it rejected with
 */
assert.rejects = function assertRejects(functionOrPromise, errorText, description) {
  let promise;

  if (typeof functionOrPromise === "function") {
    promise = functionOrPromise();
    if ( !(promise instanceof Promise) ) {
      throw new AssertionError("Expected asynchronous function to reject with an error, but it did not return a promise", description);
    }
  } else if (functionOrPromise && typeof functionOrPromise.then == "function") {
    promise = functionOrPromise;
  } else {
    throw new TypeError("assert.rejects expects a function or a promise");
  }

  return promise.then(
    () => {
      throw new AssertionError("Expected asynchronous function to reject with an error, but it resolved successfully", description);
    },
    error => {
      if (errorText && !String(error).includes(errorText)) {
        throw new AssertionError(`Expected asynchronous function to reject with an error containing ${errorText}, but it was "${error}"`, description);
      }
      return error;
    }
  )
}

/**
 * Asserts two objects or arrays are deeply equal.
 *
 * @param {*} expected The expected value.
 * @param {*} actual The actual value.
 * @param {string=} description An optional message explaining the failure.
 */
assert.deepEqual = function assertDeepEqual(expected, actual, description) {
  const difference = findDeepDifference(expected, actual);
  if (difference) {
    throw new AssertionError(`Expected ${str(actual)} to deeply equal ${str(expected)}. ${difference}.`, description);
  }
}

/**
 * Asserts an object is an instance of a constructor
 *
 * @param {object} value The child object.
 * @param {function()} constructor The constructor.
 * @param {string=} description An optional message explaining the failure.
 */
assert.instanceOf = function assertInstanceOf(child, constructor, description) {
  if (typeof constructor !== "function") {
    throw new TypeError("assert.instanceOf requires a constructor function");
  }

  if ( !(child instanceof constructor) ) {
    throw new AssertionError(`Expected ${str(child)} to be an instance of ${constructor.name || 'constructor'}`, description);
  }
}
