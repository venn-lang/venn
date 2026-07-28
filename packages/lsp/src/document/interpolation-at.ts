import {
  type AstNode,
  type InterpolationSlot,
  isStringLit,
  scanInterpolations,
} from "@venn-lang/core";
import { CstUtils, type LangiumDocument } from "langium";

/** A dotted path of identifiers, e.g. `env.KEYCLOAK_URL`. */
const PATH = /[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/g;

/** What the cursor is pointing at inside a `${…}` placeholder. */
export interface InterpolationHit {
  /** The string literal holding the placeholder: the anchor for scope lookup. */
  host: AstNode;
  /** The whole dotted path under the cursor. */
  path: string;
  /** Just the segment under the cursor. */
  name: string;
  /** True on the first segment, the only one a scope can bind. */
  isHead: boolean;
  /** Which dotted segment the cursor is on: 0 is the head. */
  segment: number;
  /** Absolute offset and length of {@link name}, for ranges the editor needs. */
  offset: number;
  length: number;
  /** Which `${…}` of the string this is: the index inference recorded it under. */
  slot: number;
  /** Where the cursor sits inside that placeholder's source. */
  inner: number;
}

/**
 * Resolve an offset that falls inside an interpolated string. Without this the
 * editor treats `"${base}/users"` as prose: no hover, no jump, no rename.
 */
export function interpolationAt(args: {
  document: LangiumDocument;
  offset: number;
}): InterpolationHit | undefined {
  const found = slotAt(args);
  if (!found) return undefined;
  const { host, slot, index, inner } = found;
  const hit = hitIn({ host, slot, at: inner, base: found.base });
  return hit && { ...hit, slot: index, inner };
}

/** Which `${…}` the offset falls in, whether or not a name sits under it. */
export interface SlotHit {
  host: AstNode;
  slot: InterpolationSlot;
  /** The placeholder's position among the string's, as inference recorded it. */
  index: number;
  /** Where the cursor sits inside the placeholder's source. */
  inner: number;
  /** Absolute offset of the placeholder's source, for ranges the editor needs. */
  base: number;
}

/**
 * Locate the placeholder alone. Completion asks this after a dot, where there
 * is no name yet and {@link interpolationAt} would find nothing to describe.
 */
export function slotAt(args: { document: LangiumDocument; offset: number }): SlotHit | undefined {
  const host = stringAt(args);
  const cst = host?.$cstNode;
  if (!host || !cst) return undefined;
  const local = args.offset - cst.offset;
  const slots = scanInterpolations(cst.text);
  const index = slots.findIndex((each) => inside(each, local));
  const slot = slots[index];
  if (!slot) return undefined;
  return {
    host,
    slot,
    index,
    inner: local - slot.sourceStart,
    base: cst.offset + slot.sourceStart,
  };
}

/** A hit before the placeholder it came from is known. */
type Located = Omit<InterpolationHit, "slot" | "inner">;

function inside(slot: InterpolationSlot, offset: number): boolean {
  return offset > slot.start && offset < slot.end;
}

function stringAt(args: { document: LangiumDocument; offset: number }): AstNode | undefined {
  const root = args.document.parseResult?.value?.$cstNode;
  const leaf = root && CstUtils.findLeafNodeAtOffset(root, args.offset);
  const node = leaf?.astNode;
  return node && isStringLit(node) ? node : undefined;
}

function hitIn(args: {
  host: AstNode;
  slot: InterpolationSlot;
  at: number;
  base: number;
}): Located | undefined {
  for (const match of args.slot.source.matchAll(PATH)) {
    const start = match.index;
    if (args.at < start || args.at > start + match[0].length) continue;
    return segmentAt({
      host: args.host,
      path: match[0],
      base: args.base + start,
      at: args.at - start,
    });
  }
  return undefined;
}

/** Which dotted segment the cursor landed on, and where it sits in the document. */
function segmentAt(args: { host: AstNode; path: string; base: number; at: number }): Located {
  const parts = args.path.split(".");
  let cursor = 0;
  let index = 0;
  while (index < parts.length - 1 && args.at > cursor + (parts[index]?.length ?? 0)) {
    cursor += (parts[index]?.length ?? 0) + 1;
    index += 1;
  }
  const name = parts[index] ?? args.path;
  return {
    host: args.host,
    path: args.path,
    name,
    isHead: index === 0,
    segment: index,
    offset: args.base + cursor,
    length: name.length,
  };
}
