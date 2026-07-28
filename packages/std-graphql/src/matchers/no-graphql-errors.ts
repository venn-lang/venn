import { defineMatcher, type MatcherDefinition } from "@venn/sdk";

/**
 * `expect res noGraphqlErrors`: passes when `errors` is absent or empty.
 *
 * GraphQL reports failures inside a 200 response, so this is the check that
 * `expect res status 200` cannot make.
 */
export const noGraphqlErrors: MatcherDefinition = defineMatcher({
  name: "noGraphqlErrors",
  appliesTo: "GraphqlResponse",
  test: ({ subject }) => isEmpty((subject as { errors?: unknown }).errors),
  message: () => "expected the GraphQL response to carry no errors",
});

function isEmpty(errors: unknown): boolean {
  if (errors === undefined || errors === null) return true;
  return Array.isArray(errors) && errors.length === 0;
}
