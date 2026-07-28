/**
 * The node-only corner of `@venn-lang/http`. Everything reachable from here touches
 * `node:*`, which is why it sits behind its own subpath: the package's main
 * entry stays platform-neutral and loads in a Web Worker.
 */
export { createNodeServer, type NodeHttpServer } from "./server/node-server.js";
