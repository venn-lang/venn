import { Readable } from "node:stream";
import { consoleConformance } from "./console.suite.js";
import { createMemoryConsole } from "./memory-console.js";
import { createNodeConsole } from "./node-console.js";

consoleConformance({ name: "memory", factory: (input) => createMemoryConsole({ input }) });

/**
 * The same suite against the real node console, with its streams injected: a
 * readable standing in for stdin, and a writer that records what it wrote. The
 * implementation under test is the one a script actually runs on.
 */
consoleConformance({
  name: "node",
  factory: (input) => {
    const captured = { text: "" };
    const stdout = {
      write: (text: string) => {
        captured.text += text;
      },
    };
    const stdin = Readable.from(input ? input.map((line) => `${line}\n`) : []);
    const console = createNodeConsole({ stdout, stderr: stdout, stdin });
    // A getter, not `Object.assign`: assigning would snapshot the empty string.
    return Object.defineProperty(console, "out", { get: () => captured.text });
  },
});
