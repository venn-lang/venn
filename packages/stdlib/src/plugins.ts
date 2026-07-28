import { artifactsPlugin } from "@venn/artifacts";
import { assertPlugin } from "@venn/assert";
import { authPlugin } from "@venn/auth";
import { browserPlugin } from "@venn/browser";
import { cryptoPlugin } from "@venn/crypto";
import { dataPlugin } from "@venn/data";
import { dbPlugin } from "@venn/db";
import { envPlugin } from "@venn/env";
import { fmtPlugin } from "@venn/fmt";
import { gqlPlugin } from "@venn/graphql";
import { grpcPlugin } from "@venn/grpc";
import { httpPlugin } from "@venn/http";
import { ioPlugin } from "@venn/io";
import { loadPlugin } from "@venn/load";
import { mailPlugin } from "@venn/mail";
import { mockPlugin } from "@venn/mock";
import { mqttPlugin } from "@venn/mqtt";
import { notifyPlugin } from "@venn/notify";
import type { PluginDefinition } from "@venn/sdk";
import { wsPlugin } from "@venn/ws";

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
