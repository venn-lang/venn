import type { Type } from "./type.types.js";
import { prune } from "./unify.js";

/** What a built-in member does, and how it reads. */
export interface MemberDoc {
  doc: string;
  example?: string;
}

const LIST: Record<string, MemberDoc> = {
  len: { doc: "How many items it holds.", example: "[1, 2, 3].len  # 3" },
  first: { doc: "The first item, or null when empty." },
  last: { doc: "The last item, or null when empty." },
  isEmpty: { doc: "True when there is nothing in it." },
  map: {
    doc: "A new list, each item passed through the function.",
    example: "[1, 2].map(fn (x) => x * 2)  # [2, 4]",
  },
  filter: { doc: "Only the items the function keeps.", example: "xs.filter(fn (x) => x > 2)" },
  reduce: {
    doc: "Fold the list into one value, from a starting one.",
    example: "xs.reduce(fn (total, x) => total + x, 0)",
  },
  forEach: { doc: "Run the function once per item, for its effect." },
  find: { doc: "The first item the function accepts, or null." },
  some: { doc: "True when the function accepts any item." },
  every: { doc: "True when the function accepts all of them." },
  contains: { doc: "True when the item is in the list." },
  indexOf: { doc: "Where the item sits, or -1." },
  join: { doc: "The items as one string, separated.", example: "['a', 'b'].join('-')  # \"a-b\"" },
  reverse: { doc: "The same items, back to front." },
  flatten: { doc: "One level of nesting removed." },
  sort: { doc: "Sorted by a comparator. For a key, `sortBy` reads better." },
  slice: { doc: "The items between two positions." },
  concat: { doc: "This list followed by another." },
  push: { doc: "A new list with the item appended, the original is untouched." },
  sum: { doc: "The numbers added up." },
  average: { doc: "The mean of the numbers, or 0 when empty." },
  min: { doc: "The smallest number." },
  max: { doc: "The largest number." },
  toMap: { doc: "Entry pairs turned into a map.", example: "[['a', 1]].toMap  # { a: 1 }" },
  take: { doc: "The first n items." },
  drop: { doc: "Everything after the first n." },
  takeLast: { doc: "The last n items." },
  dropLast: { doc: "Everything but the last n." },
  takeWhile: { doc: "Items from the start, while the function accepts them." },
  dropWhile: { doc: "Skip the accepted run, keep the rest." },
  distinct: { doc: "Duplicates removed, first occurrence kept." },
  distinctBy: { doc: "Duplicates removed by a derived key." },
  sortBy: { doc: "Sorted by a derived key.", example: "people.sortBy(fn (p) => p.age)" },
  minBy: { doc: "The item with the smallest score." },
  maxBy: { doc: "The item with the largest score.", example: "people.maxBy(fn (p) => p.age)" },
  sumBy: { doc: "The scores added up." },
  flatMap: { doc: "Map, then flatten one level." },
  groupBy: {
    doc: "A map from key to the items sharing it.",
    example: "people.groupBy(fn (p) => p.team)",
  },
  countBy: { doc: "A map from key to how many items share it." },
  keyBy: { doc: "A map from key to item, an index, last one wins." },
  partition: { doc: "Two lists: what the function kept, and what it rejected." },
  chunk: { doc: "Split into runs of n.", example: "[1,2,3,4,5].chunk(2)  # [[1,2],[3,4],[5]]" },
  windows: { doc: "Every consecutive run of n.", example: "[1,2,3].windows(2)  # [[1,2],[2,3]]" },
  pairwise: { doc: "Every consecutive pair." },
  zip: { doc: "Paired with another list, item by item." },
  unzip: { doc: "Pairs pulled apart into separate lists." },
};

