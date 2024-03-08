import {
  runRootTestSuite
} from "./src/TestSuite.js";

import { loadJSON, validateLocalFilePath } from "./src/util/loader.js";
import TestSandbox from "./src/TestSandbox.js";


function getSearchParams() {
  const searchParams = {};
  const VALID_PROPERTY_REGEX = /^[a-zA-Z][\w-]*$/;
  location.search.substr(1)
    .split('&').map(
      // Regex to split only the first occurance of '=':
      param => param.split(/=(.*)/, 2)
        .map(decodeURIComponent)
    ).forEach(([key, value]) => {
      if (VALID_PROPERTY_REGEX.test(key)) {
        // Treat as boolean if there's no value (hence no '=')
        searchParams[key] = (value === undefined ? true : value);
      }
    });
  return searchParams;
}

const searchParams = getSearchParams();

function generateSearchString(params) {
  return Object.keys(params)
    .map(name => {
      const value = params[name];
      if (value === undefined) {
        return '';
      }
      if (typeof value === "boolean") {
        return value ? encodeURIComponent(name) : '';
      }
      return `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    })
    .filter(Boolean) // Remove empty strings
    .join("&");
}

function generateStackTraceNode(stackTrace) {
  const pre = document.createElement("pre");

  // Add as text content to escape HTML
  pre.textContent = stackTrace;

  // Then escape URLs (if they don't have any special characters in them)
  pre.innerHTML = pre.innerHTML.replace(
    /https?:\/\/[^\s"'<>&]+\.jsm?/g,
    '<a href="$&" target="_blank">$&</a>'
  )

  return pre;
}

function generateSuiteResultElement(resultNode, parentPath="") {
  const ul = document.createElement('ul');
  Object.keys(resultNode).forEach(testName => {
      // Strip off query param (but only if it's a root test name, which are file paths)
      const testLabel = (parentPath ? testName : testName.replace(/\?.*$/, ""));
      const testResult = resultNode[testName];
      const li = document.createElement('li');
      const {success, error} = testResult;
      const testPath = parentPath ? `${parentPath}:${testName}` : testName;

      li.className = success ? "success" : "failure";
      li.textContent = `${success ? "✓" : "failed:"} ${testLabel}`;

      const directLink = "?" + generateSearchString(
        Object.assign(searchParams, {
          testPath: testPath
        })
      );

      if (error) {
          li.textContent = `Failed: ${li.textContent}`;
      }

      li.innerHTML += ` <a class="run-test" href="${directLink}">Isolate</a>`;

      if (error) {
          const errorTextDiv = document.createElement('div');
          errorTextDiv.textContent = String(error && error.message || error);
          li.appendChild(errorTextDiv);
          if (error.stack) {
            li.appendChild(generateStackTraceNode(error.stack));
          }
      }
      if (testResult.subTests && Object.keys(testResult.subTests).length) {
        const expandToggle = document.createElement('input');
        expandToggle.type = "checkbox";
        expandToggle.className = "expand";
        expandToggle.checked = !testResult.success;
        expandToggle.id = testPath;

        const expandLabel = document.createElement('label');
        expandLabel.htmlFor = testPath;
        expandLabel.appendChild(li.firstChild);

        li.insertBefore(expandLabel, li.firstChild);
        li.insertBefore(expandToggle, li.firstChild);
        li.appendChild(generateSuiteResultElement(testResult.subTests, testPath));
      }
      ul.appendChild(li);
  });
  return ul;
}

function recordResults(finished = false, results = {}, coverage) {
  window['__esmunit_results__'] = {
    finished,
    results,
    coverage,
    success: !Object.keys(results).some(testName => !results[testName].success),
  }
}

function displayResults(finished, testFiles, results) {
  let container = document.querySelector('#test_results');
  if (!container) {
    container = document.createElement('div');
    container.id = "test_results";
    document.body.appendChild(container);
  }
  container.classList.toggle('results-finished', finished);
  container.classList.toggle('results-unfinished', !finished);
  if (!container.querySelector('header')) {
    const header = document.createElement('header');
    header.innerHTML = `<div><progress></div><div><button id="expand_all">Expand All</button><button id="collapse_all">Collase All</button><button id="expand_failed">Only Failures</button></div>`;
    header.querySelector('#expand_all').addEventListener('click',
      () => container.querySelectorAll('input.expand').forEach(input => input.checked = true)
    );
    header.querySelector('#collapse_all').addEventListener('click',
      () => container.querySelectorAll('input.expand').forEach(input => input.checked = false)
    );
    header.querySelector('#expand_failed').addEventListener('click',
      () => container.querySelectorAll('li').forEach(li => {
        expander = li.querySelectorAll('input.expand')[0];
        if (expander) {
          expander.checked = li.classList.contains('failure');
        }
      })
    );
    if (searchParams.testPath) {
      header.innerHTML += `<button id="run_all_tests">Run All tests</button>`;
      header.querySelector('#run_all_tests').addEventListener('click', () => {
        location.search = `?` + generateSearchString(
          Object.assign(searchParams, {
            testPath: undefined
          })
        );
      });
    }
    container.appendChild(header);
    container.appendChild(document.createElement('main'));
  }

  const progress = container.querySelector('header progress');
  progress.max = testFiles.length ?? 1;
  progress.value = results ? Object.keys(results).length : 0;

  container.querySelector('main').innerHTML = '';
  container.querySelector('main').appendChild(generateSuiteResultElement(results));
}

function makeErrorResult(error) {
  return {
    success: false,
    error: error,
  };
}

function runAllTests(testPath, testSandboxes, testAggregator) {
  return runRootTestSuite(testPath, testAggregator)
    .then(results => {
      testSandboxes.filter(sandbox => sandbox.error)
        .forEach(sandboxWithError => {
          const sandboxPath = sandboxWithError.filePath;
          results[sandboxPath] = makeErrorResult(sandboxWithError.error);
        });
      return results;
    });
}


function loadConfig(configSrc) {
  if (configSrc) {
    return loadJSON(validateLocalFilePath(configSrc));
  } else {
    return Promise.resolve({});
  }
}

// Expose as globals so they can be accessed from compiled projects
window['__esmunit__api__'] = {
  "runRootTestSuite": runRootTestSuite,
};

window.addEventListener("load", () => {
  let {
    testFile,
    testPath,
    module,
    debug = false,
    config: configSrc,
  } = searchParams;

  let testFiles = [];
  let testSandboxes = [];

  let config;

  if (testPath && typeof testPath === "string") {
    testPath = testPath.split(":");
  }

  let aggregatedResults = {};
  const testAggregator = (testPath, testName, results) => {
    // Only show top-level results for now
    if (!testPath) {
      aggregatedResults[testName] = results;
      displayResults(false, testFiles, aggregatedResults);
      recordResults(false, aggregatedResults);
    }
  };

  const startTime = Date.now();
  const timediff = () => `${(Date.now() - startTime)/1000}s`;
  return loadConfig(configSrc)
    .then(_config => {
      console.debug(`Loaded config at ${timediff()}`);
      config = _config;

      if (module === undefined && 'module' in config) {
        module = config['module'] ?? true;
      }

      if (Array.isArray(config['testFiles'])) {
        testFiles = config['testFiles'];
      }

      if (testFile) {
        testFiles = [testFile];
      }

      // If a path is provided, the file being tested is the first item of the path.
      // Load only that file.
      const fileInPath = testPath && testPath[0];
      if (fileInPath) {
        testFiles = testFiles.filter(testFile => testFile === fileInPath);
      }

      testSandboxes = testFiles.map(testFile => new TestSandbox(testFile, module, config, debug));
      testSandboxes.forEach(sandbox => sandbox.register());

      console.debug(`Registered tests at ${timediff()}`);
      recordResults();
      return runAllTests(testPath, testSandboxes, testAggregator);
    })
    .then(results => {
      console.debug(`Completed tests at ${timediff()}`);
      const coverageReports = testSandboxes.map(sandbox => sandbox.getCoverageReport());
      recordResults(true, results, coverageReports);
      displayResults(true, testFiles, results);
    });
});