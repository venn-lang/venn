import { ArtifactStorePort, createMemoryArtifactStore } from "@venn-lang/artifacts";
import { AuthClientPort, createFakeAuthClient } from "@venn-lang/auth";
import {
  BrowserDriverPort,
  createFakeBrowserDriver,
  createNonePreviewProvider,
  PreviewProviderPort,
} from "@venn-lang/browser";
import { ConsolePort, createMemoryConsole } from "@venn-lang/contracts";
import { CryptoEnginePort, createWebCryptoEngine } from "@venn-lang/crypto";
import { createFakeDbClient, DbClientPort } from "@venn-lang/db";
import { createFakeClient as createFakeGqlClient, GqlClientPort } from "@venn-lang/graphql";
import { createFakeClient as createFakeGrpcClient, GrpcClientPort } from "@venn-lang/grpc";
import { createMemoryServer, HttpServerPort } from "@venn-lang/http";
import { createFakeLoadRunner, LoadRunnerPort } from "@venn-lang/load";
import { createFakeMailClient, MailClientPort } from "@venn-lang/mail";
import { createFakeMqttClient, MqttClientPort } from "@venn-lang/mqtt";
import { createFakeNotifier, NotifierPort } from "@venn-lang/notify";
import type { PortBinding } from "@venn-lang/runtime";
import { createFakeWsClient, WsClientPort } from "@venn-lang/ws";

/**
 * A fake implementation for every stdlib port.
 *
 * Real third-party integrations are out of scope for this repository, so these
 * stand in for them. Crypto is the exception noted below. `@venn-lang/http`'s client
 * is real too (fetch), but the CLI binds it separately so a test can put a fake
 * in its place.
 */
export const stdlibPortBindings: PortBinding[] = [
  { port: AuthClientPort, impl: createFakeAuthClient() },
  { port: HttpServerPort, impl: createMemoryServer() },
  // Crypto is pure computation, not a side effect, so the real engine always.
  { port: CryptoEnginePort, impl: createWebCryptoEngine() },
  { port: NotifierPort, impl: createFakeNotifier() },
  { port: WsClientPort, impl: createFakeWsClient({ incoming: [] }) },
  { port: MqttClientPort, impl: createFakeMqttClient() },
  { port: GqlClientPort, impl: createFakeGqlClient() },
  { port: GrpcClientPort, impl: createFakeGrpcClient() },
  { port: MailClientPort, impl: createFakeMailClient() },
  { port: DbClientPort, impl: createFakeDbClient() },
  { port: BrowserDriverPort, impl: createFakeBrowserDriver() },
  { port: PreviewProviderPort, impl: createNonePreviewProvider() },
  { port: LoadRunnerPort, impl: createFakeLoadRunner() },
  { port: ArtifactStorePort, impl: createMemoryArtifactStore() },
  // A recording console, so a run without the CLI still has somewhere to write.
  // The CLI binds the real streams over this one.
  { port: ConsolePort, impl: createMemoryConsole() },
];
