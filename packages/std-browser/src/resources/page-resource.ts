import { defineResource, type ResourceDefinition } from "@venn/sdk";

/**
 * A flow-scoped page: one isolated context per flow, so two flows never share
 * a session.
 *
 * `open` hands back a placeholder handle and `close` does nothing, because the
 * runtime does not execute `resource` declarations yet.
 */
export const pageResource: ResourceDefinition = defineResource({
  name: "Page",
  scope: "flow",
  open: () => ({ id: "page-1", url: "about:blank" }),
  close: () => undefined,
});
