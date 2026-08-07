import {
  type AstNode,
  type CheckTypesOptions,
  checkTypes,
  type DecoratorSource,
  type Expr,
  forwardReadProblems,
  importedTypes,
  type Type,
  type TypeCatalog,
} from "@venn-lang/core";
import type { TypeSpec } from "@venn-lang/types";
import { type CheckArgs, checkDocument, checkImports, loudestFirst } from "../check/index.js";
import { createDecoratorSource } from "../decorators/index.js";
import { buildRegistry, type Registry } from "../registry/index.js";
import { createTypeCatalog, publishedValueTypes } from "../types/index.js";
import type { Analysis, AnalyzeArgs, FrontEnd, FrontEndArgs } from "./analyze.types.js";

/** What the loaded plugins settle, once, for every file the process analyses. */
interface Loaded {
  registry: Registry;
  decorators: DecoratorSource;
  catalog: TypeCatalog;
  published: ReadonlyMap<string, Record<string, TypeSpec>>;
}

/**
 * Build the front end: every pass a `.vn` file goes through, in one place.
 *
 * The registry, the decorators, the type catalog and what the plugins publish
 * are settled here and reused for every file, because reading them again per
 * file, or per keystroke, is work whose answer never changes.
 *
 * @param args The plugins this host loaded, and the capabilities it offers.
 * @returns A front end whose `analyze` runs every pass over one parsed file and
 * hands back everything they found, loudest first.
 * @throws VennError `VN2010` when a plugin requires a capability the host lacks.
 */
export function createFrontEnd(args: FrontEndArgs): FrontEnd {
  const loaded: Loaded = {
    registry: buildRegistry({ plugins: args.plugins, caps: args.caps }),
    decorators: createDecoratorSource(args.plugins),
    catalog: createTypeCatalog(args.plugins),
    published: publishedValueTypes(args.plugins),
  };
  return { analyze: (input) => analyze(input, loaded) };
}

/**
 * Every pass, over one file.
 *
 * In the order a reader wants them: what the names resolve to, then what the
 * imports promised, then what the types work out to. Which of them stops a
 * command, and which merely gets said, is the command's own business.
 */
function analyze(args: AnalyzeArgs, loaded: Loaded): Analysis {
  const named = checkDocument(resolution(args, loaded));
  const early = forwardReadProblems({ document: args.document, uri: args.uri });
  const imported = checkImports({
    document: args.document,
    uri: args.uri,
    graph: args.graph,
    registry: loaded.registry,
    packages: args.packages,
    unreadable: args.unreadable,
    cycles: args.cycles,
  });
  const typed = checkTypes(args.document, typing(args, loaded));
  return {
    problems: loudestFirst([...named, ...early, ...imported, ...typed.problems]),
    types: typed.types as ReadonlyMap<AstNode, Type>,
    slots: typed.slots as ReadonlyMap<AstNode, readonly (Expr | undefined)[]>,
  };
}

function resolution(args: AnalyzeArgs, loaded: Loaded): CheckArgs {
  return {
    document: args.document,
    uri: args.uri,
    registry: loaded.registry,
    decorators: loaded.decorators,
    importedDecos: args.decos.keys(),
    fragments: args.fragments,
    env: args.env,
  };
}

/**
 * What the imported names are, worked out from the files they were written in,
 * so a wrong argument to an imported function is caught here and not at run
 * time.
 *
 * A package that is a plugin publishes its values in code, and an installed one
 * publishes them in the types the install derived. The derived ones are listed
 * last, so a package that is both keeps what was read from its types.
 */
function typing(args: AnalyzeArgs, loaded: Loaded): CheckTypesOptions {
  const packages = new Map([...loaded.published, ...args.packages]);
  return {
    uri: args.uri,
    catalog: loaded.catalog,
    decos: args.decos,
    imports: importedTypes({
      ...args.graph,
      document: args.document,
      uri: args.uri,
      catalog: loaded.catalog,
      packages,
    }),
  };
}
