import { basename } from "node:path";
import type { ProxiedVerb, ScaffoldKind } from "@venn/project";
import { defineCommand, runMain } from "citty";
import { buildCommand } from "./commands/build.js";
import { checkCommand } from "./commands/check.js";
import { depsCommand } from "./commands/deps.js";
import { fmtCommand } from "./commands/fmt.js";
import { listCommand } from "./commands/list.js";
import { newCommand } from "./commands/new.js";
import { runCommand } from "./commands/run.js";
import { scriptCommand } from "./commands/script.js";
import { verifyPluginCommand } from "./commands/verify-plugin.js";
import { targetsOrExit, worst } from "./project/index.js";

/**
 * Optional, because a command inside a project already knows what it means:
 * `venn test` is the suite, `venn run` is the program. A path given outright
 * always wins: it is an answer, not a hint.
 */
const TARGET = {
  type: "positional",
  required: false,
  description: "A .vn file or folder (default: what this project says)",
} as const;
const PACKAGE = { type: "string", alias: "p", description: "act on one workspace member" } as const;
const FLOW = { type: "string", description: "only flows whose title contains this" } as const;
const STEP = { type: "string", description: "only steps whose title contains this" } as const;

const run = defineCommand({
  meta: { name: "run", description: "Run a file as a program: its statements, top to bottom" },
  args: {
    target: TARGET,
    package: PACKAGE,
    bin: { type: "string", description: "which program, when the package has several" },
    env: { type: "string", description: "environment from venn.toml (default: local)" },
  },
  run: async ({ args }) => {
    const paths = await targetsOrExit({
      kind: "run",
      target: args.target,
      packageName: args.package,
      binName: args.bin,
    });
    const file = paths?.[0];
    if (!file) return;
    const ending = await scriptCommand({
      file,
      args: args._.slice(1),
      env: args.env,
    });
    // Leaving is the program's call, not the exit code's: a server that ran its
    // last line is still working, and one that said `exit 0` is not.
    if (ending.leave) process.exit(ending.code);
  },
});

const test = defineCommand({
  meta: { name: "test", description: "Run every flow in a file or folder as a test suite" },
  args: {
    target: TARGET,
    reporter: {
      type: "string",
      description:
        "pretty | ndjson | dot | junit (default: pretty on a terminal, ndjson when piped)",
    },
    flow: FLOW,
    step: STEP,
    package: PACKAGE,
    tags: { type: "string", description: "comma-separated @tags filter" },
    env: { type: "string", description: "environment from venn.toml (default: local)" },
    bail: { type: "boolean", description: "stop after the first failing flow" },
  },
  run: async ({ args }) => {
    const paths = await targetsOrExit({
      kind: "test",
      target: args.target,
      packageName: args.package,
    });
    if (!paths) return;
    const codes: number[] = [];
    for (const file of paths) {
      codes.push(
        await runCommand({
          file,
          reporter: args.reporter,
          flow: args.flow,
          step: args.step,
          tags: args.tags,
          env: args.env,
          bail: args.bail,
        }),
      );
    }
    process.exitCode = worst(codes);
  },
});

const list = defineCommand({
  meta: { name: "list", description: "List the flows and steps that would run" },
  args: { target: TARGET, flow: FLOW, step: STEP, package: PACKAGE },
  run: async ({ args }) => {
    const paths = await targetsOrExit({
      kind: "test",
      target: args.target,
      packageName: args.package,
    });
    if (!paths) return;
    const codes: number[] = [];
    for (const file of paths) {
      codes.push(await listCommand({ file, flow: args.flow, step: args.step }));
    }
    process.exitCode = worst(codes);
  },
});

const fmt = defineCommand({
  meta: { name: "fmt", description: "Format .vn files in place" },
  args: {
    target: TARGET,
    package: PACKAGE,
    check: { type: "boolean", description: "report what would change and fail, for CI" },
  },
  run: async ({ args }) => {
    const paths = await targetsOrExit({
      kind: "check",
      target: args.target,
      packageName: args.package,
    });
    if (paths) process.exitCode = await fmtCommand({ paths, check: args.check });
  },
});

