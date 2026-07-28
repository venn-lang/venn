import { type ActionDefinition, arg, defineAction } from "@venn/sdk";
import { t } from "@venn/types";
import { HttpClientPort } from "../port/index.js";
import { buildRequest } from "./build-request.js";
import type { RequestParams } from "./request.types.js";
import { requestParams } from "./request-params.js";

/**
 * Build the action for one HTTP verb.
 *
 * Every verb has the same shape: the URL is the single positional argument and
 * everything else rides in the options map, so `http.get` and `http.post` read
 * alike at the call site.
 *
 * @param config.name The verb as a flow writes it, such as `get`.
 * @param config.method The method put on the wire, such as `GET`.
 */
export function httpAction(config: { name: string; method: string }): ActionDefinition {
  return defineAction({
    name: config.name,
    doc: `HTTP ${config.method} request.`,
    params: requestParams.optional(),
    args: [arg("url", t.string, "Where to send it. Relative paths join the configured base URL.")],
    result: t.ref("http.Response"),
    run: (ctx, input) =>
      ctx.port(HttpClientPort).request(
        buildRequest({
          method: config.method,
          url: input.args[0],
          params: (input.params ?? {}) as RequestParams,
          baseUrl: ctx.config.baseUrl,
          signal: ctx.signal,
        }),
      ),
  });
}
