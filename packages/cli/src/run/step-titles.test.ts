import { type FlowDecl, isFlowDecl, parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { stepTitlesOf } from "./step-titles.js";

const SOURCE = `fragment ping() {
  step "ping" { expect true }
}

fragment loops() {
  run loops()
  step "recursive" { expect true }
}

flow "Checkout" {
  run ping()
  forEach x in [1, 2] {
    step "iterate" { expect true }
  }
  if 1 == 1 {
    step "branch" { expect true }
  } else {
    step "other" { expect true }
  }
  try {
    step "risky" { expect true }
  } catch err {
    step "caught" { expect true }
  } finally {
    step "always" { expect true }
  }
  group "payment" {
    step "charge" { expect true }
  }
}

flow "Recursive" {
  run loops()
}`;

function titles(flowTitle: string): string[] {
  const { ast, problems } = parse(SOURCE);
  expect(problems).toEqual([]);
  const flow = ast.decls.filter(isFlowDecl).find((decl) => decl.title === flowTitle) as FlowDecl;
  return stepTitlesOf(flow, ast);
}

describe("step titles", () => {
  it("reaches steps through fragments, branches, loops, try and groups", () => {
    expect(titles("Checkout")).toEqual([
      "ping",
      "iterate",
      "branch",
      "other",
      "risky",
      "caught",
      "always",
      "charge",
    ]);
  });

  it("does not loop forever on a fragment that runs itself", () => {
    expect(titles("Recursive")).toEqual(["recursive"]);
  });
});