const check = defineCommand({
  meta: { name: "check", description: "Statically check without running" },
  args: { target: TARGET, package: PACKAGE },
  run: async ({ args }) => {
    const paths = await targetsOrExit({
      kind: "check",
      target: args.target,
      packageName: args.package,
    });
    if (paths) process.exitCode = await checkCommand({ paths });
  },
});

const KIND = {
  lib: { type: "boolean", description: "a library: other packages use what it makes pub" },
  bin: { type: "boolean", description: "a program: a CLI, a server, anything with a main" },
  workspace: { type: "boolean", description: "a root that owns members, one lock and one target/" },
  "dry-run": { type: "boolean", description: "print what would be written and write nothing" },
} as const;

/** A program unless told otherwise: it is what most projects turn out to be. */
function kindOf(args: Record<string, unknown>): ScaffoldKind {
  if (args.workspace === true) return "workspace";
  if (args.lib === true) return "lib";
  return "bin";
}

const newCmd = defineCommand({
  meta: { name: "new", description: "Start a project in a new directory" },
  args: {
    name: { type: "positional", required: true, description: "Name, and the directory to make" },
    ...KIND,
  },
  run: async ({ args }) => {
    process.exitCode = await newCommand({
      dir: args.name,
      name: basename(args.name),
      kind: kindOf(args),
      dryRun: args["dry-run"],
    });
  },
});

const init = defineCommand({
  meta: { name: "init", description: "Start a project in the directory you are in" },
  args: {
    name: { type: "string", description: "Name (default: the directory's own)" },
    ...KIND,
  },
  run: async ({ args }) => {
    process.exitCode = await newCommand({
      dir: ".",
      name: args.name ?? basename(process.cwd()),
      kind: kindOf(args),
      dryRun: args["dry-run"],
    });
  },
});

const build = defineCommand({
  meta: { name: "build", description: "Check every target and record the build" },
  args: {
    package: PACKAGE,
    release: { type: "boolean", description: "the release profile: refuse to record a problem" },
  },
  run: async ({ args }) => {
    process.exitCode = await buildCommand({ release: args.release, packageName: args.package });
  },
});

const DEPS = {
  packages: { type: "positional", required: false, description: "names, e.g. zod hono@^4" },
  package: PACKAGE,
  dev: { type: "boolean", alias: "D", description: "a development dependency" },
} as const;

/** The four verbs a person wants, run by whichever manager `[tooling]` names. */
function depsRunner(verb: ProxiedVerb) {
  return async ({ args }: { args: Record<string, unknown> & { _: string[] } }) => {
    process.exitCode = await depsCommand({
      verb,
      // Already without the subcommand's own name: `venn add zod hono` gives
      // `["zod", "hono"]`, so slicing here would drop a package.
      packages: args._,
      dev: args.dev === true,
      frozen: args.frozen === true,
      packageName: args.package as string | undefined,
    });
  };
}

const add = defineCommand({
  meta: { name: "add", description: "Add a dependency and install it" },
  args: DEPS,
  run: depsRunner("add"),
});

const remove = defineCommand({
  meta: { name: "remove", description: "Remove a dependency and install without it" },
  args: DEPS,
  run: depsRunner("remove"),
});

const update = defineCommand({
  meta: { name: "update", description: "Update what is installed within the ranges asked for" },
  args: { package: PACKAGE },
  run: depsRunner("update"),
});

const install = defineCommand({
  meta: { name: "install", description: "Install what the manifest asks for" },
  args: {
    package: PACKAGE,
    frozen: { type: "boolean", description: "refuse anything the lock did not record" },
  },
  run: depsRunner("install"),
});

const verifyPlugin = defineCommand({
  meta: { name: "verify-plugin", description: "Inspect and verify a plugin module" },
  args: { path: { type: "positional", required: true, description: "Path to the plugin module" } },
  run: async ({ args }) => {
    process.exitCode = await verifyPluginCommand({ path: args.path });
  },
});

const main = defineCommand({
  meta: { name: "venn", description: "Venn CLI" },
  subCommands: {
    new: newCmd,
    init,
    add,
    remove,
    update,
    install,
    build,
    run,
    test,
    list,
    fmt,
    check,
    "verify-plugin": verifyPlugin,
  },
});

void runMain(main);
