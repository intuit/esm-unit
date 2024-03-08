"use strict";

import ProgressBar from './ProgressBar.js';
import path, { normalize } from 'path';
import {getEsmUnitRelativePath} from './_util.js';
import fs from 'fs';
import TestServer from './TestServer.js';

import webdriver from 'selenium-webdriver';

import {Options as ChromeOptions} from 'selenium-webdriver/chrome.js';
import {Options as FirefoxOptions} from 'selenium-webdriver/firefox.js';
import {Options as EdgeOptions} from 'selenium-webdriver/edge.js';

import { exec } from 'child_process';

import {
  createCoverageMap,
  generateCoverageReport,
  getCoverageThresholdMap,
  enforceCoverageThresholds,
} from './coverage.js';

function formatBrowserName(capabilities) {
  let browserName = capabilities.getBrowserName?.() ?? capabilities['browserName'];
  let version = capabilities.getBrowserVersion?.() ?? capabilities['version'];
  let platform = capabilities.getPlatform?.() ?? capabilities['platform'];

  browserName = browserName.replace(/\b[a-z]/g, function(match) {
      return match[0].toUpperCase();
  });
  if (["Msedge", "MicrosoftEdge"].includes(browserName)) {
    browserName = "Edge";
  }

  const platformName = platform?.toLowerCase();
  if (platformName?.startsWith("mac")) {
    platform = "Mac";
  } else if (platformName == "linux") {
    platform = "Linux";
  }

  version = version?.split('.')[0];

  var formatted = browserName;
  if (version) {
      formatted += ` ${version}`;
  }
  if (platform) {
      formatted += ` on ${platform}`;
  }
  return formatted;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function timeoutWithError(ms, message=`Timed out after ${ms.toLocaleString()} ms`) {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error(message), ms), ms);
  });
}

function timeoutPromise(promise, ms, message) {
  return Promise.race([
    promise,
    timeoutWithError(ms, message),
  ]);
}

async function getBrowserName(driver, capabilities = null) {
  if (!capabilities) {
    capabilities = await driver.getCapabilities();
  }
  return capabilities.getBrowserName().toLowerCase();
}

function normalizeBrowserName(browserName) {
  if (browserName == "edge") {
    browserName = "MicrosoftEdge";
  }
  return browserName;
}

import { getDefaultConfig } from './Config.js';

const SELENIUM_SERVER = process.env.SELENIUM_SERVER || "http://localhost:4444/wd/hub";

export default class TestRunner {
  constructor(options) {
    this.options = options;
    this.autoRun = !options.debug;
    this.verbose = Boolean(options.verbose);
    this.testResults = [];
    this.config = getDefaultConfig();
    this.runRemote = this.autoRun && !!options.remote;
    this.remoteServer = this.runRemote ? SELENIUM_SERVER : null;

    this.subprocesses = [];

    if (!options.config && !options.testFile) {
      throw "No test files specified.";
    }

    this.progressBar = new ProgressBar({
      labelStyle: "ratio"
    });
  }

  getRemoteConfig() {
    const remoteConfigName = this.options.remote;
    const { config } = this;
    const remoteConfig = config.configObject.remote?.[remoteConfigName];
    if (!remoteConfig) {
      throw `No remote config for ${remoteConfigName} set in ${config.configFile}`;
    }
    return remoteConfig;
  }

  getCapabilitiesFromConfig() {
    let capabilitiesList = [];
    if (this.runRemote) {
      const sourceCapabilities = this.getRemoteConfig()["capabilities"];
      if (!sourceCapabilities) {
        throw "No capabilities defined in remote config";
      }

      for (const capabilities of sourceCapabilities) {
        // Support singular 'browserName: "chrome"' or plural 'browserNames: ["chrome", "safari"]'
        const {
          browserName, browserNames = [browserName],
          version = "", versions = [version],
          platform = "", platforms = [platform],
        } = capabilities;

        // Flatten into multiple capabilities entries
        for (const browserName of browserNames) {
          for (const platform of platforms) {
            for (const version of versions) {
              capabilitiesList.push({
                browserName: normalizeBrowserName(browserName),
                version,
                platform,
                [webdriver.Capability.ACCEPT_INSECURE_TLS_CERTS]: true,
              });
            }
          }
        }
      }
    } else {
      capabilitiesList = this.options.browsers.map(
        browserName => ({
          browserName: normalizeBrowserName(browserName),
          [webdriver.Capability.ACCEPT_INSECURE_TLS_CERTS]: true,
        })
      )
    }
    return capabilitiesList;
  }

  logVerbose(...args) {
    if (this.verbose) {
      console.info(...args);
    }
  }

