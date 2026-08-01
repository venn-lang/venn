import type { AstNode } from "langium";
import type { Problem } from "../problem/index.js";
import type { TargetKind } from "./handles/index.js";

/**
 * A node a decorator may be attached to, as the decorator sees it.
 *
 * Deliberately structural: a decorator receives the real tree, not a copy and
 * not a facade, so it can read anything the grammar produced and rewrite it.
 * `$type` is how it knows what it is holding.
 */
export type DecoratedNode = AstNode;

/** What a decorator writes for the runtime to read later. */
export type NodeMeta = Record<string, unknown>;

/**
 * Everything a decorator is handed when it runs.
 *
 * Expansion happens once, between parsing and everything else, so a decorator
 * sees the whole program before a single statement has run. What it leaves
 * behind is what the checker checks and the runtime runs.
 */
export interface ExpandContext {
  /** The node carrying this decorator. */
  readonly node: DecoratedNode;
  /** The arguments, evaluated: `@retry(2, { backoff: 500ms })` gives `[2, {…}]`. */
  readonly args: readonly unknown[];
  /** The same arguments as syntax, for a decorator that transforms rather than reads. */
  readonly written: readonly DecoratedNode[];
  /** Where the node sits, for a decorator that needs to look around or reattach. */
  readonly parent: DecoratedNode | undefined;
  /** Put this node in place of the decorated one. */
  replace(node: DecoratedNode): void;
  /** Take the decorated node out of the tree entirely. */
  remove(): void;
  /** Leave something for the runtime, keyed by name. */
  meta(key: string, value: unknown): void;
  /** Refuse the program, in the language's own error vocabulary. */
  reject(args: { code: string; title: string }): void;
}

/**
 * A decorator: a named transformation of the tree, contributed by the kernel or
 * by a plugin, and applied wherever a program writes `@name`.
 */
export interface DecoratorDefinition {
  readonly name: string;
  readonly doc?: string;
  /**
   * The `$type`s this may decorate, such as `["FlowDecl", "StepDecl"]`. Omitted
   * means anywhere: a decorator that reads nothing about its target constrains
   * nothing about it.
   *
   * Node names are the plugin author's spelling, and they stay. A TypeScript
   * decorator is handed the raw node, so nothing shorter describes what it is
   * able to read.
   */
  readonly targets?: readonly string[];
  /**
   * The kinds this decorates, as a `deco` declared them, read off the type of
   * its first parameter with `acceptedKinds`. Present only for a decorator the
   * language itself declared, and it wins over `targets`: a signature says in
   * the user's words what a list of node names only approximates.
   */
  readonly accepts?: readonly TargetKind[];
  expand(ctx: ExpandContext): void;
}

/** Where expansion looks a decorator up. The kernel does not know what plugins are. */
export interface DecoratorSource {
  get(name: string): DecoratorDefinition | undefined;
  /**
   * Every name this source answers to.
   *
   * A source that can say whether it has one can say which it has, and both
   * questions have the same asker: a check that refuses `@retryy` wants to
   * offer `@retry`, and completion after `@` wants the same list.
   */
  names(): readonly string[];
}

/** What expansion reports. The tree itself is rewritten in place. */
export interface ExpandResult {
  problems: Problem[];
}
