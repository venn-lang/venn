import { type ActionDefinition, arg, defineAction } from "@venn/sdk";
import { t } from "@venn/types";
import type { ServeHandle } from "./serve-action.js";

/**
 * `http.on server handler`: say what the server answers with.
 *
 * The handler is an ordinary `fn`, so everything the language already does
 * applies inside it: it can call any verb, and it waits for what it reaches for
 * without saying so. Whatever it returns becomes the reply. Calling `http.on`
 * again replaces the handler.
 */
export function onAction(): ActionDefinition {
  return defineAction({
    name: "on",
    doc: "Answer this server's requests with a function. `fn (req) => { … }` is the reply.",
    // The callback type is what gives `req` its shape, so `http.on api req => …`
    // needs no annotation in the flow.
    args: [
      arg("server", t.ref("http.Server"), "The handle `http.serve` gave back."),
      arg(
        "handler",
        t.callback([t.ref("http.Request")], t.dynamic, 1),
        "Called for every request. What it returns is the reply.",
      ),
    ],
    result: t.void,
    run: (ctx, input) => {
      const server = asServer(input.args[0]);
      const handler = input.args[1];
      if (!server) throw new Error("`http.on` needs a server, as `http.serve` returns.");
      if (handler === undefined) throw new Error("`http.on` needs a function to answer with.");
      server.onRequest((request) => ctx.invoke(handler, [request]));
      return undefined;
    },
  });
}

function asServer(value: unknown): ServeHandle | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  return (value as ServeHandle).kind === "http-server" ? (value as ServeHandle) : undefined;
}