  async startHttpServer() {
    if (this.options.httpServer) {
      this.httpServerUrl = this.options.httpServer;
      if (!this.httpServerUrl.endsWith('/')) {
        this.httpServerUrl += '/';
      }
    } else {
      this.logVerbose('Starting TestServer');
      this.httpServer = new TestServer(process.cwd(), {coverage: this.options.coverage})
      const httpPort = await this.httpServer.start();
      this.httpServerUrl = `http://localhost:${httpPort}/`;
    }
  }

  stopHttpServer() {
    if (this.httpServer) {
      this.logVerbose('Stopping TestServer');
      return this.httpServer.stop();
    }
  }

  getBrowserRunnerUrl(configFile, testFile) {
    const urlParams = ['debug'];
    if (configFile) {
      // Assume user is using this dev server, or the config generator middleware in their
      // custom dev server:
      urlParams.push("config=esm-unit.json");

      /*
      urlParams.push(`config=${encodeURIComponent(
        path.relative(process.cwd(), configFile)
      )}`);
      */
    }
    if (testFile) {
      urlParams.push(`testFile=${encodeURIComponent(
        '/' + path.relative(process.cwd(), testFile)
      )}`);
      if (!configFile) {
        // Assume testFile is an ES module if the config file
        // doesn't exist
        urlParams.push("module")
      }
    }

    return `${this.httpServerUrl}${getEsmUnitRelativePath()}/runner.html?${urlParams.join("&")}`;
  }

  async runTests() {
    const options = this.options;

    await this.startHttpServer();

    let success = false;

    try {
      let testSuites = options.suites;

      if (this.autoRun) {
        // No progress bar needed until we can show progress on individual tests
        // this.progressBar.start("Running Tests:");
        success = await this._runAutomated(options.config, [options.testFile]);

        if (this.options.coverage) {
          success = success && await this.generateCoverageReport();
        }
      } else {
        await this._runManual(testSuites ? testSuites[0] : "")
        success = true;
      }
    } finally {
      this.progressBar.end();

      console.log("\nShutting down servers...");
      await this.stopHttpServer();
    }

    return success;
  }

  _runManual() {
    return new Promise((resolve, reject) => {
      const options = this.options;
      const open = (process.platform == 'darwin'? 'open': process.platform == 'win32'? 'start': 'xdg-open');
      const url = this.getBrowserRunnerUrl(options.config, options.testFile);

      console.log(`Point your favorite browser at ${url}`);
      exec(`${open} '${url}'`);

      process.on('SIGINT', function() {
        console.log();
        resolve(true);
      });
    });
  }

  watchTestDirectory() {
    let watchPromise;
    let resolveWatchPromise;
    const watchDir = this.config && this.config.getProperty("watchDirectory") || process.cwd();

    function _refreshWatchPromise() {
      watchPromise = new Promise(_resolve => {
        resolveWatchPromise = _resolve;
      });
    }
    const watcher = fs.watch(watchDir, {
      recursive: true
    });
    watcher.on("change", () => {
      console.log("Change detected, resolving...");
      const resolve = resolveWatchPromise;
      _refreshWatchPromise();
      resolve();
    });
    _refreshWatchPromise();

    return {
      waitForChanges() {
        return watchPromise;
      },
      stopWatching() {
        watcher.close();
      }
    }
  }

  async _runAutomated() {
    const options = this.options;

    const capabilitiesList = this.getCapabilitiesFromConfig();

    this.progressBar.log("Running tests");

    const url = this.getBrowserRunnerUrl(options.config, options.testFile);

    const drivers = (await Promise.all(
      capabilitiesList.map(async capabilities => {
        return await this.launchBrowserWithCapabilities(
          capabilities,
        )}
      )
    )).filter(Boolean); // Filter out drivers that couldn't launch

    let stopTests, userHasStopped = false;
    const userStoppedPromise = new Promise( (_, reject) => {
      stopTests = () => {
        userHasStopped = true;
        reject("User Cancelled");
      };
    });

    process.on('SIGINT', stopTests);

    let success, firstRun = true;

    let waitForChanges, stopWatching;
    if (options.watch) {
      ({waitForChanges, stopWatching} = this.watchTestDirectory());
    }

    // Run tests, repeating if --watch is specified
    do {
      try {
        if (options.watch && !firstRun) {
          // Clear back buffer:
          process.stdout.write("\u001b[3J\u001b[2J\u001b[1J");
          console.clear();
        }
        this.logVerbose("Running tests...");
        const testResults = await Promise.race([
          userStoppedPromise,
          Promise.all(
            drivers.map(async driver => {
              if (firstRun) {
                this.logVerbose(`Waiting for driver.get(${JSON.stringify(url)})`)
                await driver.get(url);
              } else {
                this.logVerbose(`Refreshing (${JSON.stringify(url)})`);
                await driver.manage().logs().get(webdriver.logging.Type.BROWSER); // Clear logs
                await driver.navigate().refresh();
              }

              return await this.runTestWithBrowser(driver, url);
            })
          ),
        ]);

        if (!testResults.length) {
          throw new Error("No tests ran");
        }

        const successes = testResults.map(results => results.success);
        success = successes.reduce((previousValue, currentValue) => {
            // false means a test failure, but null means tests couldn't be run.
            // Only reduce to failure if it's actually 'false'.
            return previousValue !== false && currentValue !== false;
        }, true);
      } catch (error) {
        console.error(error);
        success = false;
      }
      if (options.watch) {
        // TODO: Actually watch for changes.
        // Until then, just wait a few seconds
        firstRun = false;
        await this.generateCoverageReport();

        console.log("\nWaiting for changes. Control-C to end.");
        await Promise.race([waitForChanges(), userStoppedPromise]);
      }
    } while (options.watch && !userHasStopped);

    if (options.watch) {
      stopWatching();
    }

    process.removeListener('SIGINT', stopTests);
    await Promise.all(drivers.map(driver => driver.quit()));

    return success;
  }

