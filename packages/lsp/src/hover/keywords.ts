import { fence, rule, sections } from "../markdown/index.js";

interface KeywordDoc {
  summary: string;
  example?: string;
}

// What every word of the kernel does. The grammar is fixed and small, so this
// table is the whole language: a newcomer can learn it by hovering.
const KEYWORDS: Record<string, KeywordDoc> = {
  module: {
    summary: "Name this file. Purely documentation; imports resolve by path, not by module name.",
    example: "module checkout.payment",
  },
  use: {
    summary: "Load a plugin package, making its namespace available as verbs.",
    example: 'use "venn/http"\nuse "venn/browser" as b',
  },
  import: {
    summary: "Bring `pub` fragments and functions from another `.vn` file into this one.",
    example: 'import { login } from "./shared/auth.vn"',
  },
  from: {
    summary: "The module an `import` reads from: a relative path or a `#alias` from `venn.toml`.",
  },
  as: {
    summary: "Rename what you just bound — a `use` namespace, a `repeat` index or a `run` result.",
  },
  pub: {
    summary: "Export this declaration so other files may `import` it.",
    example: "pub fragment login(user) { … }",
  },
  flow: {
    summary: "A test: the top-level unit the runner schedules and reports.",
    example:
      'flow "Checkout" {\n  step "Pay" {\n    const paid = http.post "/pay"\n    expect paid.status == 200\n  }\n}',
  },
  step: {
    summary: "One named unit of work inside a flow. Bindings made inside it are step-local.",
    example: 'step "Ping" {\n  const health = http.get "/health"\n  expect health.status == 200\n}',
  },
  group: {
    summary: "Label a set of steps. Structure only — it changes no scope.",
    example: 'group "payment" {\n  step "Charge" { … }\n}',
  },
  fragment: {
    summary: "A reusable block of steps, invoked with `run`. Composition without inheritance.",
    example: 'fragment login(user) {\n  step "login" { … }\n}',
  },
  fn: {
    summary:
      "A pure function returning a value — first-class, callable anywhere. `=> expr` for one line; a `{ … }` block returns its last expression. No steps, no I/O.",
    example: "fn double(x) => x * 2\nconst add = fn (a, b) => a + b",
  },
  deco: {
    summary:
      "Declare a decorator. The first parameter is the target, and the type written on it is what `@name` may sit on — `Fn`, `Flow`, `Step`, `Binding`, `Type`, `Resource`, or `Node` for anything. The parameters after it are the decorator's own arguments. The body runs before the program exists, so it is pure: no plugin verbs.",
    example:
      'deco memoize(target: Fn) {\n  const cache = {}\n  target.wrap(fn (call, args) => cache.get(str(args)) ?? call(args))\n}\n\npub deco retry(target: Flow, times: number) {\n  target.meta "retry" times\n}',
  },
  run: {
    summary: "Invoke a fragment, optionally binding what it returns.",
    example: 'run login("alice") as session',
  },
  expect: {
    summary:
      "Assert. Takes a boolean, or a subject plus a matcher. `.all { … }` groups checks; `.soft` records without aborting.",
    example: 'expect health.status == 200\nexpect user.plan oneOf ["free", "pro"]',
  },
  not: { summary: "Negate the expectation that follows.", example: "expect not orders empty" },
  all: { summary: "Group several checks under one `expect`, each on its own line." },
  soft: { summary: "Record a failed expectation without aborting the step." },
  let: { summary: "Bind a value for the rest of the block.", example: 'let plan = "pro"' },
  const: { summary: "Bind a value that cannot be reassigned.", example: "const retries = 3" },
  capture: {
    summary:
      "Removed. It did exactly what `let` does — use `let` for a value that changes, `const` for one that does not.",
    example: "const orderId = order.json.id",
  },
  env: {
    summary:
      "Configuration for this run, read from the `[env.*]` tables of `venn.toml`. `--env <name>` picks which table; `env.name` is the one that was picked.",
    example:
      'import { env } from "venn/env"\n\nconst token = http.post "${env.BASE_URL}/token" {\n  body: { user: env.USERNAME, pass: env.PASSWORD },\n  encode: "form"\n}',
  },
  resource: {
    summary:
      "Open something with a lifecycle, closed automatically. `@scope` sets how long it lives.",
    example: "@scope(flow)\nresource page = browser.newContext",
  },
  config: {
    summary: "Project settings visible to plugins, such as `baseUrl`.",
    example: "config { baseUrl: env.BASE_URL }",
  },
  matrix: {
    summary: "Run every flow once per combination of these values.",
    example: 'matrix { browser: ["chromium", "webkit"] }',
  },
  dataset: { summary: "A named collection of test data." },
  factory: { summary: "A named builder for objects, usually backed by `@venn-lang/data`." },
  type: {
    summary: "A named shape, used to type parameters and datasets.",
    example: "type User { email: string }",
  },
  report: { summary: "Where results go.", example: 'report junit("./out")' },
  if: {
    summary: "Branch on a condition.",
    example: 'if health.status == 200 {\n  step "ok" { … }\n} else {\n  step "retry" { … }\n}',
  },
  else: { summary: "The branch taken when the `if` condition is false." },
  match: {
    summary:
      "Decide between the shapes a value can have, covering every one of them. `=>` gives a value back, `{ … }` runs steps.",
    example:
      'match msg {\n  { kind: "ping", at } => "ping at ${at}"\n  { kind: "text", body } => body\n  _ => "something else"\n}',
  },
  forEach: {
    summary: "Repeat the body once per item. The optional map sets `concurrency`.",
    example: 'forEach user in users { concurrency: 4 } {\n  step "check" { … }\n}',
  },
  in: {
    summary: "Separates the loop variable from its list, and tests membership in an expression.",
  },
  repeat: {
    summary: "Run the body a fixed number of times, optionally binding the 1-based index.",
    example: 'repeat 3 as attempt {\n  step "poll" { … }\n}',
  },
  loop: {
    summary: "Repeat until `break`, or while a condition holds, carrying a value if it needs one.",
    example:
      "loop { … }\n\nloop queue.len > 0 { … }\n\nloop total = 0 {\n  if total >= 6 { break }\n  continue total + 2\n}",
  },
  parallel: {
    summary: "Run the statements concurrently and wait for all of them.",
    example: 'parallel { concurrency: 4 } {\n  step "a" { … }\n  step "b" { … }\n}',
  },
  race: {
    summary: "Run concurrently; the first to finish wins and the others are cancelled.",
    example: 'race { timeout: 10s } {\n  step "ws" { … }\n  step "poll" { … }\n}',
  },
  try: { summary: "Attempt the body, handling failure in `catch` and cleanup in `finally`." },
  catch: { summary: "Handle a failure from `try`, optionally binding the error." },
  finally: { summary: "Always runs after `try`, whether it failed or not." },
  defer: {
    summary: "Schedule cleanup that runs on the way out of the block, even on failure.",
    example: 'defer { db.exec "ROLLBACK" }',
  },
  setup: { summary: "Runs once before every flow in the file." },
  teardown: { summary: "Runs once after every flow in the file." },
  beforeEach: { summary: "Runs before each flow." },
  afterEach: { summary: "Runs after each flow." },
  on: {
    summary: "React to a lifecycle event.",
    example: "on failure {\n  artifacts.save trace\n}",
  },
  return: {
    summary:
      "Return a value early. A `fn` already returns its last expression, so `return` is only needed to leave sooner; it also stops a fragment.",
  },
  break: { summary: "Leave the innermost loop." },
  continue: {
    summary:
      "Start the next pass of the innermost loop. In a `loop` carrying a value, `continue next` is what the next pass begins with; on its own it repeats with the value this pass had.",
    example: "loop total = 0 {\n  if total >= 6 { break }\n  continue total + 2\n}",
  },
  true: { summary: "The boolean true." },
  false: { summary: "The boolean false." },
  null: { summary: "The absence of a value." },
};

/** Hover for a keyword of the kernel: what it does, and how it reads. */
export function keywordHover(word: string): string | undefined {
  const doc = KEYWORDS[word];
  if (!doc) return undefined;
  const example = doc.example ? sections(["**Example**", fence(doc.example)]) : undefined;
  return rule([fence(word), sections([doc.summary, example])]);
}

/** Whether the kernel documents this word at all. */
export function isKeyword(word: string): boolean {
  return word in KEYWORDS;
}
