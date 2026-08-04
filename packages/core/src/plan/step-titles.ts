import type { Block, Document, FlowDecl, IfStmt, Statement } from "../generated/ast.js";
import { isBlock, isFragmentDecl, isIfStmt, isRunStmt, isStepDecl } from "../generated/ast.js";

interface Walk {
  document: Document;
  /** Fragments already entered, so a recursive `run` cannot loop forever. */
  seen: Set<string>;
}

/**
 * Every step title a flow can reach: nested in groups, loops, branches and
 * `try`, and followed through `run <fragment>` into fragments of the same file.
 */
export function stepTitlesOf(flow: FlowDecl, document: Document): string[] {
  return fromBlock(flow.body, { document, seen: new Set() });
}

function fromBlock(block: Block, walk: Walk): string[] {
  return block.stmts.flatMap((stmt) => fromStatement(stmt, walk));
}

function fromStatement(stmt: Statement, walk: Walk): string[] {
  if (isStepDecl(stmt)) return [stmt.title, ...fromBlock(stmt.body, walk)];
  if (isRunStmt(stmt)) return fromFragment(stmt.target, walk);
  if (isIfStmt(stmt)) return fromIf(stmt, walk);
  return nestedBlocks(stmt).flatMap((block) => fromBlock(block, walk));
}

function fromIf(stmt: IfStmt, walk: Walk): string[] {
  const then = fromBlock(stmt.then, walk);
  const otherwise = stmt.otherwise;
  if (!otherwise) return then;
  const tail = isBlock(otherwise) ? fromBlock(otherwise, walk) : fromStatement(otherwise, walk);
  return [...then, ...tail];
}

function fromFragment(name: string, walk: Walk): string[] {
  if (walk.seen.has(name)) return [];
  const decl = walk.document.decls.find((node) => isFragmentDecl(node) && node.name === name);
  if (!isFragmentDecl(decl)) return [];
  walk.seen.add(name);
  return fromBlock(decl.body, walk);
}

// group / forEach / repeat / while / parallel / race / try all carry blocks.
function nestedBlocks(stmt: Statement): Block[] {
  const node = stmt as { body?: Block; handler?: Block; finalizer?: Block };
  return [node.body, node.handler, node.finalizer].filter((block): block is Block =>
    Array.isArray(block?.stmts),
  );
}
