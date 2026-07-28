import { type ZodType, z } from "@venn-lang/sdk";

/** The handle `browser.launch` yields. */
const Browser = z.object({ id: z.string(), engine: z.string() });

/** The handle `browser.newContext` yields; what `page.` completes against. */
const Page = z.object({ id: z.string(), url: z.string() });

/** A resolved DOM element, as `visible` and `text` are handed it. */
const Element = z.object({ visible: z.boolean(), text: z.string(), value: z.string() });

/** Runtime validators for the nominal types the `browser` namespace registers. */
export const browserTypes: Record<string, ZodType> = { Browser, Page, Element };
