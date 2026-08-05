/**
 * A verb written inside a lambda, which is the method spelling of a loop.
 *
 * `rows.forEach(r => print r)` is the same idea as `forEach r in rows`, wearing
 * a lambda. What refuses it is the GRAMMAR, not purity: a lambda body is one
 * `Expr` and `print r` is a statement, so the parser leaves the call where it
 * stood and every token after it earns its own "expected the end of the file".
 * One wrong idea, three errors, none of them about the word that is wrong.
 *
 * Whether a lambda may reach the world at all is a different question with a
 * different owner, `check-pure-verb.ts` in the runtime, answered off the AST
 * after this pass has run. This one never asks it, which is why it stays silent
 * on `rows.forEach(r => io.print(r))`: that is an expression either way, so
 * there is nothing here to say about it, whatever purity decides.
 *
 * Read off the source and only on a line the parser already stopped at, so a
 * file that parses can never earn this.
 */

import { buildProblem, CODES } from "../codes/index.js";
import { shownColumn } from "../lang/index.js";
import type { Problem, Span } from "../problem/index.js";
import { KEYWORDS } from "./keywords.js";

/**
 * A method call, which is what makes an arrow after it a lambda rather than a
 * `match` arm or a `fn` body, both of which spell their own with `=>` too.
 */
const CALLED_AS_A_METHOD = /([A-Za-z_][\w.]*)\.([A-Za-z_]\w*)[ \t]*\(/;

/**
 * A lambda body that begins a statement: a name, a gap, and the start of a
 * second value, which is juxtaposition and only a verb call is written that
 * way. `x => x.len` has no gap and `x => x + 1` has an operator in it, so
 * neither is one; `x => x in ys` reaches here and is turned away below.
 */
const BODY_IS_A_STATEMENT = /=>[ \t]*\{?[ \t]*([A-Za-z_][\w.]*)[ \t]+([A-Za-z_"'\d[({$]\w*)/;

/** A lambda parameter is one name, or this cannot rewrite the call. */
const ONE_NAME = /^[A-Za-z_]\w*$/;

/**
 * What a verb has instead of a lambda, when the call cannot be rewritten as it
 * stands. Verified against the built CLI before it was written down.
 */
const A_VERB_NEEDS_A_STATEMENT =
  "A verb needs a statement of its own. `forEach r in rows { print r }` runs one over each item.";

/**
 * Every lambda in a source that was handed a verb, said properly.
 *
 * @param args The source, the uri to record on each span, and the lines the
 * parser reported an error on, which is what keeps a working file silent.
 * @returns One problem per such call, in reading order, empty when the file has
 * none. The span starts at the receiver, so it doubles as the offset past which
 * the parser's own errors are this one mistake's wake.
 */
export function verbInALambda(args: {
  text: string;
  uri: string;
  stopped: ReadonlySet<number>;
}): Problem[] {
  const found: Problem[] = [];
  let start = 0;
  for (const [index, text] of args.text.split("\n").entries()) {
    const line = { text, start, number: index + 1 };
    const problem = args.stopped.has(line.number) ? verbOn(line, args.uri) : undefined;
    if (problem) found.push(problem);
    start += text.length + 1;
  }
  return found;
}

/** One line of source, where it starts, and which line of the file it is. */
interface Line {
  readonly text: string;
  readonly start: number;
  readonly number: number;
}

/** What the line holds, once both halves of the mistake are on it. */
interface Handed {
  readonly called: RegExpExecArray;
  readonly body: RegExpExecArray;
  readonly verb: string;
}

/** The problem for one line, pointed at the spelling rather than at the verb. */
function verbOn(line: Line, uri: string): Problem | undefined {
  const handed = handedAVerb(line.text);
  if (!handed) return undefined;
  return buildProblem({
    spec: CODES.VN5010_VERB_IN_A_LAMBDA,
    span: spanOf(line, uri, handed.called),
    title: `A lambda body is one value, and \`${handed.verb}\` is a verb, so it cannot go in one.`,
    help: helpFor(line.text, handed),
  });
}

/**
 * Both halves on one line, with the arrow inside the call rather than before
 * it, and neither word a keyword: `x => try f() else 0` opens with one and
 * `x => x in ys` closes with one, and both of those are values.
 */
function handedAVerb(text: string): Handed | undefined {
  const called = CALLED_AS_A_METHOD.exec(text);
  const body = BODY_IS_A_STATEMENT.exec(text);
  if (!called || !body || body.index < called.index) return undefined;
  const verb = body[1] ?? "";
  if (KEYWORDS.has(verb) || KEYWORDS.has(body[2] ?? "")) return undefined;
  return { called, body, verb };
}

/** Where the method spelling sits: the receiver and the name after its dot. */
function spanOf(line: Line, uri: string, called: RegExpExecArray): Span {
  const receiver = called[1] ?? "";
  return {
    uri,
    offset: line.start + called.index,
    length: receiver.length + 1 + (called[2] ?? "").length,
    line: line.number,
    column: shownColumn({ text: line.text, line: line.number, column: called.index + 1 }),
  };
}

/**
 * The way out, rewritten from what is on the line when the line allows it.
 *
 * `forEach` is the one method with a statement form to point at, and the
 * rewrite is offered only when the call is the whole STATEMENT: nothing before
 * it and nothing after it. `let z = rows.forEach(r => print r)` binds the
 * result, and a statement gives nothing back, so telling that reader to write
 * `forEach r in rows { … }` would quietly delete the `let z =` they wrote. A
 * way out that drops half the line is the failure this whole pass exists to
 * stop, so that reader gets the sentence about verbs and keeps their binding.
 */
function helpFor(text: string, handed: Handed): string {
  const param = text.slice(text.indexOf("(", handed.called.index) + 1, handed.body.index).trim();
  const body = statementBody(text, handed);
  const alone = text.slice(0, handed.called.index).trim() === "";
  if (!alone || handed.called[2] !== "forEach" || !ONE_NAME.test(param) || !body) {
    return A_VERB_NEEDS_A_STATEMENT;
  }
  return `Write the statement instead: \`forEach ${param} in ${handed.called[1]} { ${body} }\`.`;
}

/**
 * The verb and its arguments, with the brackets the lambda spelling needed
 * taken back off. Nothing comes back when the call is not the end of the line,
 * or when the body carries a backtick that would close the one around it.
 */
function statementBody(text: string, handed: Handed): string | undefined {
  const from = text.indexOf(handed.verb, handed.body.index);
  const tail = text.slice(from).trimEnd();
  if (!tail.endsWith(")")) return undefined;
  const body = tail.slice(0, -1).trimEnd().replace(/}$/, "").trim();
  return body === "" || body.includes("`") ? undefined : body;
}
