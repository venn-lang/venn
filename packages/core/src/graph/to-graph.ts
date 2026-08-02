import type {
  Block,
  Document,
  ExpectStmt,
  FlowDecl,
  ForEachStmt,
  Statement,
} from "../generated/ast.js";
import {
  isActionCall,
  isExpectStmt,
  isFlowDecl,
  isForEachStmt,
  isGroupDecl,
  isIfStmt,
  isLoopStmt,
  isParallelStmt,
  isRaceStmt,
  isRepeatStmt,
  isStepDecl,
} from "../generated/ast.js";
import type { Graph, GraphNode } from "./graph.types.js";

/** Derive the node graph (§22) from a parsed document, a pure AST transform. */
export function toGraph(doc: Document): Graph {
  const graph: Graph = { nodes: [], edges: [] };
  doc.decls.filter(isFlowDecl).forEach((flow, index) => {
    addFlow(graph, flow, `flow-${index}`);
  });
  return graph;
}

function addFlow(graph: Graph, flow: FlowDecl, id: string): void {
  graph.nodes.push({ id, kind: "flow", label: flow.title });
  walkBlock(graph, flow.body, id);
}

function walkBlock(graph: Graph, block: Block, parent: string): void {
  let previous: string | undefined;
  block.stmts.forEach((stmt, index) => {
    const nodeId = addStatement(graph, stmt, `${parent}/n${index}`, parent);
    if (nodeId && previous) graph.edges.push({ from: previous, to: nodeId });
    if (nodeId) previous = nodeId;
  });
}

function addStatement(
  graph: Graph,
  stmt: Statement,
  id: string,
  parent: string,
): string | undefined {
  const container = containerOf(stmt);
  if (container) return addContainer({ graph, id, parent, ...container });
  if (isActionCall(stmt)) return addNode(graph, { id, kind: "action", label: stmt.target, parent });
  if (isExpectStmt(stmt))
    return addNode(graph, { id, kind: "expect", label: exprText(stmt), parent });
  return undefined;
}

/** What the loop calls its item: a name, or the pattern as it was written. */
function loopName(stmt: ForEachStmt): string {
  return stmt.item ?? stmt.pattern?.$cstNode?.text ?? "";
}

function containerOf(stmt: Statement): { kind: string; label: string; body: Block } | undefined {
  if (isStepDecl(stmt)) return { kind: "step", label: stmt.title, body: stmt.body };
  if (isGroupDecl(stmt)) return { kind: "group", label: stmt.title, body: stmt.body };
  if (isForEachStmt(stmt))
    return { kind: "forEach", label: `forEach ${loopName(stmt)}`, body: stmt.body };
  if (isRepeatStmt(stmt)) return { kind: "repeat", label: "repeat", body: stmt.body };
  if (isLoopStmt(stmt)) return { kind: "loop", label: loopLabel(stmt), body: stmt.body };
  if (isParallelStmt(stmt)) return { kind: "parallel", label: "parallel", body: stmt.body };
  if (isRaceStmt(stmt)) return { kind: "race", label: "race", body: stmt.body };
  if (isIfStmt(stmt)) return { kind: "if", label: "if", body: stmt.then };
  return undefined;
}

function addContainer(args: {
  graph: Graph;
  id: string;
  parent: string;
  kind: string;
  label: string;
  body: Block;
}): string {
  addNode(args.graph, { id: args.id, kind: args.kind, label: args.label, parent: args.parent });
  walkBlock(args.graph, args.body, args.id);
  return args.id;
}

function addNode(graph: Graph, node: GraphNode): string {
  graph.nodes.push(node);
  return node.id;
}

function exprText(stmt: ExpectStmt): string {
  return (stmt as { $cstNode?: { text?: string } }).$cstNode?.text ?? "expect";
}

/** What a `loop` reads as in the graph: its condition, its state, or nothing. */
function loopLabel(stmt: { cond?: unknown; state?: { name: string } }): string {
  if (stmt.state) return `loop ${stmt.state.name}`;
  return stmt.cond ? "loop <cond>" : "loop";
}
