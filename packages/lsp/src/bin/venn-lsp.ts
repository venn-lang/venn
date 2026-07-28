#!/usr/bin/env node
import { type Connection, createConnection, ProposedFeatures } from "vscode-languageserver/node";
import { startVennServer } from "../server/index.js";

const TRANSPORT_FLAGS = ["--stdio", "--node-ipc", "--socket"];

// Editors pass a transport flag; with none given, default to stdio so the server
// is usable straight from a shell.
function connect(): Connection {
  const flagged = process.argv.some((arg) => TRANSPORT_FLAGS.some((flag) => arg.startsWith(flag)));
  const connection = flagged
    ? createConnection(ProposedFeatures.all)
    : createConnection(ProposedFeatures.all, process.stdin, process.stdout);
  return connection as Connection;
}

startVennServer(connect());
