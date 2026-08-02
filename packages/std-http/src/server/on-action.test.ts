import type { ActionContext } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { onAction } from "./on-action.js";

const ctx = {} as ActionContext;

/** What was raised, so the code it carries can be read rather than its shape. */
function thrown(...args: unknown[]): { code?: string; message?: string } {
  try {
    onAction().run(ctx, { args, params: {} });
  } catch (error) {
    return error as { code?: string; message?: string };
  }
  throw new Error("`http.on` raised nothing");
}

/**
 * `http.on` given something that is not a server, or nothing to answer with.
 *
 * Both are the program being wrong rather than the world failing, so both end
 * the run. They said so with no code, which left a caller unable to tell them
 * from a socket that would not bind.
 */
describe("http.on without what it needs", () => {
  it("refuses a first argument that is not a server", () => {
    expect(thrown("not a server", () => undefined)).toMatchObject({
      code: "VN7005",
      message: "`http.on` needs a server, as `http.serve` gives back.",
    });
  });

  it("refuses to register nothing", () => {
    expect(thrown({ kind: "http-server", onRequest: () => undefined })).toMatchObject({
      code: "VN7005",
      message: "`http.on` needs a function to answer with.",
    });
  });
});
