import type { EventSink } from "@venn-lang/runtime";

interface FlowResult {
  title: string;
  status: string;
}

const XML_ESCAPES: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  '"': "&quot;",
};

/** Accumulate flow results and emit a JUnit XML document on run.finished. */
export function createJunitSink(args: { write: (xml: string) => void }): EventSink {
  const flows: FlowResult[] = [];
  return {
    emit: (envelope) => {
      if (envelope.kind === "flow.finished") flows.push(envelope.data as FlowResult);
      else if (envelope.kind === "run.finished") args.write(toJunit(flows));
    },
  };
}

function toJunit(flows: readonly FlowResult[]): string {
  const failures = flows.filter((flow) => flow.status === "failed").length;
  const cases = flows.map(toCase).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite tests="${flows.length}" failures="${failures}">\n${cases}\n</testsuite>\n`;
}

function toCase(flow: FlowResult): string {
  const body = flow.status === "failed" ? "<failure/>" : "";
  return `  <testcase name="${escapeXml(flow.title)}">${body}</testcase>`;
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"]/g, (char) => XML_ESCAPES[char] ?? char);
}
