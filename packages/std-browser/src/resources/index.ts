import type { ResourceDefinition } from "@venn/sdk";
import { browserResource } from "./browser-resource.js";
import { pageResource } from "./page-resource.js";

/** Every resource the `browser` namespace declares, outer scope first. */
export const browserResources: ResourceDefinition[] = [browserResource, pageResource];
