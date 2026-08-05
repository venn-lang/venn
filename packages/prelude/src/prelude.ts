import { type TypeSpec, t } from "@venn-lang/types";
import type { PreludeEntry } from "./prelude.types.js";

/**
 * The named types the language brings with it.
 *
 * None is a primitive, and all are opaque because how each is held is none of a
 * program's business: what each publishes is the whole of what it offers.
 */
export const PRELUDE_TYPES: Readonly<Record<string, TypeSpec>> = {
  /**
   * What a `catch` binds.
   *
   * Drawn from the `Problem` every failure already is, and deliberately not all
   * of it. `where` is where it happened, written out; `data` is whatever the
   * `fail` that raised it attached, and nothing when a plugin or the kernel
   * raised it.
   *
   * The flow trace is not here. It holds spans of files the program may never
   * have opened, and handing those to a `catch` makes a failure a window into
   * the whole run rather than an account of one thing that went wrong.
   */
  error: t.opaque("error", {
    code: t.string,
    message: t.string,
    where: t.union(t.string, t.null),
    help: t.union(t.string, t.null),
    docs: t.union(t.string, t.null),
    data: t.dynamic,
  }),
  regex: t.opaque("regex", {
    source: t.string,
    flags: t.string,
    test: t.fn([t.string], t.bool),
    // The whole match first, then each group. Empty when it did not match, so
    // `.match(s).len == 0` is the question without a second shape to handle.
    match: t.fn([t.string], t.list(t.string)),
  }),
  /**
   * What `spawn` hands back.
   *
   * Opaque for the same reason a pattern is: the promise inside is deliberately
   * out of reach, since a promise handed to `let` would be waited for by the
   * statement, which is exactly what `spawn` exists to avoid. `.wait` is how a
   * reader asks for the value back.
   */
  task: t.opaque("task", {
    wait: t.dynamic,
    done: t.bool,
    failed: t.bool,
    settle: t.dynamic,
  }),
};

const NOTHING = t.null;

/**
 * Every name in scope before anything is imported.
 *
 * This is the whole of what Venn brings with it. A name that is not here has to
 * be imported, which is what keeps "where did this come from" answerable by
 * reading the top of the file.
 *
 * The kernel implements the values and the runtime carries out the verbs, and
 * both are checked against this list rather than keeping one of their own.
 */
