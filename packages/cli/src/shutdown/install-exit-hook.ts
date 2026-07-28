import process from "node:process";
import type { Shutdown, Unregister } from "./shutdown.types.js";

/**
 * The quiet ending: a program that simply ran out of things to do.
 *
 * `beforeExit` is the only moment a script without a server gets, so its
 * `teardown` has to run here or it never runs at all. The timer is what buys
 * the closing its time: a promise alone does not hold the loop open, and
 * without it Node could leave mid-cleanup.
 */
export function installExitHook(shutdown: Shutdown): Unregister {
  const onBeforeExit = () => {
    const hold = setInterval(() => {}, 1_000);
    void shutdown.close().finally(() => clearInterval(hold));
  };
  process.once("beforeExit", onBeforeExit);
  return () => {
    process.off("beforeExit", onBeforeExit);
  };
}
