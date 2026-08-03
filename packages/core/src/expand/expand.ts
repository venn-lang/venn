import type { AstNode } from "langium";
import { walkAst } from "../ast/index.js";
import { buildProblem, CODES } from "../codes/index.js";
import type { Annotation, Document } from "../generated/ast.js";
import type { Problem } from "../problem/index.js";
import { spanOf } from "../span/index.js";
import type { DocumentDecoArgs, ImportedDeco } from "./deco/index.js";
import { withDocumentDecos } from "./deco/index.js";
import type { DecoratorDefinition, DecoratorSource, ExpandResult } from "./expand.types.js";
import { makeContext } from "./make-context.js";
import { wrongKind, wrongTargetTitle } from "./wrong-kind.js";

/** What one decorated node needs for its decorators to run. */
interface Site {
  node: AstNode & { annotations: Annotation[] };
  decorators: DecoratorSource;
  uri: string;
  problems: Problem[];
}

/**
 * Run every decorator the program wrote, before anything else reads the program.
 *
 * This is the one place a `@name` means anything. The kernel does not know what
 * `@retry` is; it knows that a name written with an `@` is looked up, handed the
 * node it sits on, and allowed to rewrite it. Built-in decorators come through
 * here too, so there is no shorter path for them.
 *
 * Applied innermost first, so a decorator that rewrites a body finds a body its
 * own decorators have already finished with.
 *
 * A `deco` the document declares, or one imported from a file that wrote `pub`,
 * joins the same source the built-ins live in before any of them run. Nothing
 * below here can tell whether `@memoize` was written in TypeScript, in this
 * file, or in the one next to it.
 *
 * Every file the run reached is expanded, not only the one being run. A `pub fn`
 * is called with the file it was written in around it, and a `@name` written
 * above it belongs to that declaration wherever it is called from.
 *
 * @returns the problems raised. The documents themselves are rewritten in place.
 */
export function expand(args: {
  document: Document;
  decorators: DecoratorSource;
  uri?: string;
  /** The `pub deco`s this file's imports reach, by name. */
  imported?: ReadonlyMap<string, ImportedDeco>;
  /**
   * The other files the import graph reached, by uri.
   *
   * Each is expanded against its own `deco`s and reports at its own uri, exactly
   * as if it were the file being run. Without it a decorator written next to the
   * declaration it decorates took effect only in the file that happened to be
   * the entry, which made decorators a feature of single-file programs.
   */
  modules?: ReadonlyMap<string, Document>;
  /**
   * Which decorated nodes to run. Everything, unless a caller narrows it.
   *
   * The checker narrows it to declarations of types, because a decorator that
   * changes a shape changes what the checker has to check, while one that wraps
   * a function changes nothing it can see. Running only what it needs keeps
   * `venn check` from executing bodies for no reason.
   */
  only?: (node: AstNode) => boolean;
}): ExpandResult {
  const problems: Problem[] = [];
  expandOne({ ...args, uri: args.uri ?? "memory://inline.vn", problems });
  for (const [uri, module] of args.modules ?? []) {
    if (module !== args.document) expandOne({ ...args, document: module, uri, problems });
  }
  return { problems };
}

/** One file, with the decorators it can reach layered over the host's. */
function expandOne(args: DocumentDecoArgs & { only?: (node: AstNode) => boolean }): void {
  const decorators = withDocumentDecos(args);
  const wanted = args.only ?? (() => true);
  const sites = walkAst(args.document).filter(decorated).filter(wanted);
  for (const node of sites.reverse()) {
    applyAll({ node, decorators, uri: args.uri, problems: args.problems });
  }
}

function decorated(node: AstNode): node is AstNode & { annotations: Annotation[] } {
  return ((node as { annotations?: Annotation[] }).annotations ?? []).length > 0;
}

function applyAll(site: Site): void {
  // A copy: a decorator is allowed to rewrite the list it is standing in.
  for (const annotation of [...site.node.annotations]) applyOne(site, annotation);
}

function applyOne(site: Site, annotation: Annotation): void {
  const found = site.decorators.get(annotation.name);
  if (!found) {
    refuse(site, annotation, unknownTitle(annotation), CODES.VN2013_UNKNOWN_DECORATOR.code);
    return;
  }
  const misplaced = wrongPlace(found, site.node, annotation);
  if (misplaced) {
    refuse(site, annotation, misplaced, CODES.VN2014_DECORATOR_TARGET.code);
    return;
  }
  found.expand(
    makeContext({ node: site.node, annotation, uri: site.uri, problems: site.problems }),
  );
}

/**
 * Why a decorator does not belong here, if it does not.
 *
 * A `deco` says what it decorates by typing its first parameter, so the answer
 * is phrased in the words the author used. A plugin's decorator still names node
 * types, because it is handed the raw node and nothing shorter describes what it
 * is able to read.
 */
function wrongPlace(
  found: DecoratorDefinition,
  node: AstNode,
  annotation: Annotation,
): string | undefined {
  const name = annotation.name;
  if (found.accepts) return wrongKind({ name, kinds: found.accepts, node });
  if (!found.targets || found.targets.includes(node.$type)) return undefined;
  return wrongTargetTitle({ name, targets: found.targets, node });
}

function unknownTitle(annotation: Annotation): string {
  return `No decorator is named "@${annotation.name}".`;
}

function refuse(site: Site, annotation: Annotation, title: string, code: string): void {
  site.problems.push(
    buildProblem({ spec: { code, severity: "error" }, span: spanOf(annotation, site.uri), title }),
  );
}
