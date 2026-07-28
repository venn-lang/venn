import { type Annotation, readMeta } from "@venn/core";

/** Any AST node that carries decorators (`@tags`, `@timeout`, `@retry`…). */
export interface Annotated {
  annotations: Annotation[];
}

/** A parsed `@retry(n, { backoff, factor })` specification. */
export interface RetrySpec {
  attempts: number;
  backoffMs: number;
  factor: number;
}

/**
 * Whether a decorator set this flag on the node.
 *
 * The scheduler reads what expansion concluded, never the annotation list
 * itself, so a decorator is understood in exactly one place.
 */
export function hasAnnotation(node: Annotated, name: string): boolean {
  return readMeta<boolean>(node, name) === true;
}

/** `@timeout(90s)` → milliseconds, or undefined. */
export function readTimeout(node: Annotated): number | undefined {
  return readMeta<number>(node, "timeout");
}

/** `@retry(2, { backoff: 500ms, factor: 2 })` → a retry spec, or undefined. */
export function readRetry(node: Annotated): RetrySpec | undefined {
  return readMeta<RetrySpec>(node, "retry");
}

/** `@lock("orders")` → the lock name, or undefined. */
export function readLock(node: Annotated): string | undefined {
  return readMeta<string>(node, "lock");
}

/** `@flaky(0.05)` → the tolerated failure ratio; bare `@flaky` tolerates all. */
export function readFlaky(node: Annotated): number | undefined {
  return readMeta<number>(node, "flaky");
}

/** `@tags(smoke, critical)` → the tag names. */
export function readTags(node: Annotated): string[] {
  return readMeta<string[]>(node, "tags") ?? [];
}
