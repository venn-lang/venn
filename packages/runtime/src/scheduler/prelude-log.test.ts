// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn source under test.
import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

async function logsOf(body: string): Promise<string[]> {
  const sink = createMemorySink();
  const { ast } = parse(`flow "F" { step "s" {\n${body}\nexpect true\n} }`);
  await createRunner({ host: createTestHost(), plugins: [], sink }).run(ast);
  return messages(sink);
}

function messages(sink: MemorySink): string[] {
  return sink.envelopes
    .filter((event) => event.kind === "log")
    .map((event) => String((event.data as { message?: unknown }).message ?? ""));
}

describe("log", () => {
  it("prints a plain string as itself", async () => {
    expect(await logsOf('log "hello"')).toEqual(["hello"]);
  });

  /**
   * This asked for JSON when JSON was the only thing that was not the host's
   * own words. What it was always about is that a reader sees what the value
   * holds, and a map written the way the program would write it says that
   * better than JSON does, in the shape `"${o}"` gives for the same value.
   */
  it("shows a map the way the language writes one", async () => {
    const logs = await logsOf('const o = { alg: "RS256", n: 42 }\nlog o');

    expect(logs).toEqual(['{ alg: "RS256", n: 42 }']);
  });

  it("joins several arguments with a space, like console.log", async () => {
    expect(await logsOf('log "count is" 42 true')).toEqual(["count is 42 true"]);
  });

  it("interpolates, since the argument is an ordinary expression", async () => {
    expect(await logsOf('const who = "world"\nlog "hi ${who}"')).toEqual(["hi world"]);
  });
});
