/* node:coverage disable */
import { runTests } from "../index.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

await import("./unit/assert.test.js");
await import("./unit/util/loader.test.js");

async function runIntegrationTests() {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const options = {
      debug: false,
      browsers: ["chrome"],
      headless: true,
      config: join(__dirname, "./esm-unit.integration.config.cjs"),
      remote: false,
      verbose: false,
      watch: false,
      coverage: false,
    };
    const { success } = await runTests(options);
    process.exit(success ? 0 : 1);
  } catch (err) {
    console.error(err.stack || "Error: " + err);
    process.exit(1);
  }
}

runIntegrationTests();
