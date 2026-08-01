/**
 * What each decorator the language documents is for, per spec §08.
 *
 * Longer than the one-line `doc` a `DecoratorDefinition` carries, because a
 * hover is where someone actually reads it. A name here that no decorator
 * implements is still documented: the editor can explain `@load` long before
 * `@venn-lang/load` contributes it.
 */
const DOCS: Record<string, string> = {
  doc: "Documentation shown in the editor and the node tooltip.",
  timeout: "Abort the flow or step after a duration, e.g. `@timeout(90s)`.",
  retry: "Re-run on failure with backoff, e.g. `@retry(2, { backoff: 500ms })`.",
  skip: "Skip this flow or step, optionally conditionally.",
  only: "Focus: run only the annotated flows.",
  serial: "Forbid concurrent execution with sibling flows.",
  lock: 'Named mutex held across workers, e.g. `@lock("orders")`.',
  flaky: "Declared flakiness tolerance, e.g. `@flaky(ratio: 0.05)`.",
  tags: "Tags matched by the runner's `--tags` filter.",
  load: "Run the flow as a load test (from `@venn-lang/load`).",
};

/** The prose for a decorator the language documents, if it documents one. */
export function decoratorDoc(name: string): string | undefined {
  return DOCS[name];
}