export const PRELUDE: Readonly<Record<string, PreludeEntry>> = {
  regex: {
    kind: "value",
    signature: "regex(pattern: string, flags?: string) -> regex",
    doc: "Compile a pattern once, here, rather than on every comparison. Write the pattern as a raw string so every backslash survives, and read it back with `.test`, `.match`, `.source` and `.flags`.",
    example:
      'const order = regex(r"Order #(\\d+)")\nexpect (body ~= order)\nlet n = order.match(body)[1]',
    // Variadic because the flags are optional: `regex(r"…")` is the common
    // spelling and `regex(r"…", "g")` is the other one.
    type: t.variadic([t.string], PRELUDE_TYPES.regex as TypeSpec),
    args: [
      { name: "pattern", type: "string", doc: 'The pattern. `r"…"` keeps its backslashes.' },
      {
        name: "flags",
        type: "string",
        doc: "Regular expression flags. `(?i:…)` inside the pattern is the other way, and works per group.",
        optional: true,
      },
    ],
  },
  spawn: {
    kind: "value",
    signature: "spawn(fn () -> T) -> task",
    doc: "Start work without waiting for it. Everything else waits by itself, so this is how to carry on: ask for the value later with `.wait`.",
    example: "let job = spawn(fn () => http.get(url))\nlet page = job.wait",
    type: t.variadic([t.dynamic], PRELUDE_TYPES.task as TypeSpec),
    args: [
      {
        name: "work",
        type: "fn () -> T",
        doc: "What to start. It runs on its own; ask for the answer later.",
      },
    ],
  },
  print: {
    kind: "verb",
    signature: "print(…) -> null",
    doc: "Write to standard output, followed by a newline. A map or list shows as JSON.",
    args: [
      {
        name: "values",
        type: "…",
        doc: "Anything, as many as you like. Spaced apart on one line.",
      },
    ],
    example: 'print "hello" 42\nprint pretty(user)',
    type: t.variadic([t.dynamic], NOTHING),
  },
  log: {
    kind: "verb",
    signature: "log(…) -> null",
    doc: "Record a message in the event stream: what a reporter and a test see, rather than standard output.",
    example: 'log "retrying" attempt',
    args: [
      {
        name: "values",
        type: "…",
        doc: "Anything, as many as you like. Goes to the event stream, not stdout.",
      },
    ],
    type: t.variadic([t.dynamic], NOTHING),
  },
  range: {
    kind: "value",
    signature: "range(from?, to, step?) -> list<number>",
    doc: "A list of numbers, counting up or down. The end is exclusive.",
    example:
      "range(3)        # [0, 1, 2]\nrange(1, 4)     # [1, 2, 3]\nrange(0, 10, 2) # [0, 2, 4, 6, 8]",
    args: [
      {
        name: "from",
        type: "number",
        doc: "Where to start. Omit it and counting starts at 0.",
        optional: true,
      },
      { name: "to", type: "number", doc: "Where to stop, exclusive." },
      { name: "step", type: "number", doc: "How far apart. Negative counts down.", optional: true },
    ],
    type: t.variadic([t.number], t.list(t.number)),
  },
  str: {
    kind: "value",
    signature: "str(…) -> string",
    doc: "Every argument as text, spaced. Works on `null`, which has no methods of its own.",
    example: 'str("total:", 42, true)  # "total: 42 true"',
    args: [{ name: "values", type: "…", doc: "Anything, as many as you like." }],
    type: t.variadic([t.dynamic], t.string),
  },
  typeOf: {
    kind: "value",
    signature: "typeOf(value) -> string",
    doc: "The name of a value's type: `list`, `map`, `string`, `number`, `bool`, `fn`, `null`.",
    example: 'typeOf([1, 2])  # "list"',
    args: [{ name: "value", type: "dynamic", doc: "Whatever you want the name of." }],
    type: t.variadic([t.dynamic], t.string),
  },
  pretty: {
    kind: "value",
    signature: "pretty(value) -> string",
    doc: "Indented JSON, which is `fmt.json(x, 2)` without the import.",
    args: [{ name: "value", type: "dynamic", doc: "What to render." }],
    example: "print pretty(user)",
    type: t.variadic([t.dynamic], t.string),
  },
  wait: {
    kind: "verb",
    signature: "wait(duration) -> null",
    doc: "Pause for a duration.",
    args: [{ name: "duration", type: "duration", doc: "How long: `500ms`, `2s`, `1m`." }],
    example: "wait 500ms",
    type: t.variadic([t.dynamic], NOTHING),
  },
  skip: {
    kind: "verb",
    signature: "skip(reason) -> null",
    doc: "Skip the rest of the current flow.",
    args: [
      {
        name: "reason",
        type: "string",
        doc: "Why, which is reported alongside the skip.",
        optional: true,
      },
    ],
    type: t.variadic([t.dynamic], NOTHING),
  },
  fail: {
    kind: "verb",
    // `-> never` read well and named a type the language does not have: nothing
    // declared it, so an annotation naming it fell back to `dynamic` and
    // `const x: never = 1` checked clean. What both of these answer with is the
    // nothing they are typed as; that they do not come back is in the prose.
    signature: "fail(message) -> null",
    doc: "Fail the current step with a message. Nothing after it in the step runs.",
    args: [{ name: "message", type: "string", doc: "What went wrong, in the reader's terms." }],
    type: t.variadic([t.dynamic], NOTHING),
  },
  exit: {
    kind: "verb",
    signature: "exit(code) -> null",
    doc: "End the program with an exit code. Nothing after it runs, here or anywhere else.",
    args: [
      {
        name: "code",
        type: "number",
        doc: "0 means success. Anything else does not.",
        optional: true,
      },
    ],
    example: "exit 1",
    type: t.variadic([t.number], NOTHING),
  },
};

/** Whether a bare name is part of the prelude: no import needed, always in scope. */
export function isPrelude(name: string): boolean {
  return name in PRELUDE;
}

/** The names the runtime carries out as statements, rather than reads as values. */
export function preludeVerbs(): string[] {
  return names("verb");
}

/** The names that are values, so they may be written inside any expression. */
export function preludeValues(): string[] {
  return names("value");
}

function names(kind: PreludeEntry["kind"]): string[] {
  return Object.entries(PRELUDE)
    .filter(([, entry]) => entry.kind === kind)
    .map(([name]) => name);
}
