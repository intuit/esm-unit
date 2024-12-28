import { describe, test, assert } from "esm-unit/test-api.js";

describe("test-context", () => {
  /**
   *  This is needed if anything dependant on ServiceWorker is used inside the test
   */
  test("it should have document.location.host defined", () => {
    assert.equal("localhost:17777", document.location.host);
  });
});
