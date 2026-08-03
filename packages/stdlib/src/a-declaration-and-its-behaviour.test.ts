import type { ActionDefinition, MatcherDefinition, PluginDefinition } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { allPlugins } from "./plugins.js";

const namespaced = (plugin: PluginDefinition): string => plugin.namespace;

function verb(namespace: string, name: string): ActionDefinition {
  const plugin = allPlugins.find((one) => namespaced(one) === namespace);
  const found = plugin?.actions?.find((one) => one.name === name);
  if (!found) throw new Error(`no ${namespace}.${name}`);
  return found;
}

function matcher(name: string): MatcherDefinition {
  const found = allPlugins.flatMap((one) => one.matchers ?? []).find((one) => one.name === name);
  if (!found) throw new Error(`no matcher ${name}`);
  return found;
}

const named = (action: ActionDefinition): string[] =>
  (action.args ?? []).map((one) => one.name ?? "");

/**
 * `auth.hmac` read its arguments secret-first and declared them payload-first,
 * so hover, completion and the README told every caller to key the signature
 * with the payload. An HMAC keyed by the payload never verifies.
 */
describe("the order a verb declares its arguments in", () => {
  it("is the order its run reads them", () => {
    expect(named(verb("auth", "hmac"))).toEqual(["secret", "payload"]);
    expect(named(verb("browser", "press"))).toEqual(["selector", "key"]);
  });
});

describe("what a verb declares about each argument", () => {
  it("says variadic when the body takes every one it is given", () => {
    expect(verb("io", "write").args?.[0]?.rest).toBe(true);
    expect(verb("io", "eprint").args?.[0]?.rest).toBe(true);
  });

  it("says optional when the body has a default for it", () => {
    expect(verb("io", "isTerminal").args?.[0]?.optional).toBe(true);
    expect(verb("browser", "press").args?.[0]?.optional).toBe(true);
  });
});

/** A verb that reads an option has to declare it, or its two spellings differ. */
describe("the options a verb declares", () => {
  it("are the ones its run reads, and no others", () => {
    expect(verb("db", "seed").params).toBeDefined();
    expect(verb("mock", "clock.advance").params).toBeUndefined();
  });
});

const RESPONSE = { headers: { "Content-Type": "application/json" } };

const asked = (...args: readonly unknown[]): boolean =>
  matcher("header").test({ subject: RESPONSE, args, params: {} }) as boolean;

/**
 * `header` declared a value to compare, documented it, and never read it, so an
 * assertion against a header that says something else passed green.
 */
describe("the header matcher", () => {
  it("compares the value when one is written", () => {
    expect(asked("content-type", "text/plain")).toBe(false);
    expect(asked("content-type", "application/json")).toBe(true);
  });

  it("still passes on presence alone, and reads the name in any case", () => {
    expect(asked("CONTENT-TYPE")).toBe(true);
    expect(asked("x-nope")).toBe(false);
  });
});

/** The charter's error model: a diff is structured, never a rendered string. */
describe("a header that failed", () => {
  it("hands both sides to the failure", () => {
    const args = { subject: RESPONSE, args: ["content-type", "text/plain"], params: {} };

    expect(matcher("header").detail?.(args, { log: () => {}, show: String })).toEqual({
      expected: "text/plain",
      actual: "application/json",
    });
  });
});