  async launchBrowserWithCapabilities(capabilities) {
    var builder = new webdriver.Builder();
    if (this.runRemote) {
      builder.usingServer(this.remoteServer);
    }
    builder.withCapabilities(capabilities);

    this.logVerbose('Running tests for capabilities ' + JSON.stringify(capabilities));

    const chromeOptions = new ChromeOptions();
    const firefoxOptions = new FirefoxOptions();
    const edgeOptions = new EdgeOptions();

    if (this.runRemote || this.options.headless) {
      chromeOptions.addArguments(["--disable-gpu", "--disable-dev-shm-usage", "--incognito", "--disable-extensions"]);
      edgeOptions.addArguments(["--disable-gpu", "--disable-dev-shm-usage", "--incognito", "--disable-extensions"]);
    }

    if (!this.runRemote && this.options.headless) {
      this.logVerbose('Running headless');
      chromeOptions.addArguments([
        "--window-size=1920,1080", // Make Chrome work with less RAM
        "--headless=new",
      ]);
      firefoxOptions.addArguments('-headless');

      const loggingPrefs = new webdriver.logging.Preferences();
      loggingPrefs.setLevel(webdriver.logging.Type.BROWSER, webdriver.logging.Level.ALL);

      chromeOptions.setLoggingPrefs(loggingPrefs)
      firefoxOptions.setLoggingPrefs(loggingPrefs)
      edgeOptions.setLoggingPrefs(loggingPrefs);
    }

    builder.setChromeOptions(chromeOptions);
    builder.setFirefoxOptions(firefoxOptions);
    builder.setEdgeOptions(edgeOptions);

    this.logVerbose('Building driver')
    var driver = builder.build();

    try {
      this.progressBar.log(`Launching ${formatBrowserName(capabilities)}`);
      await timeoutPromise(driver.getTitle(), 60000);
      return driver;
    } catch (error) {
      console.warn(`Can't open ${formatBrowserName(capabilities)}, skipping:`, error);
      return null;
    }
  }

  async runTestWithBrowser(driver, url) {
    try {
      const results = await this.runTestWithDriver(driver, url);
      await this.printBrowserLogs(driver, results?.logs, !results?.success);
      if (
        results?.success
        && this.config.getProperty('failOnErrorLogs')
        && results.logs?.some(log => String(log.level) === 'SEVERE'
      )) {
        this.progressBar.error("\nFAIL (failOnErrorLogs): Browser console must be free of error logs.");
        results.success = false;
      }
      return results;
    } catch (error) {
      this.logVerbose(`Caught error in runTestWithDriver: ${error}`);
      this.progressBar.error(`${error ? error.stack || error : "Unknown error"}`);
      return {
        success: false,
      };
    }
  }

