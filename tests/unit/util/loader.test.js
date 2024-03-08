/* node:coverage disable */

import { strict as assert } from 'node:assert';
import test, { describe, beforeEach, afterEach } from 'node:test';
import { loadJSON, loadTextFile, validateLocalFilePath } from '../../../src/util/loader.js';
import { setupDOMMocks, tearDownDOMMocks } from '../mocks/dom.js';

describe('loader.js', () => {
  beforeEach(() => {
    setupDOMMocks();
  });
  afterEach(() => {
    tearDownDOMMocks();
  });

  describe('validateLocalFilePath()', () => {
    test('with a valid path', () => {
      assert.equal('/src/file.json', validateLocalFilePath('src/file.json'));
    });
    test('with invalid paths', () => {
      assert.throws(
        () => validateLocalFilePath('../src/file.json'),
        /Invalid local file path/,
        'Paths must not include ".."'
      );

      assert.throws(
        () => validateLocalFilePath('src/../file.json'),
        /Invalid local file path/,
        'Paths must not include ".." in the middle either'
      );

      assert.throws(
        () => validateLocalFilePath('https://example.com/src/file.json'),
        /Invalid local file path/,
        'Paths must not include full URLs'
      );

      assert.throws(
        () => validateLocalFilePath('src%20/file.json'),
        /Invalid local file path/,
        'Paths must not include special characters'
      );
    });
  });

  describe('loadTextFile()', () => {
    test('successful load', async (t) => {
      t.mock.method(XMLHttpRequest.prototype, 'open');

      const promise = loadTextFile('src/my-text-file.txt');
      const xhr = XMLHttpRequest.mock.calls[0]?.result;
      assert(xhr, 'An XMLHttpRequest request should have been made');
      assert.equal(1, xhr.open.mock.callCount());
      assert.deepEqual(['GET', 'src/my-text-file.txt', true], xhr.open.mock.calls[0].arguments);

      xhr.status = 200;
      xhr.responseText = 'foo';
      xhr.dispatchEvent(new Event('load'));
      assert.equal('foo', await promise);
    });

    test('successful load', async (t) => {
      t.mock.method(XMLHttpRequest.prototype, 'open');

      const promise = loadTextFile('src/my-text-file.txt');
      const xhr = XMLHttpRequest.mock.calls[0]?.result;
      assert(xhr, 'An XMLHttpRequest request should have been made');
      assert.equal(1, xhr.open.mock.callCount());
      assert.deepEqual(['GET', 'src/my-text-file.txt', true], xhr.open.mock.calls[0].arguments);

      xhr.status = 200;
      xhr.responseText = 'foo';
      xhr.dispatchEvent(new Event('load'));
      assert.equal('foo', await promise);
    });

    test('500 error response', async () => {
      const promise = loadTextFile('src/my-text-file.txt');
      const xhr = XMLHttpRequest.mock.calls[0]?.result;
      assert(xhr, 'An XMLHttpRequest request should have been made');

      xhr.status = 500;
      xhr.responseText = 'foo';
      xhr.dispatchEvent(new Event('load'));

      await assert.rejects(promise, /Error loading src\/my-text-file.txt: HTTP status 500/);
    });

    test('Connection error response', async () => {
      const promise = loadTextFile('src/my-text-file.txt');
      const xhr = XMLHttpRequest.mock.calls[0]?.result;
      assert(xhr, 'An XMLHttpRequest request should have been made');

      xhr.dispatchEvent(new Event('error'));

      await assert.rejects(promise, /Error loading src\/my-text-file.txt: connection error/);
    });

    test('Network timeout', async () => {
      const promise = loadTextFile('src/my-text-file.txt');
      const xhr = XMLHttpRequest.mock.calls[0]?.result;
      assert(xhr, 'An XMLHttpRequest request should have been made');

      assert.equal(20000, xhr.timeout, 'Timeout should be 20 seconds');
      xhr.dispatchEvent(new Event('timeout'));

      await assert.rejects(promise, /Error loading src\/my-text-file.txt: timed out at 20 seconds/);
    });
  });

  describe('loadJSON()', () => {
    test('with valid JSON', async () => {
      const promise = loadJSON('src/file.json');
      const xhr = XMLHttpRequest.mock.calls[0]?.result;
      assert(xhr, 'An XMLHttpRequest request should have been made');

      xhr.status = 200;
      xhr.responseText = `{"count": 1}`;
      xhr.dispatchEvent(new Event('load'));
      assert.deepEqual({count: 1}, await promise);
    });
    test('with invalid JSON', async () => {
      const promise = loadJSON('src/file.json');
      const xhr = XMLHttpRequest.mock.calls[0]?.result;
      assert(xhr, 'An XMLHttpRequest request should have been made');

      xhr.status = 200;
      xhr.responseText = `%`;
      xhr.dispatchEvent(new Event('load'));
      await assert.rejects(promise, /^SyntaxError:/);
    });
  });
});
