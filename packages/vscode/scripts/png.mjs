import { deflateSync } from "node:zlib";

const TABLE = buildTable();

function buildTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) table[i] = entry(i);
  return table;
}

function entry(index) {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** One PNG chunk: length, type, payload, CRC over type+payload. */
function chunk(type, payload) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(payload.length, 0);
  head.write(type, 4, "ascii");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), payload])), 0);
  return Buffer.concat([head, payload, tail]);
}

function header(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data.set([8, 2, 0, 0, 0], 8); // 8-bit, truecolour RGB, no interlace
  return chunk("IHDR", data);
}

/** Scanlines with filter byte 0 — the image is flat colour, so none pays off. */
function scanlines(rgb, width, height) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    rows.push(Buffer.from([0]), rgb.subarray(y * width * 3, (y + 1) * width * 3));
  }
  return Buffer.concat(rows);
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Encode a raw RGB buffer as a PNG. */
export function encodePng({ rgb, width, height }) {
  const idat = deflateSync(scanlines(rgb, width, height), { level: 9 });
  return Buffer.concat([
    SIGNATURE,
    header(width, height),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
