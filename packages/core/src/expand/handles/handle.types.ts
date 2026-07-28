import type { AstNode } from "langium";

/**
 * What a `deco` decorates, written as the type of its first parameter.
 *
 * These are the words the language uses about itself. A decorator author says
 * `target: Fn` and never learns that the compiler calls that node a `FnDecl`,
 * which is the whole reason this vocabulary exists.
 */
export type TargetKind = "Fn" | "Flow" | "Step" | "Binding" | "Type" | "Node";

/**
 * The value a decorator body holds for its target: named members over the real
 * declaration. Reading one may refuse, so the members are defined as getters.
 */
export type TargetHandle = Record<string, unknown>;

/** What a handle is, for a caller holding one: its kind and every name it answers to. */
export interface HandleSurface {
  readonly kind: TargetKind;
  readonly offered: readonly string[];
}

/** How one member is built, given the node the handle stands for. */
export type Verb = (node: AstNode) => unknown;

/** A slice of the handle surface: what to read, and what to call. */
export interface VerbTable {
  /** Members read as values: `.name`, `.params`, `.title`, `.value`, `.fields`. */
  readonly props: Readonly<Record<string, Verb>>;
  /** Members that do something: `.meta`, `.remove`, `.addParam`, `.wrap`. */
  readonly calls: Readonly<Record<string, Verb>>;
}
