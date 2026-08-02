/**
 * The `VNxxxx` codes a plugin raises, shared by every one of them.
 *
 * A plugin does not invent a family. It uses the one that matches the kind of
 * failure, which is what makes a code googlable across the whole language
 * rather than per package: `VN7xxx` is an action or a protocol failing, and
 * `VN8xxx` is a resource or a timeout.
 *
 * The two below are shared because eleven plugins raise them for the same
 * reason: a real implementation that is not built here, and a double that was
 * asked for something it was never given.
 */
export const PLUGIN_CODES = {
  /** A real client this repository does not build. The language ships the double. */
  VN8090_NOT_BUILT: "VN8090",
  /** A double asked for something nobody put in it. */
  VN8091_NOTHING_RECORDED: "VN8091",
  /** A token or a payload this plugin could not read. */
  VN7003_UNREADABLE: "VN7003",
  /** An argument a verb refuses: a name that is not one, a range that is not one. */
  VN7005_BAD_ARGUMENT: "VN7005",
  /** A port a server could not take, because something else has it. */
  VN7020_PORT_TAKEN: "VN7020",
  /** A socket that refused to bind, for a reason of the machine's. */
  VN7021_CANNOT_BIND: "VN7021",
  /** Nothing was listening at the address. */
  VN7022_CONNECTION_REFUSED: "VN7022",
  /** The name did not resolve. */
  VN7023_HOST_NOT_FOUND: "VN7023",
  /** The request was made and no answer came in time. */
  VN7024_REQUEST_TIMED_OUT: "VN7024",
  /** A verb that needs something chosen first, and nothing was. */
  VN7090_NOTHING_CHOSEN: "VN7090",
} as const;
