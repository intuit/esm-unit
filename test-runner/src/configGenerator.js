import { requireDefaultConfig } from './Config.js';
import { glob } from 'glob';


// Generate the esm-unit.json file used by the browser, evaluating
// glob patterns to find a list of actual test files

function isGlobPattern(maybePattern) {
  return /[\*\|\(\)]/.test(maybePattern);
}

function appendQueryParam(filePath, appendQueryConfig) {
  if (typeof appendQueryConfig === 'function') {
    appendQueryConfig = appendQueryConfig(filePath);
  }
  return filePath + appendQueryConfig;
}

async function getTestFiles(config) {
  const {testFiles=['**/*.test.js'], excludeTestFiles} = config.getConfigObject();
  const appendQueryConfig = config.getProperty("appendQuery");

  let foundTestFiles = [];
  for (let fileOrGlob of testFiles) {
    if (isGlobPattern(fileOrGlob)) {
      if (fileOrGlob.startsWith('/')) {
        fileOrGlob = fileOrGlob.substr(1);
      }
      foundTestFiles.push(
        ...await glob(fileOrGlob, {ignore: excludeTestFiles})
      );
    } else {
      foundTestFiles.push(fileOrGlob);
    }
  }
  if (appendQueryConfig) {
    foundTestFiles = foundTestFiles.map(filePath => appendQueryParam(filePath, appendQueryConfig));
  }
  return foundTestFiles;
}

export async function configFileMiddleware(request, response, next) {
  if (request.method === 'GET' && request.path === '/esm-unit.json') {
    const config = requireDefaultConfig();
    const configObject = Object.assign(
      {},
      config.getConfigObject(),
      {testFiles: await getTestFiles(config)}
    );
    response.type('json');
    response.status(200);
    response.send(JSON.stringify(configObject, null, 2));
  } else {
    next();
  }
}