  async runTestWithDriver(driver, url) {
    const capabilities = await driver.getCapabilities();
    const browserName = await getBrowserName(driver, capabilities);
    this.logVerbose('Loading test at ' + url);
    const startTime = Date.now();
    const timediff = () => `${(Date.now() - startTime) / 1000}s`;
    let userAgent;
    let aggregatedResults;

    const printAggregatedResults = true;
    let erroredOut = false;

    try {
      let loaded = false;
      let results;

      this.progressBar.log(`Running tests in ${formatBrowserName(capabilities)}`);

      await timeoutPromise(
        (async () => {
          while (!erroredOut && !(results?.finished)) {
            await wait(250);
            const resultsJson = await driver.executeScript(`
                return window.__esmunit_results__ && JSON.stringify({
                  finished: __esmunit_results__.finished,
                  success: __esmunit_results__.success,
                  report: __esmunit_results__.results,
                  coverage: __esmunit_results__.coverage,
                  userAgent: navigator.userAgent
                });
              `);
            results = resultsJson && { browserName, ...JSON.parse(resultsJson) };
            if (results && !loaded) {
              loaded = true;
              this.logVerbose(`Tests loaded at ${url} in ${timediff()}`);
            }
            if (printAggregatedResults && results) {
              for (const suiteName of Object.keys(results.report)) {
                if ( !aggregatedResults || !(suiteName in aggregatedResults.report) ) {
                  this.printReport(
                    {[suiteName]: results.report[suiteName]},
                    formatBrowserName(capabilities),
                  );
                }
              }
              aggregatedResults = results;
            }
          }
        })(),
        120000, "Tests timed out after 120 seconds"
      );
      this.logVerbose(`\nTests finished at ${url} in ${timediff()}`);

      this.progressBar.tick();
      this.testResults.push(results);
      if (!printAggregatedResults) {
        this.progressBar.log("");
        this.printReport(results.report, results.browserName);
      }
      results.logs = await this.getBrowserLogs(driver);
      return results;
    } catch (error) {
      erroredOut = true;
      this.logVerbose(`Caught error while running test: ${error}`);
      this.progressBar.error(error);
      this.progressBar.error(error.stack);
      this.progressBar.tick();
      return {
        success: false,
        error: true,
        report: error ? (error.stack || ""+error) : "Unknown error",
        logs: await this.getBrowserLogs(driver),
        userAgent: userAgent
      }
    }
  }

  async getBrowserLogs(driver) {
    if (["chrome", "msedge"].includes(await getBrowserName(driver))) {
      // Browser logs only supported in Chrome
      return await driver.manage().logs().get(webdriver.logging.Type.BROWSER) || []
    }
  }

  async printBrowserLogs(driver, logs, forceVerbose) {
    const verbose = this.options.verbose || forceVerbose;
    if (!verbose) {
      logs = logs?.filter(({level}) => String(level) === 'SEVERE');
    }

    if (logs?.length) {
      this.progressBar.log(`\nBrowser logs for ${formatBrowserName(await driver.getCapabilities())} (${verbose ? "all" : "severe"}):`);

      for (const log of logs) {
        const {level, message, timestamp, type} = log;
        const date = new Date(timestamp);
        const logMethod = String(level) === 'SEVERE' ? 'error' : 'log';
        this.progressBar[logMethod](`${date.toISOString()} [${level}]: ${message}${type ? ` (type=${type})` : ''}`);
      }
    }
  }

  async generateCoverageReport() {
    const testResults = this.testResults;

    const coverageThresholdMap = await getCoverageThresholdMap();

    // Concatenate coverage reports all together into one flat array
    const allCoverage = testResults
      .map(results => results.coverage)
      .reduce(
        (combined, coverage) => combined.concat(coverage),
        []
      );

    const coverageMap = createCoverageMap(allCoverage, Object.keys(coverageThresholdMap));

    this.progressBar.log("");
    await generateCoverageReport(coverageMap);

    return enforceCoverageThresholds(coverageMap, coverageThresholdMap);
  }

  printReport(report, browserName) {
    const multiBrowser = this.options.browsers.length > 1 || this.runRemote;
    const browser = multiBrowser ? ` (${browserName})` : '';

    const _printResultNode = (nodeName, nodeResult, indent = "") => {
      const {
        success,
        error,
        subTests,
      } = nodeResult;

      // Remove query param, but only at the top level (since that's a file path):
      const nodeLabel = indent ? nodeName : nodeName.replace(/\?.*$/, "");

      if (success) {
        this.progressBar.log(indent + `PASS${browser}: ${nodeLabel}`);
      } else {
        this.progressBar.error(indent + `FAIL${browser}: ${nodeLabel}`);
        if (error) {
          this.progressBar.error(indent + error.message);
          if (typeof error.stack === "string") {
            this.progressBar.error();
            error.stack.split("\n").forEach(
              line => { this.progressBar.error(indent + line); }
            );
            this.progressBar.error();
          }
        }
        _printSubtestResults(subTests, indent + "  ");
      }
    }

    const _printSubtestResults = (subTests, indent = "") => {
      if (subTests) {
        for (const subtestName of Object.keys(subTests)) {
          _printResultNode(subtestName, subTests[subtestName], indent);
        }
      }
    }

    _printSubtestResults(report);
  }
}