import { join } from "node:path";
import type { ExtensionContext } from "vscode";
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

/** Spawn the bundled language server and wire it to every `.vn` document. */
export function activate(context: ExtensionContext): void {
  const module = context.asAbsolutePath(join("dist", "server.cjs"));
  const serverOptions: ServerOptions = {
    run: { module, transport: TransportKind.ipc },
    debug: {
      module,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
    },
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "venn" }],
  };
  client = new LanguageClient("venn", "Venn", serverOptions, clientOptions);
  void client.start();
}

export function deactivate(): Promise<void> | undefined {
  return client?.stop();
}
