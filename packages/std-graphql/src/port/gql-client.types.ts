/** One operation to run: the document text, its variables and any bearer token. */
export interface GqlRequest {
  query: string;
  variables?: Record<string, unknown>;
  auth?: string;
}

/** One entry of `errors`. `path` walks down `data` to the field that failed. */
export interface GqlError {
  message: string;
  path?: readonly (string | number)[];
  extensions?: Record<string, unknown>;
}

/**
 * The `{ data, errors }` envelope, and what `res` holds after a gql verb.
 *
 * GraphQL answers 200 with errors inside, so a failed operation arrives here and
 * not as a thrown error. `expect res noGraphqlErrors` is how a flow checks.
 */
export interface GqlResponse {
  data?: unknown;
  errors?: readonly GqlError[];
}

/**
 * Running one GraphQL operation against an endpoint.
 *
 * `execute` and `subscribe` are separate methods because the transports differ,
 * even though both answer with the same envelope.
 *
 * Two implementations: `createRealClient` and `createFakeClient`.
 */
export interface GqlClient {
  execute(req: GqlRequest): Promise<GqlResponse>;
  subscribe(req: GqlRequest): Promise<GqlResponse>;
}
