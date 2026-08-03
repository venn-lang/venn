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
    // Everything, the TypeScript compiler included. The tarball is unpacked on
    // its own with no install step, so a package left outside it is a package
    // the shipped binary cannot load: `venn add` died on `@venn-lang/dts` with
    // a Node stack trace for every user who installed the documented way.
    //
    // The compiler is ten megabytes that almost no command needs, so it is not
    // in the engine: `deriveTypes` reaches it through `await import`, which
    // rolldown keeps as a chunk of its own beside the engine. `venn run` opens
    // one file, and the one command that derives types opens two.
    deps: { alwaysBundle: [/.*/] },
    // The compiler is CommonJS and reads `__filename`, `__dirname` and
    // `require` to find its own lib files. In an ES module those are not
    // defined at all, so without the shims the chunk throws on load.
    shims: true,
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
