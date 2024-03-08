/* node:coverage disable */

import assert from '../../src/assert.js';
import { strict as nodeAssert } from 'node:assert';
import test, { describe } from 'node:test';

describe('assert.js', () => {
  test('assert()', () => {
    nodeAssert.doesNotThrow(() => assert(true));
    nodeAssert.doesNotThrow(() => assert('truthy'));
    nodeAssert.doesNotThrow(() => assert({}));
    nodeAssert.throws(() => assert(), /Expected undefined to be truthy$/);
    nodeAssert.throws(() => assert(false), /Expected false to be truthy$/);
    nodeAssert.throws(() => assert(null), /Expected null to be truthy$/);
    nodeAssert.throws(() => assert(false, 'Message'), /Expected false to be truthy: Message$/);
  });

  test('assert.fail()', () => {
    nodeAssert.throws(() => assert.fail(), /Call to fail\(\)$/);
    nodeAssert.throws(() => assert.fail('Message'), /Call to fail\(\): Message$/);
  });

  test('assert.equal()', () => {
    nodeAssert.doesNotThrow(() => assert.equal(1, 1));
    nodeAssert.doesNotThrow(() => assert.equal('foo', 'foo'));
    nodeAssert.throws(() => assert.equal(1, 0), /Expected 0 to strictly equal 1$/);
    nodeAssert.throws(() => assert.equal(1, '1'), /Expected "1" to strictly equal 1$/);
    nodeAssert.throws(() => assert.equal([], []), /Expected \[\] to strictly equal \[\]$/);
    nodeAssert.throws(() => assert.equal({}, {}), /Expected \{\} to strictly equal \{\}$/);
    nodeAssert.throws(
      () => assert.equal(function foo() {}, () => {}),
      /Expected function anonymous to strictly equal function foo$/
    );
    nodeAssert.throws(
      () => assert.equal(1, 0, 'Message'),
      /Expected 0 to strictly equal 1: Message$/
    );
  });

  test('assert.equalsOneOf()', () => {
    nodeAssert.doesNotThrow(() => assert.equalsOneOf([1,2,3], 1));
    nodeAssert.doesNotThrow(() => assert.equalsOneOf([1,2,3], 2));
    nodeAssert.doesNotThrow(() => assert.equalsOneOf([1,2,3], 3));
    nodeAssert.throws(() => assert.equalsOneOf([1,2,3], 4), /Expected 4 to strictly equal one of \[1,2,3\]$/);
    nodeAssert.throws(() => assert.equalsOneOf([1,2,3], 4, 'Message'), /Expected 4 to strictly equal one of \[1,2,3\]: Message$/);
  });

  test('assert.stringMatches()', () => {
    nodeAssert.doesNotThrow(() => assert.stringMatches(/\btwo\b/, 'one two three'));
    nodeAssert.throws(() => assert.stringMatches(/\bfour\b/, 'one two three'), /Expected "one two three" to match \/\\bfour\\b\//);
    nodeAssert.throws(() => assert.stringMatches(/\bfour\b/, 'one two three', 'Message'), /Expected "one two three" to match \/\\bfour\\b\/: Message/);
  });

  test('assert.true()', () => {
    nodeAssert.doesNotThrow(() => assert.true(true));
    nodeAssert.throws(() => assert.true(false), /Expected false to strictly equal true$/);
    nodeAssert.throws(() => assert.true('true'), /Expected "true" to strictly equal true$/);
    nodeAssert.throws(() => assert.true('true', 'Message'), /Expected "true" to strictly equal true: Message$/);
  });

  test('assert.false()', () => {
    nodeAssert.doesNotThrow(() => assert.false(false));
    nodeAssert.throws(() => assert.false(true), /Expected true to strictly equal false$/);
    nodeAssert.throws(() => assert.false('false'), /Expected "false" to strictly equal false$/);
    nodeAssert.throws(() => assert.false('false', 'Message'), /Expected "false" to strictly equal false: Message$/);
  });

  test('assert.notEqual()', () => {
    nodeAssert.doesNotThrow(() => assert.notEqual(1, '1'));
    nodeAssert.throws(() => assert.notEqual(1, 1), /Expected 1 to not strictly equal 1$/);
    nodeAssert.throws(() => assert.notEqual(1, 1, 'Message'), /Expected 1 to not strictly equal 1: Message$/);
  });

  test('assert.throws()', () => {
    // Doesn't throw if the test function does:
    nodeAssert.doesNotThrow(() => assert.throws(() => {
      throw new Error('Test Error');
    }));
    nodeAssert.doesNotThrow(() => assert.throws(() => {
      throw new Error('Test Error');
    }, 'Test Error'));

    // Does throw if the test function doesn't throw something:
    nodeAssert.throws(() => assert.throws('Foo'), /assert.throws expects a function$/);
    nodeAssert.throws(() => assert.throws(() => {}), /Expected function to throw an error$/);
    nodeAssert.throws(() => assert.throws(() => {}, null, 'Message'), /Expected function to throw an error: Message$/);

    // Throws if the test function throws something that doesn't match:
    nodeAssert.throws(
      () => assert.throws(() => {
        throw new Error('Test Error');
      }, 'Other Error'),
      /Expected function to throw an error containing Other Error, but it was "Error: Test Error"$/
    );
    nodeAssert.throws(() => assert.throws(
      () => {
        throw new Error('Test Error');
      }, 'Other Error', 'Message'),
      /Expected function to throw an error containing Other Error, but it was "Error: Test Error": Message$/
    );
  });

  test('assert.rejects()', async () => {
    await nodeAssert.doesNotReject(
      assert.rejects(() => Promise.reject())
    );
    await nodeAssert.doesNotReject(
      assert.rejects(Promise.reject())
    );
    await nodeAssert.doesNotReject(
      assert.rejects(() => Promise.reject(new Error('Test Error'), 'Test Error'))
    );

    nodeAssert.throws(
      () => assert.rejects(() => {}),
      /Expected asynchronous function to reject with an error, but it did not return a promise$/
    );
    nodeAssert.throws(
      () => assert.rejects(() => {}, null, 'Message'),
      /Expected asynchronous function to reject with an error, but it did not return a promise: Message$/
    );
    nodeAssert.throws(
      () => assert.rejects(1),
      /assert.rejects expects a function or a promise$/
    );

    await nodeAssert.rejects(
      () => assert.rejects(Promise.resolve()),
      /Expected asynchronous function to reject with an error, but it resolved successfully$/
    );
    await nodeAssert.rejects(
      () => assert.rejects(Promise.resolve(), null, 'Message'),
      /Expected asynchronous function to reject with an error, but it resolved successfully: Message$/
    );

    await nodeAssert.doesNotReject(
      assert.rejects(() => Promise.reject(new Error('Test Error'), 'Test Error'))
    );
    await nodeAssert.rejects(
      assert.rejects(() => Promise.reject(new Error('Test Error')), 'Other Error'),
      /Expected asynchronous function to reject with an error containing Other Error, but it was "Error: Test Error"$/
    );
    await nodeAssert.rejects(
      assert.rejects(() => Promise.reject(new Error('Test Error')), 'Other Error', 'Message'),
      /Expected asynchronous function to reject with an error containing Other Error, but it was "Error: Test Error": Message$/
    );
  });

  test('assert.deepEqual()', () => {
    nodeAssert.doesNotThrow(() => assert.deepEqual({}, {}));
    nodeAssert.doesNotThrow(() => assert.deepEqual([], []));
    nodeAssert.doesNotThrow(() => assert.deepEqual('Foo', 'Foo'));
    nodeAssert.doesNotThrow(() => assert.deepEqual([ [1,2], {foo: 1, bar: 2}], [[1,2], { foo: 1, bar: 2}]));

    nodeAssert.throws(
      () => assert.deepEqual({}, []),
      /Expected \[\] to deeply equal \{\}\. expected object, found array\.$/,
    );
    nodeAssert.throws(
      () => assert.deepEqual({}, [], 'Message'),
      /Expected \[\] to deeply equal \{\}\. expected object, found array\.: Message$/,
    );

    nodeAssert.throws(
      () => assert.deepEqual('Foo', 'foo'),
      /Expected "foo" to deeply equal "Foo"\. expected "Foo", found "foo"\.$/,
    );

    nodeAssert.throws(
      () => assert.deepEqual([ [1,2], {foo: 1, bar: 2}], [[1,2], { foo: 1, bar: 3}]),
      /Expected \[\[1,2\],\{"foo":1,"bar":3\}\] to deeply equal \[\[1,2\],\{"foo":1,"bar":2\}\]\. \[1\]\.bar: expected 2, found 3\.$/,
    );

    nodeAssert.throws(
      () => assert.deepEqual({a: 1}, {}),
      /Expected \{\} to deeply equal \{"a":1\}. missing property "a".$/
    );

    nodeAssert.throws(
      () => assert.deepEqual({}, {a: 1}),
      /Expected \{"a":1\} to deeply equal \{\}. extra property "a".$/
    );

    nodeAssert.throws(
      () => assert.deepEqual({}, {a: 1, b: 2}),
      /Expected \{"a":1,"b":2\} to deeply equal \{\}. extra properties "a", "b".$/
    );

    nodeAssert.throws(
      () => assert.deepEqual({a: null}, {a: undefined}),
      /Expected \{\} to deeply equal \{"a":null\}. a: expected null, found undefined.$/
    );

    nodeAssert.throws(
      () => assert.deepEqual({a: [1]}, {a: [1,2]}),
      /Expected \{"a":\[1,2\]\} to deeply equal \{"a":\[1\]\}. a: expected array with 1 item\(s\), found 2 items.$/
    );
  });

  test('assert.instanceOf()', () => {
    class One {};
    class Two {};

    nodeAssert.doesNotThrow(() => assert.instanceOf(new One, One));
    nodeAssert.doesNotThrow(() => assert.instanceOf(new One, Object));

    nodeAssert.throws(
      () => assert.instanceOf(new One, {}),
      /assert.instanceOf requires a constructor function$/
    )
    nodeAssert.throws(
      () => assert.instanceOf(new One, Two),
      /Expected \{\} to be an instance of Two$/
    );
    nodeAssert.throws(
      () => assert.instanceOf(new One, Two, 'Message'),
      /Expected \{\} to be an instance of Two: Message$/
    );
  });
});
