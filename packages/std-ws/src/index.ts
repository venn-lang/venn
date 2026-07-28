/**
 * The `ws` plugin: `connect`, `send`, `expect` and `close` over one socket.
 *
 * The socket lives behind the `WsClient` port, so a flow never carries a handle
 * and the same script runs against a real endpoint or the in-memory double.
 */

export * from "./clients/index.js";
export { wsPlugin, wsPlugin as default } from "./plugin.js";
export * from "./port/index.js";
export * from "./types/index.js";
