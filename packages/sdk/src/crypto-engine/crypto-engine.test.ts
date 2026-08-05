import { cryptoEngineSuite } from "./crypto-engine.suite.js";
import { createFakeCryptoEngine } from "./fake-engine.js";
import { createWebCryptoEngine } from "./web-crypto-engine.js";

// Both implementations, against the one suite. That is what makes this a port.
cryptoEngineSuite("web crypto engine", createWebCryptoEngine);
cryptoEngineSuite("fake crypto engine", createFakeCryptoEngine);
