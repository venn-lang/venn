import { type ActionDefinition, arg, defineAction, optionalArg } from "@venn-lang/sdk";
import { type TypeSpec, t } from "@venn-lang/types";
import { ConsolePort } from "../port/index.js";

/** How big the terminal is, or nothing at all where there is not one. */
export const SIZE_TYPE: TypeSpec = t.record({ columns: t.number, rows: t.number });

const number = (value: unknown): number => Math.trunc(Number(value ?? 0)) || 0;

/**
 * The terminal itself: how big it is, whether there is one, and what to do to
 * the screen rather than write on it.
 *
 * A program that draws asks before it draws. Where there is no terminal, size
 * answers with nothing and every screen operation is quietly ignored, so the
 * same program run through a pipe writes its lines and nothing else.
 */
export const screenActions: ActionDefinition[] = [
  defineAction({
    name: "size",
    doc: "The terminal's size in characters, or null when the output is not one.",
    result: t.union(SIZE_TYPE, t.null),
    run: (ctx) => ctx.port(ConsolePort).size() ?? null,
  }),
  defineAction({
    name: "isTerminal",
    doc: 'Whether a stream is a terminal: "in", "out" or "err". Decides colour and questions.',
    args: [optionalArg("stream", t.string, 'Which one: "in", "out" or "err". Defaults to "out".')],
    result: t.bool,
    run: (ctx, input) => ctx.port(ConsolePort).isTerminal(streamOf(input.args[0])),
  }),
  defineAction({
    name: "cursor.to",
    doc: "Put the cursor at a column and row, both counting from 1.",
    args: [
      arg("column", t.number, "From the left, starting at 1."),
      arg("row", t.number, "From the top, starting at 1."),
    ],
    result: t.void,
    run: (ctx, input) =>
      ctx
        .port(ConsolePort)
        .screen({ kind: "to", column: number(input.args[0]), row: number(input.args[1]) }),
  }),
  defineAction({
    name: "cursor.move",
    doc: "Move the cursor from where it is. Negative goes left and up.",
    args: [
      arg("columns", t.number, "Right when positive."),
      arg("rows", t.number, "Down when positive."),
    ],
    result: t.void,
    run: (ctx, input) =>
      ctx
        .port(ConsolePort)
        .screen({ kind: "move", columns: number(input.args[0]), rows: number(input.args[1]) }),
  }),
  defineAction({
    name: "cursor.hide",
    doc: "Hide the cursor, which is what a screen being redrawn wants.",
    result: t.void,
    run: (ctx) => ctx.port(ConsolePort).screen({ kind: "hide" }),
  }),
  defineAction({
    name: "cursor.show",
    doc: "Show it again. A program that hides it has to put it back.",
    result: t.void,
    run: (ctx) => ctx.port(ConsolePort).screen({ kind: "show" }),
  }),
  defineAction({
    name: "clearLine",
    doc: "Clear the line the cursor is on, and put the cursor at its start.",
    result: t.void,
    run: (ctx) => ctx.port(ConsolePort).screen({ kind: "clearLine" }),
  }),
  defineAction({
    name: "clear",
    doc: "Clear the screen and put the cursor at the top left.",
    result: t.void,
    run: (ctx) => ctx.port(ConsolePort).screen({ kind: "clearScreen" }),
  }),
];

/** Which stream a question is about, defaulting to the one being drawn on. */
function streamOf(value: unknown): "in" | "out" | "err" {
  const name = String(value ?? "out");
  return name === "in" || name === "err" ? name : "out";
}
