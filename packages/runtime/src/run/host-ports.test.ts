import {
  ClockPort,
  createPosixPaths,
  createTestHost,
  createVirtualClock,
  FileSystemPort,
  PathsPort,
  RandomPort,
} from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "./create-runner.js";
import type { RunnerArgs } from "./runner.types.js";

/** A plugin that reaches for the host's capabilities and nothing else. */
const REACH = definePlugin({
  name: "@t/reach",
  namespace: "reach",
  actions: [
    defineAction({ name: "now", run: (ctx) => ctx.port(ClockPort).now() }),
    defineAction({ name: "next", run: (ctx) => ctx.port(RandomPort).next() }),
    defineAction({ name: "here", run: (ctx) => ctx.port(PathsPort).cwd() }),
    defineAction({
      name: "join",
      run: (ctx, input) => ctx.port(PathsPort).join(input.args.map(String)),
    }),
    defineAction({ name: "kept", run: (ctx) => typeof ctx.port(FileSystemPort).read }),
  ],
});

async function ran(source: string, over: Partial<RunnerArgs> = {}): Promise<string[]> {
  const out: string[] = [];
  const printer = definePlugin({
    name: "@t/io",
    namespace: "io",
    actions: [
      defineAction({
        name: "print",
        run: (_ctx, input) => void out.push(input.args.map(String).join(" ")),
      }),
    ],
  });
  const runner = createRunner({
    host: createTestHost(),
    plugins: [REACH, printer],
    sink: createMemorySink(),
    ...over,
  });
  await runner.script(parse(source).ast);
  return out;
}

/**
 * A plugin asks the host for a clock rather than reading the machine's, and the
 * only reason it can is that the runner binds the host's own capabilities as
 * ports. Without that a plugin reaches for the global one and every test that
 * depends on time stops being repeatable.
 */
describe("the host's capabilities, as ports", () => {
  it("hands a plugin the run's clock, not the machine's", async () => {
    const clock = createVirtualClock();
    clock.setTime(1_000);

    const source = 'import { reach } from "@t/reach"\nio.print(reach.now())';

    expect(await ran(source, { host: createTestHost({ clock }) })).toEqual(["1000"]);
  });

  it("hands it the run's random, so a seeded host repeats itself", async () => {
    const source = 'import { reach } from "@t/reach"\nio.print(reach.next())';

    expect(await ran(source)).toEqual(await ran(source));
  });

  it("hands it the file system the host was built with", async () => {
    const source = 'import { reach } from "@t/reach"\nio.print(reach.kept())';

    expect(await ran(source)).toEqual(["function"]);
  });

  it("hands it the spelling this host writes paths in", async () => {
    const source = 'import { reach } from "@t/reach"\nio.print(reach.join("a", "b"))';

    expect(await ran(source)).toEqual(["a/b"]);
  });

  /** The host decides, so a host that starts somewhere else answers differently. */
  it("hands it the directory that host starts from", async () => {
    const host = createTestHost({ paths: createPosixPaths({ cwd: "/srv/app" }) });
    const source = 'import { reach } from "@t/reach"\nio.print(reach.here())';

    expect(await ran(source, { host })).toEqual(["/srv/app"]);
  });

  /** A caller who binds a port by hand meant it, and is not argued with. */
  it("gives way to a port the caller bound itself", async () => {
    const ports = [{ port: PathsPort, impl: createPosixPaths({ cwd: "/elsewhere" }) }];
    const source = 'import { reach } from "@t/reach"\nio.print(reach.here())';

    expect(await ran(source, { ports })).toEqual(["/elsewhere"]);
  });
});
