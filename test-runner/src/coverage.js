import { existsSync, readFileSync } from 'fs';
import path from 'path';

import { createInstrumenter } from 'istanbul-lib-instrument';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';
import { glob } from 'glob';

const {createCoverageMap: istanbulCreateCoverageMap} = libCoverage;

const instrumenter = createInstrumenter({
  isModule: true,
});

const INSTRUMENT_CACHE = Object.create(null);

function _getCached(filePath, fileSource) {
  if (filePath in INSTRUMENT_CACHE) {
    const cachedRecord = INSTRUMENT_CACHE[filePath];
    if (cachedRecord.source === fileSource) {
      return cachedRecord.instrumented;
    }
  }
}

function _saveCache(filePath, source, instrumented) {
  INSTRUMENT_CACHE[filePath] = {source, instrumented};
}

export function instrumentFile(filePath, source) {
  // Stripe initial '/' from path
  filePath = filePath.substr(1);
  let instrumented = _getCached(filePath, source);

  if (!instrumented) {
    instrumented = instrumenter.instrumentSync(source, filePath)
    _saveCache(filePath, source, instrumented);
  }
  return instrumented;
}

// TODO: Replace with a config using glob patterns:
function shouldCoverFilePath(filePath) {
  return (filePath.endsWith(".js") || filePath.endsWith(".jsx"))
      && !filePath.endsWith('.test.js')
      && !filePath.includes('node_modules')
      && !filePath.includes('localized')
      && !filePath.endsWith('.xhtml.js')
}

export function postprocessorCoverageMiddleware(request, response, next) {
  const filePath = request.path;
  if (request.method === 'GET' && shouldCoverFilePath(filePath)) {
      const send = response.send;
      response.sendUninstrumented = send;
      response.send = function(body, ...extraArgs) {
          send.call(this, instrumentFile(request.path, body), ...extraArgs);
      };
  }
  next();
}

// Assumes baseDir is process.cwd
export function staticCoverageMiddleware(request, response, next) {
  const baseDir = process.cwd();
  const filePath = path.join(baseDir, request.path);
  if (request.method === 'GET' && shouldCoverFilePath(filePath) && existsSync(filePath)) {
    const jsSource = readFileSync(filePath, {encoding: 'utf8'});
    const send = response.sendUninstrumented || response.send;

    response.status(200);
    response.type('js');
    send.call(response, instrumentFile(request.path, jsSource));
  } else {
    next();
  }
}

export function createCoverageMap(coverageReports, coveredFiles) {
  const coverageMap = istanbulCreateCoverageMap();

  for (let report of coverageReports) {
    coverageMap.merge(istanbulCreateCoverageMap(report));
  }

  if (coveredFiles) {
    // Remove non-covered files from the report
    coverageMap.filter(filePath => coveredFiles.includes(filePath));

    // Add covered files that weren't autopmatically detected
    // by Istanbul to report as blanks
    const blanksMap = istanbulCreateCoverageMap();
    for (let filePath of coveredFiles) {
      blanksMap.addFileCoverage(filePath);
    }
    coverageMap.merge(blanksMap);
  }

  return coverageMap;
}

export async function generateCoverageReport(coverageMap) {
  const config = requireDefaultConfig();
  const reportTypes = config.getProperty('reports.reporters', ['lcov', 'json', 'text']);
  const outputDirName = config.getProperty('reports.directory', 'coverage')
  const outputDirectory = path.join(process.cwd(), outputDirName);

  for (const reportType of reportTypes) {
    try {
      const context = libReport.createContext({
        dir: outputDirectory,
        // clover breaks when used with "nested" on some repos. 
        // clover is primarily used for reporting to ODL, which doesn't care
        // about individual file reports, only the general one so this
        // should be ok.
        // see istanbul bug that would fix this workaround here:
        // https://github.com/istanbuljs/istanbuljs/pull/716
        defaultSummarizer: reportType === 'clover' ? 'flat' : 'nested',
        //watermarks: configWatermarks,
        coverageMap,
      });
      const report = reports.create(reportType);
      report.execute(context);
    } catch (error) {
      console.error(`Error generating report ${reportType}`, error);
    }
  }
  console.log(`Coverage reports written to ${path.relative(process.cwd(), outputDirectory)}/`);
}

export function enforceCoverageThresholds(coverageMap, coverageThresholdMap) {
  let passed = true;

  for (let [filePath, thresholds] of Object.entries(coverageThresholdMap)) {
    if (!thresholds) {
      continue;
    }

    const fileCoverage = coverageMap.fileCoverageFor(filePath);
    const summary = fileCoverage.toSummary().toJSON();
    const typeKeys = ["lines", "functions", "statements", "branches"]
      .filter(key => typeof thresholds[key] === 'number');

    const failures = [];
    for (let key of typeKeys) {
      const threshold = thresholds[key];
      const actual = summary[key].pct;
      if (threshold > actual) {
        failures.push({key, threshold, actual});
      }
    }

    if (failures.length) {
      passed = false;

      console.error(`Failed to meet threshold for ${filePath}: `
        + failures.map(
          ({key, threshold, actual}) => `${key}: ${actual}% (expected ${threshold}%)`
        ).join(', ')
      );
    }
  }

  return passed;
}

import { requireDefaultConfig } from './Config.js';
export async function getCoverageThresholdMap() {
  const config = requireDefaultConfig();
  const coverage = config.getProperty('coverage');
  const coveredFiles = {};
  if (Array.isArray(coverage)) {
    for (let coverageConfig of coverage) {
      const {includeFiles, excludeFiles, threshold} = (coverageConfig || {});
      if (
        !Array.isArray(includeFiles)
        || includeFiles.some(config => !config || typeof config !== 'string')
      ) {
        throw new Error("Invalid coverage config: includeFiles is required")
      }

      for (let pattern of includeFiles) {
        const matchingFiles = await glob(pattern, {ignore: excludeFiles});
        for (let file of matchingFiles) {
          coveredFiles[file] = threshold;
        }
      }
    }
  }

  return coveredFiles;
}