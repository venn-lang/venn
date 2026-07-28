#!/usr/bin/env node
import { enableCompileCache } from "node:module";

/**
 * The launcher, deliberately tiny.
 *
 * `enableCompileCache` keeps V8's compilation of the bundle on disk between
 * runs, but only for modules loaded after it is called, so the engine has to
 * arrive through a dynamic import rather than a static one. The URL is computed
 * so the bundler leaves it alone: this file must stay separate from the file it
 * loads, or there is nothing left to cache.
 */
enableCompileCache?.();
await import(new URL("../cli.mjs", import.meta.url).href);
