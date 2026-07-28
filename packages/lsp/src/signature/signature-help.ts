import type { LangiumDocument } from "langium";
import type { SignatureHelpProvider } from "langium/lsp";
import type {
  SignatureHelp,
  SignatureHelpOptions,
  SignatureHelpParams,
} from "vscode-languageserver";
import type { SymbolCatalog } from "../catalog/index.js";
import type { VennServices } from "../services/lsp.types.js";
import type { TypeService } from "../types/index.js";
import { activeArg, enclosingMatcher } from "./action-call.js";
import { enclosingBareCall } from "./bare-call.js";
import { callShape, matcherShape } from "./call-shape.js";
import type { CallShape } from "./call-shape.types.js";
import { enclosingParenCall } from "./paren-call.js";
import { bracketed, signatureOfShape } from "./render-shape.js";
import { shapeAt } from "./shape-at.js";

/**
 * What the call being typed takes, one argument at a time.
 *
 * The space is a trigger character because Venn's calls have no brackets to
 * hang one off: `http.on ` is already a call with an argument due. Waiting for
 * a `(` that never comes is how a language ends up unable to explain itself.
 */
export class VennSignatureHelpProvider implements SignatureHelpProvider {
  private readonly catalog: SymbolCatalog;
  private readonly types: TypeService;

  constructor(services: VennServices) {
    this.catalog = services.catalog;
    this.types = services.types;
  }

  get signatureHelpOptions(): SignatureHelpOptions {
    return { triggerCharacters: ["(", ",", " "], retriggerCharacters: [" ", ","] };
  }

  provideSignatureHelp(
    document: LangiumDocument,
    params: SignatureHelpParams,
  ): SignatureHelp | undefined {
    const offset = document.textDocument.offsetAt(params.position);
    return (
      this.forParens(document, offset) ??
      this.forMatcher(document, offset) ??
      this.forAction(document, offset)
    );
  }

  /** `saudacao(▮)`: a call with brackets, wherever its callee was declared. */
  private forParens(document: LangiumDocument, offset: number): SignatureHelp | undefined {
    const found = enclosingParenCall(document, offset);
    if (!found) return undefined;
    const shape = shapeAt({ ...found, document, catalog: this.catalog, types: this.types });
    if (!shape || parts(shape) === 0) return undefined;
    return help(bracketed(shape), found.active, parts(shape));
  }

  /** `expect res contains ▮`: the value the check is waiting for. */
  private forMatcher(document: LangiumDocument, offset: number): SignatureHelp | undefined {
    const clause = enclosingMatcher(document, offset);
    if (!clause) return undefined;
    const shape = matcherShape(clause.name, this.catalog);
    if (!shape || parts(shape) === 0) return undefined;
    return help(signatureOfShape(shape), activeArg(clause, offset), parts(shape));
  }

  /** `http.on api handler`: a verb and its bare arguments, bound or not. */
  private forAction(document: LangiumDocument, offset: number): SignatureHelp | undefined {
    const call = enclosingBareCall(document, offset);
    if (!call) return undefined;
    const shape = callShape(call.target, this.catalog);
    if (!shape || parts(shape) === 0) return undefined;
    return help(signatureOfShape(shape), activeArg(call, offset), parts(shape));
  }
}

/**
 * How many things the signature can point at: the positional arguments, plus
 * the options map when there is one. The map is the last argument, not
 * decoration.
 */
function parts(shape: CallShape): number {
  return shape.args.length + (shape.options.length > 0 ? 1 : 0);
}

function help(
  signature: SignatureHelp["signatures"][number],
  active: number,
  count: number,
): SignatureHelp {
  return {
    signatures: [signature],
    activeSignature: 0,
    activeParameter: Math.min(active, Math.max(count - 1, 0)),
  };
}
