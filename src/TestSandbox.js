import { loadScript, setImportMap, validateLocalFilePath } from "./util/loader.js";
import { createRootTestSuite } from "./TestSuite.js";

function injectIframe() {
  return new Promise(resolve => {
    const iframe = document.createElement('iframe');
    iframe.addEventListener("load", () => resolve(iframe));

    // Hide, but don't set display to 'none' since that would break tests that check offsetWidth in Chrome
    Object.assign(iframe, {
      visibility: 'hidden',
      width: '100%',
    });
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);
    return iframe;
  });
}

function getQueryParams(filePath) {
  const match = /\?.+$/.exec(filePath);
  return match ? match[0] : "";
}

export default class TestSandbox {
  constructor(filePath, isModule, config, debug) {
    this.filePath = filePath;
    this.isModule = isModule;
    this.config = config;
    this.debug = debug;
    this.iframe = null;
    this.testSuite = null;
    this.error = null;
    this.loadPromise = null;
  }

  assertIframe() {
    if (!this.iframe || !this.iframe.contentWindow) {
      throw new Error("Test sandbox iframe is not loaded");
    }
  }

  getCoverageReport() {
    if (!this.coverageReport) {
      this.coverageReport = this.iframe?.contentWindow.__coverage__;
    }
    return this.coverageReport;
  }

  cleanup(remove) {
    this.assertIframe();
    this.getCoverageReport();
    if (remove) {
      this.iframe.parentNode.removeChild(this.iframe);
      this.iframe = null;
    } else {
      // Leave it in the DOM for debugging purposes, but set
      // display to 'none' so it won't cause invisible scrolling anymore
      this.iframe.style.display = "none";
    }
  }

  register() {
    const { rootTestSuite, api } = createRootTestSuite(this.filePath, undefined, this, this.debug);
    this.rootTestSuite = rootTestSuite;
    this.api = api;
  }

  load() {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    let iframe, contentWindow, contentDocument;
    const filePath = this.filePath;
    const { includeModules, includeScripts, importMap } = this.config;
    // Append filePath's query params to included modules as well
    const queryPatamSuffix = getQueryParams(filePath);

    return this.loadPromise = injectIframe()
      .then(_iframe => {
        this.iframe = iframe = _iframe;
        ({ contentWindow, contentDocument } = iframe);

        // Create root test suite and setup API
        contentWindow['__esmunit__api__'] = this.api;
      })
      .then(() => {
        // First, set up import map if one exists
        if (importMap) {
          setImportMap(importMap, contentDocument);
        }
        // Then, load non-ES6 include scripts, preserving execution order.
        if (Array.isArray(includeScripts)) {
          return includeScripts.reduce(
            (promise, src) => promise.then(() => loadScript(validateLocalFilePath(src), false, contentDocument)),
            Promise.resolve(),
          );
        }
      })
      .then(() => {
        // Then load ES6 include scripts
        if (Array.isArray(includeModules)) {
          return Promise.all(
            includeModules.map(src => loadScript(
              validateLocalFilePath(src) + queryPatamSuffix,
              true,
              contentDocument
            ))
          );
        }
      })
      .then(() => {
        // Finally load the test file itself
        return loadScript(validateLocalFilePath(this.filePath), this.isModule, contentDocument);
      })
      .catch(error => {
        this.error = error;
      });
    }
  }