/**
 * Every `VNxxxx` this package raises.
 *
 * Declared rather than written where it is thrown, so the list of codes the
 * host and its ports can produce is one place a reader can look, and so a code
 * cannot appear in a message without appearing here.
 */
export const HOST_CODES = {
  VN2010_MISSING_CAPABILITY: "VN2010",
  VN2011_PORT_SHAPE: "VN2011",
  VN2012_CAPABILITY_UNAVAILABLE: "VN2012",
  VN8010_NOT_FOUND: "VN8010",
  VN8019_FILE_SYSTEM: "VN8019",
} as const;
