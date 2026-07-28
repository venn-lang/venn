import type { TypeSpec } from "@venn/types";
import ts from "tsc-api";
import { newState, toSpec } from "./convert/index.js";

/** What one installed package publishes, as this language's types. */
export interface PackageTypes {
  package: string;
  /** Each export, by the name it is imported under. */
  exports: Record<string, TypeSpec>;
  /** How many exports were read, and how many came back `dynamic`. */
  covered: { total: number; dynamic: number };
}

/**
 * The types an installed package publishes.
 *
 * Read through the TypeScript compiler rather than by parsing `.d.ts` text: a
 * modern package's exported types are built out of generics, conditionals and
 * mapped types, which have no meaning until something resolves them. Parsing
 * gives back the machinery; asking the compiler gives back the answer.
 *
 * The compiler comes in under the alias `tsc-api`, pinned to the 5.x line,
 * because TypeScript 7 is Go-native and ships no JavaScript API until 7.1. So
 * 7 builds this repo and 5.9 is a library this one package calls.
 *
 * @returns every export as a {@link TypeSpec}, with a count of how many came
 * back `dynamic`. A package that ships no types is not an error: `exports` is
 * empty and `covered.total` is zero.
 */
export function readPackageTypes(args: {
  /** The package name, as it is imported. */
  package: string;
  /** A file to resolve from, such as the generated `package.json` in `target/`. */
  from: string;
}): PackageTypes {
  const declarations = declarationFile(args);
  if (!declarations) return empty(args.package);
  const program = ts.createProgram([declarations], OPTIONS);
  const source = program.getSourceFile(declarations);
  const checker = program.getTypeChecker();
  const symbol = source && checker.getSymbolAtLocation(source);
  if (!symbol) return empty(args.package);
  return counted(args.package, exportsOf({ symbol, checker }));
}

const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  skipLibCheck: true,
  strict: true,
};

/** Where the package's declarations are, as TypeScript itself resolves them. */
function declarationFile(args: { package: string; from: string }): string | undefined {
  const host = ts.createCompilerHost(OPTIONS);
  const found = ts.resolveModuleName(args.package, args.from, OPTIONS, host);
  const file = found.resolvedModule?.resolvedFileName;
  // `.d.ts`, `.d.mts` and `.d.cts` are all declarations. zod ships the last of
  // the three, so a filter naming only the first two finds nothing at all.
  return file && /\.d\.[cm]?ts$/.test(file) ? file : undefined;
}

function exportsOf(args: { symbol: ts.Symbol; checker: ts.TypeChecker }): Record<string, TypeSpec> {
  const out: Record<string, TypeSpec> = {};
  const conv = { checker: args.checker, depth: 0, state: newState() };
  for (const each of args.checker.getExportsOfModule(args.symbol)) {
    const decl = each.valueDeclaration ?? each.declarations?.[0];
    if (!decl) continue;
    out[each.getName()] = toSpec(args.checker.getTypeOfSymbolAtLocation(each, decl), conv);
  }
  return out;
}

/**
 * How much of the package came across.
 *
 * Counted and reported rather than claimed: "94% of exports typed" can be
 * checked and driven up, unlike "fully compatible".
 */
function counted(name: string, exports: Record<string, TypeSpec>): PackageTypes {
  const all = Object.values(exports);
  return {
    package: name,
    exports,
    covered: { total: all.length, dynamic: all.filter((one) => one.kind === "dynamic").length },
  };
}

function empty(name: string): PackageTypes {
  return { package: name, exports: {}, covered: { total: 0, dynamic: 0 } };
}
