/**
 * The four counted rules of the charter, measured over one file.
 *
 * Measured with the TypeScript syntax API rather than by matching text, because
 * every one of these is a question about a span: where a function ends, how
 * many parameters a signature really has, whether a `type` is exported. The
 * parser arrives as `tsc-api`, the same alias `@venn-lang/dts` uses, since
 * TypeScript 7 is the Go port and publishes no syntax API at all.
 *
 * A function's length is its whole declaration, from the signature line to the
 * closing brace, with the JSDoc above it excluded. The charter says "linhas por
 * funcao" without settling the boundary, and the choice decides the answer: by
 * the interior of the body the same tree measures 77 violations, by the whole
 * declaration 181, because a hundred of them are 16 to 20 lines with 15 or
 * fewer inside.
 */
import ts from "tsc-api";

const FUNCTIONS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
]);

export const MOST_LINES_IN_A_FILE = 300;
export const MOST_LINES_IN_A_FUNCTION = 15;
export const MOST_ARGUMENTS = 3;

/** The file parsed, with positions kept so a span can be turned into lines. */
export function parsed(path, text) {
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function everyNode(file) {
  const found = [];
  const visit = (node) => {
    found.push(node);
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(file, visit);
  return found;
}

const lineOf = (file, at) => file.getLineAndCharacterOfPosition(at).line;

/** How many lines a function spans, its documentation not counted. */
function spanOf(file, node) {
  return lineOf(file, node.end) - lineOf(file, node.getStart(file, false)) + 1;
}

/**
 * What a function is called where it is written.
 *
 * An arrow bound to a name is called by the name it is bound to, which is what
 * a person searches for. One that is not gets its line, which is the only thing
 * that tells two of them apart.
 */
function nameOf(file, node) {
  const own = node.name?.getText(file);
  if (own) return own;
  const bound = node.parent;
  if (ts.isVariableDeclaration(bound) || ts.isPropertyAssignment(bound))
    return bound.name.getText(file);
  return `line ${lineOf(file, node.getStart(file, false)) + 1}`;
}

/** Every function in the file that runs past the charter's fifteen lines. */
export function longFunctions(file) {
  return everyNode(file)
    .filter((node) => FUNCTIONS.has(node.kind))
    .filter((node) => spanOf(file, node) > MOST_LINES_IN_A_FUNCTION);
}

/** Every function that takes more than three arguments, by name. */
export function overloadedSignatures(file) {
  return everyNode(file)
    .filter((node) => FUNCTIONS.has(node.kind) && node.parameters.length > MOST_ARGUMENTS)
    .map((node) => nameOf(file, node))
    .sort();
}

/**
 * Every exported type or interface declared outside a `*.types.ts`.
 *
 * Scoped to the exported ones on purpose. A one-line alias local to the file
 * that uses it is not a contract at a boundary, and the charter does not answer
 * whether it is meant.
 */
export function typesOutsideATypesFile(file) {
  if (file.fileName.endsWith(".types.ts")) return 0;
  return everyNode(file).filter(
    (node) =>
      (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
      node.modifiers?.some((one) => one.kind === ts.SyntaxKind.ExportKeyword),
  ).length;
}
