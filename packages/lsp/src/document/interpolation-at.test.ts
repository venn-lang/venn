// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn source under test, where ${…} is the language's own interpolation.
import { describe, expect, it } from "vitest";
import { fixture, positionOf } from "../testing/lsp-fixture.js";

const SOURCE = `import { http } from "venn/http"

flow "Checkout" {
  step "Ping" {
    let base = "https://api.test"
    http.get "\${base}/users/\${base}"
    expect true
  }
}`;

async function definitionText(needle: string): Promise<string> {
  const { services, document, uri } = await fixture(SOURCE);
  const links = await services.lsp.DefinitionProvider?.getDefinition(document, {
    textDocument: { uri },
    position: positionOf(document, needle),
  });
  const range = links?.[0]?.targetRange;
  return range ? document.textDocument.getText(range) : "";
}

async function hoverText(needle: string): Promise<string> {
  const { services, document, uri } = await fixture(SOURCE);
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position: positionOf(document, needle),
  });
  const contents = hover?.contents;
  return typeof contents === "object" && "value" in contents ? contents.value : "";
}

describe("inside an interpolated string", () => {
  it("Ctrl+Click on a name jumps to what binds it", async () => {
    expect(await definitionText("base}/users")).toBe('let base = "https://api.test"');
  });

  it("hovering a name describes the binding, not the string", async () => {
    expect(await hoverText("base}/users")).toContain("base");
  });

  it("does not claim the literal text around the placeholder", async () => {
    expect(await definitionText("users/")).toBe("");
  });
});

const PLACEHOLDER = "${env.BASE_URL}";
const ENV_SOURCE = [
  'import { env } from "venn/env"',
  "",
  'flow "Login" {',
  '  step "in" {',
  `    let r = http.get "${PLACEHOLDER}/health"`,
  "    expect r.status == 200",
  "  }",
  "}",
].join("\n");

async function envHoverText(needle: string): Promise<string> {
  const { services, document, uri } = await fixture(ENV_SOURCE);
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position: positionOf(document, needle),
  });
  const contents = hover?.contents;
  return typeof contents === "object" && "value" in contents ? contents.value : "";
}

describe("env inside an interpolated string", () => {
  it("hovering `env` explains the namespace, not a variable", async () => {
    const markdown = await envHoverText("env.BASE_URL");

    expect(markdown).toContain("venn.toml");
    expect(markdown).toContain("--env");
  });
});
