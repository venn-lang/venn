import { type ZodType, z } from "@venn-lang/sdk";
import type { RequestParams } from "./request.types.js";

const scalar = z.union([z.string(), z.number(), z.boolean()]);
const scalarMap = z.record(z.string(), scalar);

/**
 * Validation for {@link RequestParams}, the options map every http verb accepts.
 *
 * Each key carries its own `.describe()` because the editor reads this schema to
 * offer the keys, document them and reject the ones that do not exist. Keeping
 * the wording here keeps it beside the rule it describes.
 */
export const requestParams: ZodType<RequestParams> = z.object({
  headers: scalarMap
    .optional()
    .describe("Extra headers. Anything you set here wins over what Venn would infer."),
  query: scalarMap.optional().describe("Appended to the URL as a query string, encoded for you."),
  body: z
    .unknown()
    .optional()
    .describe("What to send. A map becomes JSON; a string is sent as written."),
  encode: z
    .enum(["json", "form", "multipart", "raw"])
    .optional()
    .describe("How to serialise `body`. Defaults to `json` for a map, `raw` for a string."),
  bearer: z.string().optional().describe("Shorthand for `Authorization: Bearer …`."),
  basic: z
    .object({ user: z.string(), pass: z.string() })
    .optional()
    .describe("Shorthand for HTTP basic auth."),
});
