import type { ParamSpec } from "@venn-lang/sdk";
import type { ParameterInformation, SignatureInformation } from "vscode-languageserver";
import type { CallShape, ShownArg } from "./call-shape.types.js";

/**
 * A call written out the way it is actually written: `http.on server handler`,
 * no brackets, no commas. Each argument carries the character range it occupies
 * in that line, which is what lets the editor bold the one being typed instead
 * of guessing by substring.
 */
export function signatureOfShape(shape: CallShape): SignatureInformation {
  return render(shape, { open: " ", separator: " ", close: "" });
}

/**
 * The same call, written the way a bracketed one is: `saudacao(nome: a, idade: b)`.
 *
 * Two renderings because the language has two call syntaxes, and a hint that
 * shows the wrong one teaches the wrong thing.
 */
export function bracketed(shape: CallShape): SignatureInformation {
  return render(shape, { open: "(", separator: ", ", close: ")" });
}

interface Punctuation {
  open: string;
  separator: string;
  close: string;
}

/**
 * One renderer for both syntaxes: only the punctuation between the parts
 * differs, and the options are the last part in either. They are an argument
 * like any other, so they get a range and documentation of their own rather
 * than being printed as decoration nobody can point at.
 */
function render(shape: CallShape, punctuation: Punctuation): SignatureInformation {
  const texts = [...shape.args.map(label), ...optionsPart(shape)];
  const parameters: ParameterInformation[] = [];
  let at = shape.target.length + punctuation.open.length;
  texts.forEach((text, index) => {
    parameters.push({ label: [at, at + text.length], documentation: docFor(shape, index) });
    at += text.length + punctuation.separator.length;
  });
  const body = texts.join(punctuation.separator);
  return {
    label: `${shape.target}${texts.length ? punctuation.open : ""}${body}${texts.length ? punctuation.close : ""}`,
    parameters,
    documentation: summary(shape),
  };
}

/** The options, when the verb accepts any: one last argument, always a map. */
function optionsPart(shape: CallShape): string[] {
  return shape.options.length > 0 ? ["{ … }"] : [];
}

/** An argument's own line, or, for the last part, the keys the map accepts. */
function docFor(shape: CallShape, index: number): string | undefined {
  const arg = shape.args[index];
  if (arg) return arg.doc;
  return shape.options.map(optionLine).join("\n");
}

function optionLine(spec: ParamSpec): string {
  const required = spec.required ? " *(required)*" : "";
  const doc = spec.doc ? `, ${spec.doc}` : "";
  return `- \`${spec.name}\`: \`${spec.type}\`${required}${doc}`;
}

/**
 * `server: HttpServer`, or `reason?: string` when the call works without it.
 * An argument nobody named shows as its type alone, rather than as a stray colon.
 */
function label(arg: ShownArg): string {
  if (!arg.name) return arg.type;
  return `${arg.name}${mark(arg)}: ${arg.type}`;
}

function mark(arg: ShownArg): string {
  if (arg.rest) return "…";
  return arg.optional ? "?" : "";
}

/**
 * The line under the signature. It says what the verb does and what it gives
 * back: the two questions someone halfway through typing it is asking.
 */
function summary(shape: CallShape): string | undefined {
  const returns = shape.returns ? `Gives back ${shape.returns}.` : undefined;
  return [shape.doc, returns].filter(Boolean).join(" ") || undefined;
}
