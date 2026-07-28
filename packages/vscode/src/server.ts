import { startVennServer } from "@venn-lang/lsp";
import { createConnection, ProposedFeatures } from "vscode-languageserver/node";

// VS Code spawns this with `--node-ipc`, so the transport comes from the flags.
startVennServer(createConnection(ProposedFeatures.all));
