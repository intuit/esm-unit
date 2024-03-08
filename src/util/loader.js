
export function validateLocalFilePath(path) {
  if (!(
    typeof path === 'string'
      && !path.includes(':') && !path.includes('//') && !path.includes('..')
      && /^[@\w\/\.\?=&-]+$/.test(path)
  )) {
    throw new TypeError(`Invalid local file path ${path}`);
  }
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  return path;
}
export function loadScript(src, isModule = false, inDocument = document) {
  return new Promise((resolve, reject) => {
    const script = inDocument.createElement('script');
    script.src = src;
    if (isModule) {
      script.type = "module";
    };
    script.addEventListener("load", resolve);
    script.addEventListener("error", () => {
      reject(new Error(`Failed to load ${src}. The file could be missing or contain a syntax error.`));
    });
    inDocument.head.appendChild(script);
  });
}

export function setImportMap(map, inDocument = document) {
  if (inDocument.head.querySelector('script[type="importmap"]')) {
    throw new Error("Import maps can only be set once per specification.");
  }
  const script = inDocument.createElement('script');
  script.type = "importmap";
  script.textContent = JSON.stringify(map, null, 2);
  inDocument.head.appendChild(script);
}

const FILE_LOAD_TIMEOUT_SECONDS = 20;
export function loadTextFile(src) {
    function xhrError(xhr, reason) {
      const error = new Error(`Error loading ${src}: ${reason}`);
      error.xhr = xhr;
      return error;
    }

    return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.timeout = FILE_LOAD_TIMEOUT_SECONDS * 1000;
    xhr.open("GET", src, true);
    xhr.addEventListener('error', () => reject(xhrError(xhr, 'connection error')));
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        reject(xhrError(xhr, `HTTP status ${xhr.status}`));
      }
    });
    xhr.addEventListener('timeout', () => {
      reject(xhrError(xhr, `timed out at ${FILE_LOAD_TIMEOUT_SECONDS} seconds`));
    });
    xhr.send();
  });
}

export function loadJSON(src) {
  return loadTextFile(src)
    .then(responseText => JSON.parse(responseText));
}