const STRING: Record<string, MemberDoc> = {
  len: { doc: "How many characters it holds." },
  upper: { doc: "In upper case." },
  lower: { doc: "In lower case." },
  trim: { doc: "Without leading or trailing blanks." },
  trimStart: { doc: "Without leading blanks." },
  trimEnd: { doc: "Without trailing blanks." },
  reverse: { doc: "The characters back to front." },
  toNumber: { doc: "Read as a number." },
  isEmpty: { doc: "True when it has no characters." },
  isBlank: { doc: "True when it is empty or only blanks." },
  split: { doc: "Cut into a list on a separator.", example: "'a,b'.split(',')  # ['a', 'b']" },
  replace: { doc: "Every occurrence swapped for another." },
  contains: { doc: "True when the text appears inside." },
  startsWith: { doc: "True when it begins with the text." },
  endsWith: { doc: "True when it ends with the text." },
  slice: { doc: "The characters between two positions." },
  repeat: { doc: "Itself, n times over." },
  padStart: { doc: "Padded on the left to a width." },
  padEnd: { doc: "Padded on the right to a width." },
  indexOf: { doc: "Where the text starts, or -1." },
  words: { doc: "Split on whitespace.", example: "'a b  c'.words  # ['a', 'b', 'c']" },
  lines: { doc: "Split on newlines." },
  chars: { doc: "Each character as its own string." },
  capitalize: { doc: "First letter upper-cased." },
  title: { doc: "Every word capitalised." },
  slugify: {
    doc: "URL-safe: accents stripped, spaces to dashes.",
    example: "'João Silva'.slugify  # \"joao-silva\"",
  },
  count: { doc: "How many times the text appears." },
  matches: {
    doc: "Every match of a pattern, as a list.",
    example: "'a1b22'.matches('[0-9]+')  # ['1', '22']",
  },
  test: { doc: "True when the pattern matches anywhere." },
  before: { doc: "What comes before the marker." },
  after: { doc: "What comes after the marker." },
  ensureStart: { doc: "The prefix added, unless it is already there." },
  ensureEnd: { doc: "The suffix added, unless it is already there." },
};

const MAP: Record<string, MemberDoc> = {
  len: { doc: "How many entries it holds." },
  keys: { doc: "Its keys, as a list." },
  values: { doc: "Its values, as a list." },
  entries: { doc: "Its `[key, value]` pairs." },
  has: { doc: "True when the key is present." },
  get: { doc: "The value under a key, or null." },
  merge: { doc: "This map with another laid over it." },
  mergeDeep: {
    doc: "Merged recursively, keeping untouched branches.",
    example: "cfg.mergeDeep({ server: { port: 90 } })",
  },
  mapValues: { doc: "Same keys, each value passed through the function." },
  mapKeys: { doc: "Same values, each key passed through the function." },
  filterValues: { doc: "Only the entries whose value the function keeps." },
  pick: { doc: "Only the named keys.", example: "cfg.pick('host', 'port')" },
  omit: { doc: "Everything but the named keys." },
  invert: { doc: "Keys and values swapped." },
  isEmpty: { doc: "True when it has no entries." },
  getPath: {
    doc: "Reach into nested data by a dotted path.",
    example: "cfg.getPath('server.port')",
  },
  hasPath: { doc: "True when the dotted path leads somewhere." },
};

const NUMBER: Record<string, MemberDoc> = {
  abs: { doc: "Its distance from zero." },
  floor: { doc: "Rounded down to a whole number." },
  ceil: { doc: "Rounded up to a whole number." },
  sign: { doc: "-1, 0 or 1." },
  sqrt: { doc: "Its square root." },
  isEven: { doc: "True when it divides by two." },
  isOdd: { doc: "True when it does not." },
  round: { doc: "Rounded to n decimal places.", example: "(3.14159).round(2)  # 3.14" },
  toFixed: { doc: "As text with exactly n decimals." },
  clamp: { doc: "Held between a low and a high bound.", example: "(99).clamp(0, 10)  # 10" },
  pow: { doc: "Raised to a power." },
  times: { doc: "A list counting from 0 up to it.", example: "(3).times  # [0, 1, 2]" },
  toString: { doc: "As text." },
  toMs: { doc: "Read as a duration in milliseconds.", example: "1500.toMs  # 1.5s" },
  toSeconds: { doc: "Read as a duration in seconds." },
  toMinutes: { doc: "Read as a duration in minutes." },
  toHours: { doc: "Read as a duration in hours." },
  toBytes: { doc: "Read as a size in bytes." },
  toKb: { doc: "Read as a size in kilobytes.", example: "2048.toKb  # 2mb" },
  toMb: { doc: "Read as a size in megabytes." },
  toGb: { doc: "Read as a size in gigabytes." },
  toRatio: { doc: "Read as a percent, from a fraction of one.", example: "0.5.toRatio  # 50%" },
  toPercent: { doc: "Read as a percent, from a number out of a hundred." },
};

