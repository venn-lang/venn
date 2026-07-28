/**
 * `@venn-lang/mail`: the verbs that wait on and read an inbox, the `MailClient` port
 * they go through, and the nominal `Email` and `Attachment` types.
 */

export * from "./clients/index.js";
export { mailPlugin, mailPlugin as default } from "./plugin.js";
export * from "./port/index.js";
export * from "./types/index.js";
