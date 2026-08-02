import { defineConfig } from "tsdown";

// What a version of the language is: the commands, and the server that speaks
// for them. Both are built here because the orchestrator installs one thing per
// version, and an editor asking for the server has to find it beside the
// commands.
//
// The only package that targets Node directly: it builds the node Host and
// reads files.
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
  // `venn run` spent about 90% of its startup inside `open`, Node resolving
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
    // threw on load, and it is 10 MB that every `venn run` would have paid
    // for to do something almost no command does.
    deps: { alwaysBundle: [/.*/] },
    external: ["tsc-api", "@venn-lang/dts"],
    dts: false,
  },
  // The launcher that turns on V8's compile cache before loading the engine.
  //
  // `venn-run` rather than `venn`: the name `venn` belongs to the orchestrator,
  // which is what a person installs and types. This is what it hands over to.
  {
    entry: { "bin/venn-run": "src/bin/venn.ts" },
    format: ["esm"],
    platform: "node",
    dts: false,
  },
  // Where a 0.1.x install lands when it upgrades. This package was the command
  // then, so upgrading it brings this, which says where the command went. It is
  // a sentence and an exit code, and it goes away once nobody is on 0.1.x.
  {
    entry: { "bin/venn": "src/bin/moved.ts" },
    format: ["esm"],
    platform: "node",
    dts: false,
  },
  // The language server, bundled whole. The tarball is unpacked on its own,
  // with no install step to fetch anything it might otherwise depend on.
  {
    entry: { "bin/venn-lsp": "src/bin/venn-lsp.ts" },
    format: ["esm"],
    platform: "node",
    deps: { alwaysBundle: [/.*/] },
    external: ["tsc-api", "@venn-lang/dts"],
    dts: false,
  },
]);
