import { describe, expect, it } from "vitest";
import { memberValue } from "./member-value.js";

/** A plugin's handle: a host object whose published verbs live on a prototype. */
class Servidor {
  readonly port = 3000;
  close(): string {
    return "fechado";
  }
}

/**
 * What the host stores a value as is not what the language says it answers to.
 *
 * A list is the language's own, with a member set it publishes and a checker
 * that knows it, so reading one must not fall through to the host. Nothing
 * there is in the language: no completion offers it, no hover explains it, the
 * checker has nothing to say, and it would stop working the day either value is
 * held differently.
 */
describe("what the host stores does not become a member", () => {
  it("does not hand out a list's host properties", () => {
    expect(memberValue([1, 2, 3], "length")).toBeUndefined();
    expect(memberValue([1, 2, 3], "splice")).toBeUndefined();
  });

  it("does not hand out a string's host methods", () => {
    expect(memberValue("abc", "toUpperCase")).toBeUndefined();
    expect(memberValue("abc", "length")).toBeUndefined();
  });

  it("does not hand out what every object inherits", () => {
    expect(memberValue({ id: 1 }, "toString")).toBeUndefined();
    expect(memberValue({ id: 1 }, "constructor")).toBeUndefined();
  });

  it("still answers with the language's own members", () => {
    expect(memberValue([1, 2, 3], "len")).toBe(3);
    expect(memberValue("abc", "upper")).toBe("ABC");
    expect(memberValue({ id: 1 }, "id")).toBe(1);
  });

  /** The opposite case: a handle *is* a host object, published verbs and all. */
  it("still reaches a handle's published verbs", () => {
    const handle = new Servidor();

    expect(memberValue(handle, "port")).toBe(3000);
    const close = memberValue(handle, "close") as { call: (args: unknown[]) => unknown };
    expect(typeof close).toBe("object");
  });
});
