export function wait(timeInMS) {
  return new Promise(resolve => {
    setTimeout(resolve, timeInMS);
  });
}