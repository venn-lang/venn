import { defineConfig } from "tsdown";

// The only package that targets Node directly: it builds the node Host and reads
// files. `bin/venn.ts` becomes the `venn` executable.
export default defineConfig([
  // The library entry stays external, so anything embedding the CLI shares one
  // copy of the language with whatever else it loads.
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    platform: "node",
    dts: true,
  },
  // The engine: one file, so Node opens one file.
  //
  // `venn run` spent about 90% of its startup inside `open` — Node resolving
  // 25 plugin packages plus Langium and Chevrotain, reading a package.json and
  // opening a file for each module on the way. Nothing embeds the binary, so
  // there is no copy worth sharing.
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    platform: "node",
    // Everything except the TypeScript compiler, which is only reached when a
    // package's types are being derived. It is CommonJS built for a world with
    // `__filename` in it, so bundling it into an ES module produced a file that
    // threw on load — and it is 10 MB that every `venn run` would have paid
    // for to do something almost no command does.
    deps: { alwaysBundle: [/.*/] },
    external: ["tsc-api", "@venn/dts"],
    dts: false,
  },
  // The launcher that turns on V8's compile cache before loading the engine.
  {
    entry: { "bin/venn": "src/bin/venn.ts" },
    format: ["esm"],
    platform: "node",
    dts: false,
  },
]);
