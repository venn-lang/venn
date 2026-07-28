import { describe, expect, it } from "vitest";
import { parseToml } from "./parse-toml.js";

describe("what a venn.toml can say", () => {
  it("reads sections, nested sections and scalars", () => {
    const data = parseToml(
      `[package]\nname = "x"\nversion = 2\nquiet = true\n\n[env.local]\nA = "1"`,
    );

    expect(data.package).toEqual({ name: "x", version: 2, quiet: true });
    expect(data.env).toEqual({ local: { A: "1" } });
  });

  /** Two `[[bin]]` sections are two bins, not one bin written twice. */
  it("reads an array of tables", () => {
    const data = parseToml(`[[bin]]\nname = "a"\n\n[[bin]]\nname = "b"\npath = "t.vn"`);

    expect(data.bin).toEqual([{ name: "a" }, { name: "b", path: "t.vn" }]);
  });

  it("reads an inline table, nested ones included", () => {
    const data = parseToml(`[dependencies]\nzod = { version = "^4", optional = true }`);

    expect(data.dependencies).toEqual({ zod: { version: "^4", optional: true } });
  });

  /** Splitting on commas read this as two items; walking reads it as one. */
  it("keeps a comma inside a string", () => {
    expect(parseToml(`k = ["a,b", "c"]`).k).toEqual(["a,b", "c"]);
  });

  it("reads a literal string in single quotes", () => {
    expect(parseToml(`k = 'não "escapa" nada'`).k).toBe('não "escapa" nada');
  });

  it("keeps a # that is inside a string", () => {
    expect(parseToml(`k = "a#b" # comentário`).k).toBe("a#b");
    expect(parseToml(`k = 'a#b' # comentário`).k).toBe("a#b");
  });

  it("reads a quoted key", () => {
    expect(parseToml(`[paths]\n"#shared" = "./shared"`).paths).toEqual({ "#shared": "./shared" });
  });

  it("reads an empty array and an empty table", () => {
    const data = parseToml(`a = []\nb = {}`);

    expect(data.a).toEqual([]);
    expect(data.b).toEqual({});
  });
});

describe("a manifest that tries to reach the prototype", () => {
  /**
   * A manifest arrives with somebody else's project, so assigning `__proto__`
   * from one changed how every object in the process behaved: a dependency
   * could put a property on `Object.prototype` by being installed.
   */
  it("does not let a section name touch Object.prototype", () => {
    parseToml(`[package]\nname = "x"\n\n[package.__proto__]\nowned = "yes"`);

    expect(({} as Record<string, unknown>).owned).toBeUndefined();
  });

  it("does not let a key touch Object.prototype", () => {
    parseToml(`[package]\n__proto__ = "owned"`);

    expect(Object.prototype).not.toHaveProperty("owned");
  });

  it("still reads the rest of a manifest that tried", () => {
    const data = parseToml(`[package]\nname = "still here"\n__proto__ = "ignored"`);

    expect((data.package as Record<string, unknown>).name).toBe("still here");
  });
});
