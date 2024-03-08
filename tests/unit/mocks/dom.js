/* node:coverage disable */

/*
 * Contains only the minimal amount of DOM mocking needed
 * to run esm-unit's browser runner tests in Node's test
 * runner
 */

import { mock } from 'node:test';

class EventTarget {
  #callbacks = Object.create(null);
  addEventListener(eventName, handler) {
    if (!this.#callbacks[eventName]) {
      this.#callbacks[eventName] = [];
    }
    this.#callbacks[eventName].push(handler);
  }
  dispatchEvent(event) {
    const { type } = event;
    this.#callbacks[type]?.forEach(
      callback => {
        try {
          typeof callback === 'function'
            ? callback(event)
            : callback?.handleEvent?.(event);
        } catch (error) {
          console.error(error);
        }
      }
    )
  }
}

class Event {
  constructor(type) {
    this.type = type;
  }
}
class XMLHttpRequest extends EventTarget {
  constructor() {
    super();
    this.status = 0;
    this.timeout = 0;
    this.responseText = "";
  }
  open(method, src, isAsync) {
    if (!isAsync) {
      throw new Error(`Sync loading not supported by this mock`);
    }
  }
  send() {}
}

export function setupDOMMocks() {
  global.Event = mock.fn(Event);
  global.EventTarget = mock.fn(EventTarget);
  global.XMLHttpRequest = mock.fn(XMLHttpRequest);
}

export function tearDownDOMMocks() {
  delete global.Event;
  delete global.EventTarget;
  delete global.XMLHttpRequest;
}
