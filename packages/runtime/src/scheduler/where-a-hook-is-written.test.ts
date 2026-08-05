// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn source under test, where ${…} is the language's own interpolation.
import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";

/** Prints what a hook saw, and fails when asked to. */
function recorder(sink: string[]) {
  return definePlugin({
    name: "@t/where",
    namespace: "io",
    actions: [
      defineAction({
        name: "print",
        run: (_ctx, input) => {
          sink.push(input.args.map(String).join(" "));
        },
      }),
      defineAction({
        name: "boom",
        run: () => {
          throw new Error("db is down");
        },
      }),
    ],
  });
}

async function suite(source: string) {
  const out: string[] = [];
  const { ast, problems } = parse(source);
  expect(problems).toEqual([]);
  const runner = createRunner({
    host: createTestHost(),
    plugins: [recorder(out)],
    sink: createMemorySink(),
  });
  return { out, result: await runner.run(ast) };
}

/**
 * Where a hook is written is what it means.
 *
 * The grammar takes `setup` and `teardown` in any block, and the guide shows
 * them inside a flow, so the pair had to mean something there: they ran nowhere
 * and said nothing, and a program that printed neither line read as a program
 * whose steps had not run.
 */
describe("setup and teardown written inside a flow", () => {
  it("runs the setup before the flow's steps and the teardown after them", async () => {
    const { out } = await suite(
      [
        'flow "doc example" {',
        '  setup { io.print "before" }',
        '  step "s" { io.print "the step" }',
        '  teardown { io.print "after" }',
        "}",
      ].join("\n"),
    );

    expect(out).toEqual(["before", "the step", "after"]);
  });

  it("runs the teardown after a flow that failed", async () => {
    const { out, result } = await suite(
      [
        'flow "F" {',
        '  setup { io.print "before" }',
        '  step "s" { io.boom }',
        '  teardown { io.print "after" }',
        "}",
      ].join("\n"),
    );

    expect(result.failed).toBe(1);
    expect(out).toEqual(["before", "after"]);
  });

  it("keeps the file's pair around the flow's own", async () => {
    const { out } = await suite(
      [
        'setup { io.print "file setup" }',
        'teardown { io.print "file teardown" }',
        'flow "F" {',
        '  setup { io.print "flow setup" }',
        '  step "s" { io.print "body" }',
        '  teardown { io.print "flow teardown" }',
        "}",
      ].join("\n"),
    );

    expect(out).toEqual(["file setup", "flow setup", "body", "flow teardown", "file teardown"]);
  });

  // The order a file already has, one level down: a teardown needs what the
  // defers are about to close.
  it("runs the teardown before what the flow deferred", async () => {
    const { out } = await suite(
      [
        'flow "F" {',
        '  defer { io.print "deferred" }',
        '  teardown { io.print "teardown" }',
        '  step "s" { io.print "body" }',
        "}",
      ].join("\n"),
    );

    expect(out).toEqual(["body", "teardown", "deferred"]);
  });
});

/** The same rule one and two levels further in, so no placement is silent. */
describe("setup and teardown written deeper than a flow", () => {
  it("runs a group's pair around that group's steps", async () => {
    const { out } = await suite(
      [
        'flow "F" {',
        '  group "G" {',
        '    setup { io.print "group setup" }',
        '    step "s" { io.print "body" }',
        '    teardown { io.print "group teardown" }',
        "  }",
        '  step "t" { io.print "after the group" }',
        "}",
      ].join("\n"),
    );

    expect(out).toEqual(["group setup", "body", "group teardown", "after the group"]);
  });

  it("runs a step's pair around that step's statements", async () => {
    const { out } = await suite(
      [
        'flow "F" {',
        '  step "s" {',
        '    setup { io.print "step setup" }',
        '    io.print "body"',
        '    teardown { io.print "step teardown" }',
        "  }",
        "}",
      ].join("\n"),
    );

    expect(out).toEqual(["step setup", "body", "step teardown"]);
  });

  // A concurrent block dispatches its own statements: a `setup` left among them
  // used to settle first and decide the race before a branch had run.
  it("runs a race's setup before the branches instead of as one", async () => {
    const { out } = await suite(
      [
        'flow "F" {',
        '  step "s" {',
        "    race {",
        '      setup { io.print "setup" }',
        '      io.print "branch"',
        "    }",
        "  }",
        "}",
      ].join("\n"),
    );

    expect(out).toEqual(["setup", "branch"]);
  });

  // What the block leaves behind is the block's too, however its branches went.
  it("runs what a parallel block deferred once its branches have settled", async () => {
    const source = 'flow "F" { parallel { defer { io.print "back" }; io.print "one" } }';

    expect((await suite(source)).out).toEqual(["one", "back"]);
  });
});

/**
 * `beforeEach` at the top of a file means each flow, so inside one it means each
 * step. A group holds steps of the flow it is written in, so they are wrapped
 * too, which is what makes the two readings the same rule.
 */
describe("beforeEach and afterEach written inside a flow", () => {
  it("runs around each step, including the ones a group holds", async () => {
    const { out } = await suite(
      [
        'flow "F" {',
        '  beforeEach { io.print "before" }',
        '  afterEach { io.print "after" }',
        '  step "a" { io.print "a" }',
        '  group "G" { step "b" { io.print "b" } }',
        "}",
      ].join("\n"),
    );

    expect(out).toEqual(["before", "a", "after", "before", "b", "after"]);
  });

  it("does not run around the steps of the step it is written in", async () => {
    const { out } = await suite(
      [
        'flow "F" {',
        '  beforeEach { io.print "before" }',
        '  step "a" { step "inner" { io.print "inner" } }',
        "}",
      ].join("\n"),
    );

    expect(out).toEqual(["before", "inner"]);
  });
});
