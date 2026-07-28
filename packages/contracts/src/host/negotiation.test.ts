import { describe, expect, it } from "vitest";
import { bindPort } from "../port/index.js";
import { createMemoryFs, FileSystemPort } from "../ports/index.js";
import { createHost } from "./index.js";

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return (err as { code?: string }).code;
  }
  return undefined;
}

describe("capability negotiation", () => {
  it("binds a valid implementation and returns it typed", () => {
    const fs = bindPort({ port: FileSystemPort, impl: createMemoryFs(), caps: ["fs"] });
    expect(typeof fs.read).toBe("function");
  });

  it("VN2010 when the host lacks a required capability", () => {
    const call = (): unknown =>
      bindPort({ port: FileSystemPort, impl: createMemoryFs(), caps: [] });
    expect(codeOf(call)).toBe("VN2010");
  });

  it("VN2011 when the implementation is missing a declared method", () => {
    const partial = { read: () => {}, write: () => {}, exists: () => {} };
    const call = (): unknown => bindPort({ port: FileSystemPort, impl: partial, caps: ["fs"] });
    expect(codeOf(call)).toBe("VN2011");
  });
});

describe("host assemblers", () => {
  it("worker omits process and its proc.spawn throws VN2012", () => {
    const host = createHost.worker();
    expect(host.caps).not.toContain("process");
    expect(codeOf(() => host.proc.spawn({ command: "x" }))).toBe("VN2012");
  });

  it("test exposes every capability and honors overrides", () => {
    expect(createHost.test().caps).toContain("process");
    expect(createHost.test({ caps: ["fs"] }).caps).toEqual(["fs"]);
  });
});