const DURATION: Record<string, MemberDoc> = {
  ms: { doc: "As a plain number of milliseconds.", example: "1.5s.ms  # 1500" },
  seconds: { doc: "As a plain number of seconds." },
  minutes: { doc: "As a plain number of minutes.", example: "90s.minutes  # 1.5" },
  hours: { doc: "As a plain number of hours." },
};

const SIZE: Record<string, MemberDoc> = {
  bytes: { doc: "As a plain number of bytes." },
  kb: { doc: "As a plain number of kilobytes.", example: "2mb.kb  # 2048" },
  mb: { doc: "As a plain number of megabytes." },
  gb: { doc: "As a plain number of gigabytes." },
};

const PERCENT: Record<string, MemberDoc> = {
  ratio: { doc: "As a fraction of one.", example: "50%.ratio  # 0.5" },
  percent: { doc: "As a number out of a hundred.", example: "0.5.round(2)" },
  of: { doc: "That share of a number.", example: "12%.of(50)  # 6" },
};

const TASK: Record<string, MemberDoc> = {
  wait: { doc: "The value, once the work has finished.", example: "let page = job.wait" },
  done: { doc: "True once it has finished, either way." },
  failed: { doc: "True when it finished by failing." },
  settle: { doc: "Wait without the failure spreading, the value, or nothing." },
};

/**
 * What a moment answers about itself, read in UTC.
 *
 * Absent until now, so `date.now().` offered nothing in the editor while the
 * runtime and the checker both knew all sixteen.
 */
const INSTANT: Record<string, MemberDoc> = {
  iso: { doc: "The whole moment as ISO text.", example: "t.iso  # 2026-07-27T12:00:00.000Z" },
  epochMs: { doc: "Milliseconds since the epoch, as a plain number." },
  year: { doc: "The year, in UTC." },
  month: { doc: "The month, 1 to 12, in UTC." },
  day: { doc: "The day of the month, in UTC." },
  hour: { doc: "The hour, 0 to 23, in UTC." },
  minute: { doc: "The minute, 0 to 59, in UTC." },
  second: { doc: "The second, 0 to 59, in UTC." },
  weekday: { doc: "The day of the week, 1 for Monday through 7 for Sunday." },
  date: { doc: "The day on its own, which is what a report groups by.", example: "t.date" },
  time: { doc: "The time of day on its own, without the date." },
  plus: { doc: "That much later.", example: "t.plus(2h)" },
  minus: { doc: "That much earlier." },
  until: { doc: "How long from here to there.", example: "start.until(end).seconds" },
  isBefore: { doc: "True when this moment comes first." },
  isAfter: { doc: "True when this moment comes second." },
};

const REGEX: Record<string, MemberDoc> = {
  source: { doc: "The pattern as it was written." },
  flags: { doc: "The flags it was compiled with, as text." },
  test: { doc: "True when the text matches. `~=` is the operator for it." },
  match: {
    doc: "The whole match first, then each group. Empty when it did not match.",
    example: "order.match(body)[1]",
  },
};

/** Documentation for every built-in member, by the kind of value it hangs off. */
export const MEMBER_DOCS: Readonly<Record<string, Record<string, MemberDoc>>> = {
  list: LIST,
  string: STRING,
  map: MAP,
  number: NUMBER,
  duration: DURATION,
  size: SIZE,
  percent: PERCENT,
  instant: INSTANT,
  regex: REGEX,
  task: TASK,
};

/**
 * The named kinds, which are exactly the keys of {@link MEMBER_DOCS} that a
 * type carries a name for. A list and a record are told by their shape instead.
 *
 * `instant` and `regex` were missing, so `date.now().` and a pattern offered
 * nothing at all in the editor although both tables were sitting right here.
 */
const KINDS = new Set([
  "string",
  "number",
  "duration",
  "size",
  "percent",
  "instant",
  "regex",
  "task",
]);

/** Which table of members a type answers to, if any. */
export function memberKind(type: Type): string | undefined {
  const t = prune(type);
  if (t.kind === "list") return "list";
  if (t.kind === "record") return "map";
  // A pattern and a task are opaque rather than primitive: what each publishes
  // is settled, which is the same thing their names say here.
  if (t.kind !== "prim" && t.kind !== "opaque") return undefined;
  return KINDS.has(t.name) ? t.name : undefined;
}
