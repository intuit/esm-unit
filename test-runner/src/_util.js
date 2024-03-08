import fs from 'fs';
import path from 'path';
import net from 'net';

import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const esmUnitDir = path.resolve(__dirname, "../..");
const esmUnitPackageJson = readJSON(path.join(esmUnitDir, "package.json"));

export function getEsmUnitRelativePath() {
    const rootDir = process.cwd();
    let relativePath = path.relative(rootDir, esmUnitDir);
    if (relativePath === "") {
      relativePath = ".";
    } else if (relativePath.startsWith("../")) {
        // Outside the current directory, which might happen if we're using npm link
        relativePath = path.join("node_modules", esmUnitPackageJson.name);
        if (!fs.existsSync(relativePath)) {
            throw new Error(`Couldn't find the esm-unit; it's not inside the current directory and isn't at ./${relativePath}`);
        }
    }
    return relativePath;
}


export function readJSON(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    } else {
        const jsonSource = fs.readFileSync(filePath);
        try {
            return JSON.parse(jsonSource);
        } catch (parseError) {
            throw new Error(`Error parsing JSON file at ${filePath}: ${parseError}`)
        }
    }
}

// Pass number as 'ports' to search all ports starting with that one.
// Pass array as 'ports' to limit search to only the port numbers in that array.
export const findPort = function _findPort(ports) {
  if (!ports)
      ports = 11111;

  var port, index;
  var incrementing = false;
  if (typeof ports === "number") {
      ports = [ports];
      incrementing = true;
  } else {
      index = 0;
  }
  port = ports[0];


  return new Promise(function(resolve) {
      var server = net.createServer();
      server.listen(port, function() {
          server.once('close', function () {
              resolve(port);
          });
          server.close()
      });
      server.on('error', function() {
          if (incrementing) {
              port++;
          } else {
              if (++index >= ports.length) {
                  throw "Couldn't find an open port among "+ports;
              }
              port = ports[index];
          }

          resolve(_findPort(port+1));
      });
  });
}
