const UUID_V7_RANDOM_MASK = (1n << 74n) - 1n;

function randomBytes(size: number): Uint8Array {
  const out = new Uint8Array(size);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < out.length; i++) {out[i] = Math.floor(Math.random() * 256);}
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {out += b.toString(16).padStart(2, "0");}
  return out;
}

let lastMs = -1;
let lastRandom74 = 0n;

/**
 * UUIDv7 (RFC 9562): lexicographically sortable by time (ms).
 *
 * This implementation is monotonic within the same millisecond so repeated calls
 * produce increasing IDs even when `Date.now()` doesn't advance.
 */
export function uuidv7(nowMs: number = Date.now()): string {
  const ms = Math.max(0, Math.floor(nowMs));

  let rand74: bigint;
  if (ms === lastMs) {
    rand74 = (lastRandom74 + 1n) & UUID_V7_RANDOM_MASK;
  } else {
    const r = randomBytes(10); // 80 bits
    let v = 0n;
    for (const b of r) {v = (v << 8n) | BigInt(b);}
    rand74 = v & UUID_V7_RANDOM_MASK; // keep low 74 bits
  }

  lastMs = ms;
  lastRandom74 = rand74;

  // Split random bits into rand_a (12) and rand_b (62).
  const randA = Number((rand74 >> 62n) & 0xfffn);
  const randB = rand74 & ((1n << 62n) - 1n);

  const bytes = new Uint8Array(16);

  // 48-bit big-endian unix_ts_ms.
  const msBig = BigInt(ms);
  for (let i = 0; i < 6; i++) {
    const shift = BigInt((5 - i) * 8);
    bytes[i] = Number((msBig >> shift) & 0xffn);
  }

  // version (7) + rand_a (12).
  bytes[6] = 0x70 | ((randA >>> 8) & 0x0f);
  bytes[7] = randA & 0xff;

  // variant (10) + top 6 bits of rand_b.
  const randBTop6 = Number((randB >> 56n) & 0x3fn);
  bytes[8] = 0x80 | randBTop6;

  // remaining 56 bits of rand_b.
  const randBRest = randB & ((1n << 56n) - 1n);
  for (let i = 0; i < 7; i++) {
    const shift = BigInt((6 - i) * 8);
    bytes[9 + i] = Number((randBRest >> shift) & 0xffn);
  }

  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
