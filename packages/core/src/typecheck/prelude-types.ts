import { DYNAMIC, list, NUMBER, STRING, type Type, variadic } from "./type.types.js";

/** One argument of a prelude verb, named so the editor can point at it. */
export interface PreludeArg {
  name: string;
  type: string;
  doc?: string;
  optional?: boolean;
}

/** What the editor needs to describe a prelude name: its type, and what it is for. */
export interface PreludeSpec {
  /** How it reads when written out. Shown as the hover's signature. */
  signature: string;
  doc: string;
  example?: string;
  type: Type;
  /**
   * The arguments, one by one. `signature` above is a whole line meant to be
   * read; these are meant to be pointed at, one at a time, as each is typed.
   */
  args?: readonly PreludeArg[];
}

/**
 * The prelude, described once: the checker reads the types, the editor reads
 * the prose. Two tables would drift; this one cannot.
 */
export const PRELUDE_SPECS: Readonly<Record<string, PreludeSpec>> = {
  spawn: {
    signature: "spawn(fn () -> T) -> task",
    doc: "Start work without waiting for it. Everything else waits by itself, so this is how to carry on — ask for the value later with `.wait`.",
    example: "let job = spawn(fn () => http.get(url))\nlet page = job.wait",
    type: variadic([DYNAMIC], DYNAMIC),
    args: [
      {
        name: "work",
        type: "fn () -> T",
        doc: "What to start. It runs on its own; ask for the answer later.",
      },
    ],
  },
  print: {
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
    type: variadic([DYNAMIC], { kind: "prim", name: "null" }),
  },
  log: {
    signature: "log(…) -> null",
    doc: "Record a message in the event stream — what a reporter and a test see, not stdout.",
    example: 'log "retrying" attempt',
    args: [
      {
        name: "values",
        type: "…",
        doc: "Anything, as many as you like. Goes to the event stream, not stdout.",
      },
    ],
    type: variadic([DYNAMIC], { kind: "prim", name: "null" }),
  },
  range: {
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
    type: variadic([NUMBER], list(NUMBER)),
  },
  str: {
    signature: "str(…) -> string",
    doc: "Every argument as text, spaced. Works on `null`, which has no methods of its own.",
    example: 'str("total:", 42, true)  # "total: 42 true"',
    args: [{ name: "values", type: "…", doc: "Anything, as many as you like." }],
    type: variadic([DYNAMIC], STRING),
  },
  typeOf: {
    signature: "typeOf(value) -> string",
    doc: "The name of a value's type: `list`, `map`, `string`, `number`, `bool`, `fn`, `null`.",
    example: 'typeOf([1, 2])  # "list"',
    args: [{ name: "value", type: "dynamic", doc: "Whatever you want the name of." }],
    type: variadic([DYNAMIC], STRING),
  },
  pretty: {
    signature: "pretty(value) -> string",
    doc: "Indented JSON — `fmt.json(x, 2)` without the import.",
    args: [{ name: "value", type: "dynamic", doc: "What to render." }],
    example: "print pretty(user)",
    type: variadic([DYNAMIC], STRING),
  },
  wait: {
    signature: "wait(duration) -> null",
    doc: "Pause for a duration.",
    args: [{ name: "duration", type: "duration", doc: "How long: `500ms`, `2s`, `1m`." }],
    example: "wait 500ms",
    type: variadic([DYNAMIC], { kind: "prim", name: "null" }),
  },
  skip: {
    signature: "skip(reason) -> null",
    doc: "Skip the rest of the current flow.",
    args: [
      {
        name: "reason",
        type: "string",
        doc: "Why — it is reported alongside the skip.",
        optional: true,
      },
    ],
    type: variadic([DYNAMIC], { kind: "prim", name: "null" }),
  },
  fail: {
    signature: "fail(message) -> never",
    doc: "Fail the current step with a message.",
    args: [{ name: "message", type: "string", doc: "What went wrong, in the reader's terms." }],
    type: variadic([DYNAMIC], { kind: "prim", name: "null" }),
  },
  exit: {
    signature: "exit(code) -> never",
    doc: "End the program with an exit code.",
    args: [
      {
        name: "code",
        type: "number",
        doc: "0 means success. Anything else does not.",
        optional: true,
      },
    ],
    example: "exit 1",
    type: variadic([NUMBER], { kind: "prim", name: "null" }),
  },
};

/** Whether a bare name is part of the prelude: no `use` needed, always in scope. */
export function isPrelude(name: string): boolean {
  return name in PRELUDE_SPECS;
}
