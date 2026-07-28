import { type Method, nativeFn } from "../native.types.js";

type Dict = Record<string, unknown>;

/**
 * Methods on a map value. Checked only after a data property of the same name,
 * so a map with a key called `keys` still reads that key.
 */
export const MAP_METHODS: Record<string, Method> = {
  keys: (map: Dict) => Object.keys(map),
  values: (map: Dict) => Object.values(map),
  entries: (map: Dict) => Object.entries(map).map(([key, value]) => [key, value]),
  has: (map: Dict) => nativeFn((args) => String(args[0]) in map),
  get: (map: Dict) => nativeFn((args) => map[String(args[0])] ?? null),
  len: (map: Dict) => Object.keys(map).length,
  merge: (map: Dict) => nativeFn((args) => ({ ...map, ...(args[0] as Dict) })),
};
