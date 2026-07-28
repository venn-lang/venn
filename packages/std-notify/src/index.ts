/**
 * `@venn/notify`: the verbs that tell someone what a run did (`slack`,
 * `webhook`, `email`) and the `Notifier` port they dispatch through.
 */

export * from "./actions/index.js";
export * from "./clients/index.js";
export { notifyPlugin, notifyPlugin as default } from "./plugin.js";
export * from "./port/index.js";
