import { defineResource, type ResourceDefinition } from "@venn/sdk";

/**
 * A worker-scoped browser: one engine per worker, shared by every flow that
 * worker runs.
 *
 * `open` hands back a placeholder handle and `close` does nothing, because the
 * runtime does not execute `resource` declarations yet.
 */
export const browserResource: ResourceDefinition = defineResource({
  name: "Browser",
  scope: "worker",
  open: () => ({ id: "browser-1", engine: "chromium" }),
  close: () => undefined,
});
