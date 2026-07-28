import { VennError } from "../../errors/index.js";

/** VN8010: a read or a remove targeted a path that does not exist. */
export function fsNotFound(args: { path: string }): VennError {
  return new VennError({
    code: "VN8010",
    message: `File not found: "${args.path}".`,
    detail: { path: args.path },
  });
}
