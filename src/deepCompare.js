function getType(value) {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function str(value) {
  return JSON.stringify(value) || getType(value);
}

function throwDifference(reason, path) {
  const prefix = path ? `${path}: ` : '';
  throw `${prefix}${reason}`;
}

function deepCompareObjects(expected, actual, path) {
  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(actual);
  for (const key of expectedKeys) {
    if (!actualKeys.includes(key)) {
      throwDifference(`missing property "${key}"`, path);
    }
    deepCompare(expected[key], actual[key], path ? `${path}.${key}` : key);
  }
  if (actualKeys.length > expectedKeys.length) {
    const extraKeys = actualKeys
      .filter(key => !expectedKeys.includes(key))
      .map(key => str(key));
    throwDifference(`extra ${
      extraKeys.length > 1 ? "properties" : "property"
    } ${extraKeys.join(', ')}`, path);
  }
}

function deepCompareArrays(expected, actual, path) {
  if (expected.length !== actual.length) {
    throwDifference(`expected array with ${expected.length} item(s), found ${actual.length} items`, path);
  }
  expected.forEach(
    (value, index) => deepCompare(value, actual[index], `${path}[${index}]`)
  );
}

function deepCompare(expected, actual, path) {
  const expectedType = getType(expected);
  const actualType = getType(actual);
  if (expectedType !== actualType) {
    throwDifference(`expected ${expectedType}, found ${actualType}`, path);
  }
  switch (expectedType) {
    case "array":
      return deepCompareArrays(expected, actual, path);
    case "object":
      return deepCompareObjects(expected, actual, path);
    default:
      if (expected !== actual) {
        throwDifference(`expected ${str(expected)}, found ${str(actual)}`, path);
      }
  }
}

export function findDeepDifference(expected, actual) {
  try {
    deepCompare(expected, actual, "");
    return "";
  } catch (failureReason) {
    return failureReason;
  }
}