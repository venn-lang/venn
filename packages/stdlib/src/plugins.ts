import { artifactsPlugin } from "@venn-lang/artifacts";
import { assertPlugin } from "@venn-lang/assert";
import { authPlugin } from "@venn-lang/auth";
import { browserPlugin } from "@venn-lang/browser";
import { cryptoPlugin } from "@venn-lang/crypto";
import { dataPlugin } from "@venn-lang/data";
import { dbPlugin } from "@venn-lang/db";
import { envPlugin } from "@venn-lang/env";
import { fmtPlugin } from "@venn-lang/fmt";
import { gqlPlugin } from "@venn-lang/graphql";
import { grpcPlugin } from "@venn-lang/grpc";
import { httpPlugin } from "@venn-lang/http";
import { ioPlugin } from "@venn-lang/io";
import { loadPlugin } from "@venn-lang/load";
import { mailPlugin } from "@venn-lang/mail";
import { mockPlugin } from "@venn-lang/mock";
import { mqttPlugin } from "@venn-lang/mqtt";
import { notifyPlugin } from "@venn-lang/notify";
import type { PluginDefinition } from "@venn-lang/sdk";
import { wsPlugin } from "@venn-lang/ws";

/**
 * Every plugin the tooling loads, as one list.
 *
 * The CLI runs them; the language server reads their actions and matchers for
 * completion, hover and highlighting. One list, so the two never disagree about
 * what the stdlib is.
 */
export const allPlugins: PluginDefinition[] = [
  httpPlugin,
  assertPlugin,
  dataPlugin,
  cryptoPlugin,
  envPlugin,
  fmtPlugin,
  ioPlugin,
  mockPlugin,
  authPlugin,
  notifyPlugin,
  wsPlugin,
  mqttPlugin,
  gqlPlugin,
  grpcPlugin,
  mailPlugin,
  dbPlugin,
  browserPlugin,
  loadPlugin,
  artifactsPlugin,
];
