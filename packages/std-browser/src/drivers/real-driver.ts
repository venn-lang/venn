import { VennError } from "@venn/contracts";
import { type BrowserDriver, BrowserDriverPort } from "../port/index.js";

function notImplemented(): VennError {
  return new VennError({
    code: "VN8090",
    message: "browser real driver not implemented in this build",
  });
}

/**
 * The engine-driving `BrowserDriver`. Not wired up in this repo, which ships
 * the language rather than an automation backend.
 *
 * Methods are generated from the port descriptor, so the stub cannot fall
 * behind the interface.
 *
 * @returns a driver whose every method throws, so the gap is a legible failure
 * rather than a test that passes against nothing.
 * @throws {VennError} `VN8090` on any call.
 */
export function createRealBrowserDriver(): BrowserDriver {
  const fail = (): never => {
    throw notImplemented();
  };
  const entries = BrowserDriverPort.methods.map((method) => [method, fail] as const);
  return Object.fromEntries(entries) as unknown as BrowserDriver;
}
