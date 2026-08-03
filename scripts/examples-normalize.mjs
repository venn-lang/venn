/**
 * What an example prints, with the parts that change between two runs taken out.
 *
 * Four things move and no more, measured rather than guessed: the directory the
 * run happened in, the duration in a reporter line or in a program's own
 * output, the ephemeral port the operating system handed out, and the path
 * separator, which is the only reason a single expectation file can cover both
 * halves of the CI matrix.
 *
 * A `run` event carries a timestamp and a run id as well, and those are dropped
 * from the event rather than from the text, so the rest of the event is
 * compared as the structure it is.
 */
import { slashed } from "./repo-sources.mjs";

const MOVES = [
  [/\b\d+(\.\d+)?ms\b/g, "<ms>"],
  [/\b(port |localhost:|127\.0\.0\.1:)\d{2,5}\b/g, "$1<port>"],
];

/** The text with the working directory, the durations and the ports taken out. */
function steady(text, root) {
  const written = text.split("\\").join("/").split(slashed(root)).join("<root>");
  return MOVES.reduce((so, [pattern, by]) => so.replace(pattern, by), written);
}

/** What changes between two identical runs and says nothing about either. */
const MOMENT = ["ts", "run"];

/**
 * Every string inside an event, steadied where it sits.
 *
 * Steadying the serialized event instead turns its `\"` into `/"` along with
 * the separators, and the result no longer parses.
 */
function inside(value, root) {
  if (typeof value === "string") return steady(value, root);
  if (Array.isArray(value)) return value.map((one) => inside(one, root));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, one]) => [key, inside(one, root)]));
  return value;
}

/** One event with its timestamp, its run id and its duration dropped. */
function event(line, root) {
  const parsed = JSON.parse(line);
  for (const key of MOMENT) delete parsed[key];
  if (parsed.data && typeof parsed.data === "object") delete parsed.data.durationMs;
  return JSON.stringify(inside(parsed, root));
}

/** Whether a line is one of the runner's events rather than a program's output. */
function isEvent(line) {
  if (!line.startsWith("{")) return false;
  try {
    return typeof JSON.parse(line).kind === "string";
  } catch {
    return false;
  }
}

/**
 * A whole stream, line by line, so an event is normalized as an event and a
 * program's own output as the text it is.
 */
export function normalize(stream, root) {
  return stream
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => (isEvent(line) ? event(line, root) : steady(line, root)))
    .join("\n")
    .trimEnd();
}

/** What the run said it did, read from the event rather than from a reporter. */
export function countsIn(stream) {
  const finished = stream
    .split("\n")
    .filter((line) => isEvent(line))
    .map((line) => JSON.parse(line))
    .findLast((one) => one.kind === "run.finished");
  return finished ? { passed: finished.data.passed, failed: finished.data.failed } : undefined;
}
