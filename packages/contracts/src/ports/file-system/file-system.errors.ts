import { HOST_CODES } from "../../errors/host-codes.js";
import { VennError } from "../../errors/index.js";

/** VN8010: a read or a remove targeted a path that does not exist. */
export function fsNotFound(args: { path: string }): VennError {
  return new VennError({
    code: HOST_CODES.VN8010_NOT_FOUND,
    message: `File not found: "${args.path}".`,
    detail: { path: args.path },
  });
}
