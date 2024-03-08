import { readJSON } from './_util.js';
import { resolve } from 'path';

let defaultConfig;

export default class Config {
  constructor(configFile) {
    this.configFile = configFile || null;
    this.configObject = {};
  }

  async refresh() {
    if (this.configFile) {
      let config, configFile = this.configFile;
      if (configFile.endsWith('js')) {
        config = (await import(resolve(configFile))).default;
      } else {
        config = readJSON(this.configFile) || {}
      }
      if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new TypeError(`Invalid config file at ${this.configFile}`);
      }
      this.configObject = config;
    }
  }

  getConfigObject() {
    return this.configObject;
  }

  getProperty(propertyPath, defaultValue=null) {
    const propertyNames = propertyPath.split('.');

    let value = this.configObject;
    for (let property of propertyNames) {
      value = value && value[property];
    }

    return value !== undefined ? value : defaultValue;
  }
}

export async function loadDefaultConfig(configFile) {
  defaultConfig = new Config(configFile);
  await defaultConfig.refresh();
  return defaultConfig;
}

export function getDefaultConfig() {
  return defaultConfig;
}

export function requireDefaultConfig() {
  const config = getDefaultConfig();
  if (!config) {
    throw new Error("ESM Unit has not been initialized");
  }
  return config;
}