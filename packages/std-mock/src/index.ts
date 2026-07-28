// The `mock` namespace: named mock services, HTTP interceptors, feature flags
// and a virtual clock, all in-process. State lives in one shared MockState the
// actions read and write; tests reach it through getMockState(). No network,
// no port.

export { mockActions } from "./actions/index.js";
export { mockPlugin, mockPlugin as default } from "./plugin.js";
export * from "./state/index.js";
