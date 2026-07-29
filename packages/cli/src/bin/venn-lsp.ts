#!/usr/bin/env node
// The language server, beside the language it speaks for.
//
// A version of Venn offers both from one directory: the orchestrator installs
// one thing per version, and an editor asking for the server has to find it
// where the commands are. Built here rather than depended on at runtime, since
// the tarball is unpacked on its own with no install step to fetch anything
// else it might have wanted.
import { startVennServer } from "@venn-lang/lsp";
import { type Connection, createConnection, ProposedFeatures } from "vscode-languageserver/node";

/** Editors pass a transport flag; with none, stdio, so a shell can use it. */
const TRANSPORT_FLAGS = ["--stdio", "--node-ipc", "--socket"];

function connect(): Connection {
  const flagged = process.argv.some((arg) => TRANSPORT_FLAGS.some((flag) => arg.startsWith(flag)));
  const connection = flagged
    ? createConnection(ProposedFeatures.all)
    : createConnection(ProposedFeatures.all, process.stdin, process.stdout);
  return connection as Connection;
}

startVennServer(connect());
