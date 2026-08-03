import { describe, expect, it } from "vitest";
import { everySource, packageEntries, relative, resolveFrom, specifiers } from "./repo-sources.mjs";

/** Every file the entry can reach by a relative import, the entry included. */
function reachableFrom(entry, source) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const at = queue.pop();
    if (seen.has(at) || !source.has(at)) continue;
    seen.add(at);
    for (const specifier of specifiers(source.get(at))) {
      if (!specifier.startsWith(".")) continue;
      const next = resolveFrom({ from: at, specifier, source });
      if (next) queue.push(next);
    }
  }
  return seen;
}

/**
 * Node's own modules, by either spelling.
 *
 * `from "fs"` is the same import as `from "node:fs"` to Node and to tsdown, so a
 * guard that only knew the prefixed one could be walked past by dropping four
 * characters. `@venn-lang/contracts/node` is the one subpath the charter says
 * carries `node:*`, so reaching it from a neutral entry is the same leak one
 * package further along.
 */
const BARE = new Set([
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
]);

const isNode = (one) =>
  one.startsWith("node:") || BARE.has(one.split("/")[0]) || one === "@venn-lang/contracts/node";

const leaks = (text) => specifiers(text).filter(isNode);

/**
 * No `node:` anywhere a Web Worker can reach, which is the boundary the whole
 * architecture stands on, and which nothing was holding.
 *
 * `platform: "neutral"` does not hold it. tsdown answers a `node:fs` import in a
 * neutral build with an UNRESOLVED_IMPORT warning, prints "Build complete",
 * exits 0, and emits the import into the bundle. Four tsdown configs say a leak
 * "fails the build" and the charter says the same, and both are wrong. The
 * typecheck does not hold it either for the two packages where the boundary
 * actually is: `contracts` and `std-http` set `"types": ["node"]` over the whole
 * of `src`, because their `/node` subpath needs it.
 *
 * Read over the source graph rather than the bundle, so it needs no build and
 * names the file that imports rather than the entry that ends up carrying it.
 */
describe("a package built for no platform in particular", () => {
  it("reaches no node: import from any of its entries", { timeout: 30_000 }, async () => {
    const source = await everySource();
    const neutral = (await packageEntries()).filter((one) => one.platform === "neutral");
    const found = [];
    for (const { entry } of neutral) {
      const reached = reachableFrom(entry, source);
      if (reached.size === 0)
        throw new Error(`${relative(entry)} is a neutral entry nobody could read`);
      for (const path of reached) {
        for (const one of leaks(source.get(path)))
          found.push(`${one} in ${relative(path)}, reached from ${relative(entry)}`);
      }
    }

    expect([...new Set(found)]).toEqual([]);
  });

  /**
   * A resolver that resolved nothing would be green on a repository full of
   * leaks, and would say so in the same words.
   */
  it("is read through a graph that really resolves", async () => {
    const source = await everySource();
    const contracts = (await packageEntries()).find((one) =>
      one.entry.endsWith("contracts/src/index.ts"),
    );
    const reached = reachableFrom(contracts.entry, source);

    expect(reached.size).toBeGreaterThan(20);
    expect([...reached].some((path) => path.endsWith("memory-fs.ts"))).toBe(true);
  });
});
