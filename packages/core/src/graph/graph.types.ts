/** A node in the visual graph derived from the AST (§22). */
export interface GraphNode {
  id: string;
  kind: string;
  label: string;
  parent?: string;
}

/** A directed edge between two graph nodes (sequential flow or branch). */
export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

/** The graph the editor renders: nodes plus edges, derived purely from the AST. */
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
