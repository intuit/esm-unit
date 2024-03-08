
export default class AssertionError extends Error {
  /**
   * @param {!string} message A required validation error type
   * @param {string=} description An optional description of the error
   */
  constructor(message, description="") {
    super();
    this.message = description ? `${message}: ${description}` : message;
  }
}
