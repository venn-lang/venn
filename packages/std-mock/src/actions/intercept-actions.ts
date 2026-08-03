import {
  type ActionDefinition,
  type ActionInput,
  arg,
  defineAction,
  optionalArg,
  z,
} from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { getMockState, type Interceptor, type MockResponse } from "../state/index.js";

/**
 * `mock.intercept("POST", "/charge", { respond })`: catch a request matching a
 * method and a path pattern, and answer it with a canned reply.
 *
 * A `respond` that is not already a response is taken as the body, with status
 * 200, so a plain map can be handed straight in.
 */
export const intercept: ActionDefinition = defineAction({
  name: "intercept",
  doc: 'Register an interceptor, e.g. mock.intercept("POST", "**/charge", { respond }).',
  params: z.object({ respond: z.unknown().optional() }).optional(),
  args: [
    arg("method", t.string, "Which verb to catch: `GET`, `POST`, `*` for any."),
    arg("url", t.string, "Which URL to catch. A pattern is allowed."),
  ],
  result: t.ref("mock.Interceptor"),
  run: (_ctx, input) => registerIntercept(input),
});

function registerIntercept(input: ActionInput<unknown>): Interceptor {
  const params = (input.params ?? {}) as { respond?: unknown };
  const entry: Interceptor = {
    method: String(input.args[0] ?? "GET"),
    path: String(input.args[1] ?? ""),
    respond: toResponse(params.respond),
  };
  getMockState().intercepts.push(entry);
  return entry;
}

/** `mock.respond(status, { body })`: build a canned reply for an interceptor. */
export const respond: ActionDefinition = defineAction({
  name: "respond",
  doc: "Build a canned response for an interceptor.",
  params: z.object({ status: z.number().optional(), body: z.unknown().optional() }).optional(),
  // Both may arrive positionally or by name, and `run` reads whichever came, so
  // both are optional as arguments: `mock.respond { status: 201, body: … }`
  // passes none of them positionally and is the spelling the README shows first.
  // Declaring them required made the argument count refuse the verb's own
  // documentation.
  args: [
    optionalArg("status", t.number, "The status code to answer with."),
    optionalArg("body", t.dynamic, "What to answer with. A map or list is sent as JSON."),
  ],
  result: t.ref("mock.Response"),
  run: (_ctx, input) => buildResponse(input),
});

function buildResponse(input: ActionInput<unknown>): MockResponse {
  const params = (input.params ?? {}) as { status?: number; body?: unknown };
  const status = input.args[0] === undefined ? (params.status ?? 200) : Number(input.args[0]);
  return { status, body: params.body ?? input.args[1] ?? null };
}

function toResponse(value: unknown): MockResponse {
  if (isResponse(value)) return value;
  return { status: 200, body: value ?? null };
}

function isResponse(value: unknown): value is MockResponse {
  return typeof value === "object" && value !== null && "status" in value && "body" in value;
}
