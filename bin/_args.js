import fs from 'fs';
import path from 'path';

import { ArgumentParser } from 'argparse';
export { SUPPRESS } from 'argparse';

function directoryType(aPath, required) {
    var exists = fs.existsSync(aPath);
    if (required && !exists) {
        throw new TypeError("Directory doesn't exist");
    } else if (exists && !fs.statSync(aPath).isDirectory) {
        throw new TypeError("Not a directory");
    } else if (!fs.existsSync(path.dirname(aPath))) {
        throw new Error(`Can't find ${path.dirname(aPath)}`);
    }
    return aPath;
}

function fileType(aPath, required) {
    aPath = path.resolve(aPath);
    var exists = fs.existsSync(aPath);
    if (required && !exists) {
        throw new TypeError("File doesn't exist");
    } else if (!fs.existsSync(path.dirname(aPath))) {
        throw new Error(`Can't find ${path.dirname(aPath)}`);
    }
    return aPath;
}

export const directory = aPath => directoryType(aPath, false);
export const existing_directory = aPath => directoryType(aPath, true);
export const file = aPath => fileType(aPath, false);
export const existing_file = aPath => fileType(aPath, true);
export const url = string => {
    if (!/^https?:\/\//.test(string)) {
        throw new TypeError("Not a URL");
    }
    return string;
}

export function getParser(description) {
    var parser = new ArgumentParser({ description });
    return parser;
};
