import { fc, test } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";
import type { Paths, PathsArgs } from "./paths.types.js";

/** What one spelling hands the suite to be put through it. */
export interface PathsSpec {
  name: string;
  factory: (args?: PathsArgs) => Paths;
  /** An absolute path in this spelling, to hang the rooted laws off. */
  absolute: string;
  /** The root of that path, which is where climbing past the top stops. */
  root: string;
}

const NAME = fc.constantFrom("alpha", "beta", "gamma", "x.txt", "with space", "dot.tar.gz");
const NAMES = fc.array(NAME, { minLength: 1, maxLength: 5 });

/**
 * The {@link Paths} TCK: what is true of a path wherever it is written.
 *
 * Nothing here mentions a separator or a root, because those are the two things
 * the implementations are allowed to disagree about. What is asked is that both
 * agree about `..`, about where a name ends, and about the walk between two
 * places, and that what one writes the same one reads back.
 */
export function pathsConformance(spec: PathsSpec): void {
  describe(`Paths · ${spec.name}`, () => {
    joining(spec);
    climbing(spec);
    naming(spec);
    walking(spec);
  });
}

function joining(spec: PathsSpec): void {
  test.prop([NAMES])("puts exactly one separator between parts", (names) => {
    const paths = spec.factory();
    const joined = paths.join([spec.absolute, ...names]);

    expect(joined).not.toContain(paths.separator.repeat(2));
    expect(joined.endsWith(paths.separator)).toBe(false);
  });

  test.prop([NAMES])("reads back whole what it wrote", (names) => {
    const paths = spec.factory();
    const joined = paths.join([spec.absolute, ...names]);

    expect(paths.join([...paths.split(joined)])).toBe(joined);
  });

  it("skips a part that is nothing rather than doubling the separator", () => {
    const paths = spec.factory();

    expect(paths.join([spec.absolute, "", "a"])).toBe(paths.join([spec.absolute, "a"]));
  });

  /** A part that starts somewhere of its own is a different place, not a suffix. */
  it("starts over at a part that has a root of its own", () => {
    const paths = spec.factory();

    expect(paths.join(["anywhere", spec.absolute])).toBe(paths.normalize(spec.absolute));
  });
}

function climbing(spec: PathsSpec): void {
  test.prop([NAMES])("walks back up what it just went down", (names) => {
    const paths = spec.factory();
    const down = paths.join([spec.absolute, ...names]);
    const back = names.map(() => "..");

    expect(paths.join([down, ...back])).toBe(paths.normalize(spec.absolute));
  });

  it("drops `.`, which means where it already is", () => {
    const paths = spec.factory();

    expect(paths.join([spec.absolute, ".", "a"])).toBe(paths.join([spec.absolute, "a"]));
  });

  /** There is nothing above the root, so asking for it answers with the root. */
  it("stops climbing at the root of an absolute path", () => {
    const paths = spec.factory();

    expect(paths.join([spec.root, "..", "..", "a"])).toBe(paths.join([spec.root, "a"]));
  });

  /** A relative path can still climb: `..` from it means somewhere nameable. */
  it("keeps a climb out of a relative path, which has no root to stop at", () => {
    const paths = spec.factory();

    expect(paths.normalize(paths.join(["a", "..", ".."]))).toBe("..");
  });

  test.prop([NAMES])("tidies a path once and for all", (names) => {
    const paths = spec.factory();
    const messy = [spec.absolute, ...names, "..", "."].join(paths.separator);

    expect(paths.normalize(paths.normalize(messy))).toBe(paths.normalize(messy));
  });
}

function naming(spec: PathsSpec): void {
  test.prop([NAMES])("names a path by its last part, and its parent by the rest", (names) => {
    const paths = spec.factory();
    const joined = paths.join([spec.absolute, ...names]);

    expect(paths.basename(joined)).toBe(names[names.length - 1]);
    expect(paths.dirname(joined)).toBe(paths.join([spec.absolute, ...names.slice(0, -1)]));
  });

  it("takes the last extension, and finds none where there is none", () => {
    const paths = spec.factory();

    expect(paths.extension(paths.join([spec.absolute, "a.tar.gz"]))).toBe(".gz");
    expect(paths.extension(paths.join([spec.absolute, "plain"]))).toBe("");
  });

  /** The whole of `.gitignore` is the file's name; it is not an extension. */
  it("does not read a leading dot as an extension", () => {
    const paths = spec.factory();
    const dotfile = paths.join([spec.absolute, ".gitignore"]);

    expect(paths.extension(dotfile)).toBe("");
    expect(paths.basename(dotfile)).toBe(".gitignore");
  });

  it("says the root is its own parent, and that nothing is named by it", () => {
    const paths = spec.factory();

    expect(paths.dirname(spec.root)).toBe(paths.normalize(spec.root));
    expect(paths.basename(spec.root)).toBe("");
  });

  it("says a lone name has no parent to speak of", () => {
    expect(spec.factory().dirname("solo")).toBe(".");
  });
}

function walking(spec: PathsSpec): void {
  test.prop([NAMES, NAMES])("gets there by the walk it hands out", (there, elsewhere) => {
    const paths = spec.factory();
    const [from, to] = [
      paths.join([spec.absolute, ...there]),
      paths.join([spec.root, ...elsewhere]),
    ];

    expect(paths.resolve([from, paths.relative(from, to)])).toBe(to);
  });

  it("has no walk to somewhere it already is", () => {
    const paths = spec.factory();

    expect(paths.relative(spec.absolute, spec.absolute)).toBe("");
  });

  test.prop([NAMES])("resolves anything at all to somewhere absolute", (names) => {
    const paths = spec.factory({ cwd: spec.absolute });

    expect(paths.isAbsolute(paths.resolve(names))).toBe(true);
    expect(paths.isAbsolute(paths.cwd())).toBe(true);
  });

  it("leaves an absolute path where it is, whatever it is asked to start from", () => {
    const paths = spec.factory({ cwd: spec.root });

    expect(paths.resolve([spec.absolute])).toBe(paths.normalize(spec.absolute));
  });

  /** Relative is relative: the same name means one place here and another there. */
  it("resolves a relative path from where it was told to start", () => {
    const here = spec.factory({ cwd: spec.absolute });
    const top = spec.factory({ cwd: spec.root });

    expect(here.resolve(["a"])).not.toBe(top.resolve(["a"]));
  });
}
