import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { toGraph } from "./to-graph.js";

describe("toGraph", () => {
  it("maps flow → step → action/expect with containment and sequencing", () => {
    const { ast } = parse(`flow "Checkout" {
  step "Login" {
    http.post "/auth"
    expect res.status == 200
  }
  forEach x in [1, 2] {
    step "each" { expect x > 0 }
  }
}`);
    const graph = toGraph(ast);

    const flow = graph.nodes.find((node) => node.kind === "flow");
    expect(flow?.label).toBe("Checkout");
    const step = graph.nodes.find((node) => node.kind === "step" && node.label === "Login");
    expect(step?.parent).toBe(flow?.id);
    const action = graph.nodes.find((node) => node.kind === "action");
    expect(action?.label).toBe("http.post");
    expect(action?.parent).toBe(step?.id);
    expect(graph.nodes.some((node) => node.kind === "forEach")).toBe(true);
    // action → expect sequential edge inside the Login step
    expect(graph.edges.some((edge) => edge.from === action?.id)).toBe(true);
  });
});
