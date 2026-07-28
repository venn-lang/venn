/**
 * The `grpc` plugin: `call`, `stream` and `reflect`.
 *
 * Requests and responses stay dynamic because their shape lives in a `.proto`
 * this package never reads. Reflection is the one thing it can type.
 */

export * from "./clients/index.js";
export { grpcPlugin, grpcPlugin as default } from "./plugin.js";
export * from "./port/index.js";
