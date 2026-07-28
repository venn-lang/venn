import { type ActionDefinition, type ActionInput, arg, defineAction, z } from "@venn/sdk";
import { t } from "@venn/types";
import { type GqlClient, GqlClientPort, type GqlRequest } from "../port/index.js";

const paramsSchema = z.object({
  variables: z.record(z.string(), z.unknown()).optional(),
  auth: z.string().optional(),
});

/** Which port method a verb rides. `query` and `mutate` execute; `subscribe` streams. */
type GqlTransport = "execute" | "subscribe";

/**
 * Build one gql verb.
 *
 * The document is the single positional argument and everything else rides the
 * options map. All three verbs return the same envelope, `subscribe` included,
 * so a flow reads one shape whatever it asked for.
 *
 * @param config.name The verb as a flow writes it, such as `query`.
 * @param config.transport Which {@link GqlClient} method carries it.
 */
export function gqlAction(config: { name: string; transport: GqlTransport }): ActionDefinition {
  return defineAction({
    name: config.name,
    doc: `GraphQL ${config.name} operation.`,
    params: paramsSchema.optional(),
    args: [arg("document", t.string, "The query, mutation or subscription text.")],
    result: t.ref("gql.GraphqlResponse"),
    run: (ctx, input) =>
      dispatch({ client: ctx.port(GqlClientPort), transport: config.transport, input }),
  });
}

function dispatch(args: {
  client: GqlClient;
  transport: GqlTransport;
  input: ActionInput<unknown>;
}): Promise<unknown> {
  const request = buildRequest(args.input);
  return args.transport === "subscribe"
    ? args.client.subscribe(request)
    : args.client.execute(request);
}

function buildRequest(input: ActionInput<unknown>): GqlRequest {
  const params = (input.params ?? {}) as { variables?: Record<string, unknown>; auth?: string };
  return { query: String(input.args[0] ?? ""), variables: params.variables, auth: params.auth };
}
