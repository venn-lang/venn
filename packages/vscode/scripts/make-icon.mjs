import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodePng } from "./png.mjs";

/**
 * The Venn mark, rendered as the extension's icon.
 *
 * The same construction as the identity: two circles of equal radius whose
 * centres sit slightly more than one radius apart, drawn at partial opacity so
 * the lens where they meet is not a third shape someone had to draw — it is
 * what overlap does on its own. That is the whole argument of the name, and it
 * has to survive being 32 pixels wide in a sidebar, which is why nothing else
 * is in the frame.
 */
const SIZE = 256;
const SAMPLES = 4; // supersampling, for edges that hold up when scaled down

// Ground is the accent itself, not a neutral: in the extensions list nearly
// every icon sits on dark chrome, so a solid field is what gets seen at 32px.
const GROUND = [0x14, 0x61, 0x8f]; // --accent, light
const MARK = [0xf7, 0xf9, 0xfb]; // --panel, light
const ALPHA = 0.42;

/** Radius and centres, from the identity's proportions: gap = 1.0588 × r. */
function geometry() {
  const radius = (SIZE * 0.78) / 3.0588;
  const gap = radius * 1.0588;
  return { radius, left: SIZE / 2 - gap / 2, right: SIZE / 2 + gap / 2, mid: SIZE / 2 };
}

const { radius, left, right, mid } = geometry();

function covers(cx, x, y) {
  const dx = x - cx;
  const dy = y - mid;
  return dx * dx + dy * dy <= radius * radius;
}

/** How many of the two discs cover this sample point: 0, 1 or 2. */
function depthAt(x, y) {
  return (covers(left, x, y) ? 1 : 0) + (covers(right, x, y) ? 1 : 0);
}

/** Averaged coverage depth over the sub-pixel grid. */
function sample(px, py) {
  let total = 0;
  for (let sy = 0; sy < SAMPLES; sy++) {
    for (let sx = 0; sx < SAMPLES; sx++) {
      total += depthAt(px + (sx + 0.5) / SAMPLES, py + (sy + 0.5) / SAMPLES);
    }
  }
  return total / (SAMPLES * SAMPLES);
}

/** Painting the mark twice at ALPHA is what makes the lens a third value. */
function blend(depth, channel) {
  const opacity = 1 - (1 - ALPHA) ** depth;
  return Math.round(GROUND[channel] * (1 - opacity) + MARK[channel] * opacity);
}

function render() {
  const rgb = Buffer.alloc(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) writePixel(rgb, x, y, sample(x, y));
  }
  return rgb;
}

function writePixel(rgb, x, y, depth) {
  const at = (y * SIZE + x) * 3;
  for (let channel = 0; channel < 3; channel++) rgb[at + channel] = blend(depth, channel);
}

const out = resolve(import.meta.dirname, "../icon.png");
writeFileSync(out, encodePng({ rgb: render(), width: SIZE, height: SIZE }));
process.stdout.write(`${out}\n`);
