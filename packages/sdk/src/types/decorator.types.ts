/**
 * A node as a decorator sees it: the real tree, structurally typed so the SDK
 * stays free of the compiler. `$type` says what it is holding.
 */
export type DecoratedNode = { readonly $type: string } & Record<string, unknown>;

/** What a decorator is handed when the compiler expands it. */
export interface ExpandContext {
  readonly node: DecoratedNode;
  readonly args: readonly unknown[];
  /** The arguments as syntax, for a decorator that transforms rather than reads. */
  readonly written: readonly DecoratedNode[];
  readonly parent: DecoratedNode | undefined;
  replace(node: DecoratedNode): void;
  remove(): void;
  /** Leave a fact on the node for a later stage to read. */
  meta(key: string, value: unknown): void;
  /** Refuse the program with a `VNxxxx` problem, before anything runs. */
  reject(args: { code: string; title: string }): void;
}

/** A named transformation of the program's tree, applied wherever `@name` is written. */
export interface DecoratorDefinition {
  readonly name: string;
  readonly doc?: string;
  /** The `$type`s it decorates. Omitted means anywhere. */
  readonly targets?: readonly string[];
  expand(ctx: ExpandContext): void;
}
