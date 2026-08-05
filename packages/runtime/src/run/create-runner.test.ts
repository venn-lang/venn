import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, defineMatcher, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "./create-runner.js";

const echoPlugin = definePlugin({
  name: "@test/echo",
  namespace: "test",
  actions: [defineAction({ name: "echo", run: (_ctx, input) => ({ status: input.args[0] }) })],
  matchers: [
    defineMatcher({
      name: "oneOf",
      test: ({ subject, args }) => Array.isArray(args[0]) && args[0].includes(subject),
      message: ({ subject }) => `expected ${String(subject)} to be one of the options`,
    }),
  ],
});

const SOURCE = `flow "F" {
  step "S" {
    let res = test.echo 200
    expect res.status == 200
    expect res.status in [200, 204]
  }
}`;

describe("createRunner", () => {
  it("runs a flow, binds the action result, and streams ordered events", async () => {
    const { ast, problems } = parse(SOURCE);
    expect(problems).toEqual([]);
    const sink = createMemorySink();
    const runner = createRunner({ host: createTestHost(), plugins: [echoPlugin], sink });

    const result = await runner.run(ast);

    expect(result.failed).toBe(0);
    expect(result.passed).toBe(2);
    const kinds = sink.envelopes.map((envelope) => envelope.kind);
    expect(kinds[0]).toBe("run.started");
    expect(kinds.at(-1)).toBe("run.finished");
    expect(kinds).toContain("action.finished");
    expect(kinds).toContain("expect.passed");
    const seqs = sink.envelopes.map((envelope) => envelope.seq);
    expect(seqs).toEqual(seqs.map((_, index) => index + 1));
  });

  it("rejects a plugin whose capabilities the host lacks", () => {
    const netPlugin = definePlugin({
      name: "@test/net",
      namespace: "n",
      requires: ["net"],
    });
    const host = createTestHost({ caps: ["fs"] });
    let code: string | undefined;
    try {
      createRunner({ host, plugins: [netPlugin], sink: createMemorySink() });
    } catch (err) {
      code = (err as { code?: string }).code;
    }
    expect(code).toBe("VN2010");
  });

  /**
   * `EventSinkPort` was a descriptor nothing resolved, beside a sink threaded by
   * hand, so a host handing over the wrong object learned about it at the first
   * event of the first run, as `sink.emit is not a function`. Bound, it is the
   * same negotiation every other port gets, with a code and a sentence.
   */
  it("refuses a sink that cannot emit, and says which method is missing", async () => {
    const runner = createRunner({
      host: createTestHost(),
      plugins: [echoPlugin],
      sink: {} as never,
    });

    await expect(runner.run(parse(SOURCE).ast)).rejects.toMatchObject({
      code: "VN2011",
      detail: { portId: "venn.port.event-sink", missing: ["emit"] },
    });
  });
});
