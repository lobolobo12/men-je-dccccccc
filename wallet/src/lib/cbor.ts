// Minimal CBOR (RFC 8949) codec covering what ISO/IEC 18013-5 mdocs and COSE use:
// integers, byte/text strings, arrays, maps (string or integer keys), tags, simple values, floats.

export class Tagged {
  constructor(
    public readonly tag: number,
    public readonly value: unknown,
  ) {}
}

/** Tag 24: a CBOR data item embedded as a byte string. Keeps the original bytes for hashing. */
export class EmbeddedCbor {
  constructor(public readonly bytes: Uint8Array) {}
  decode(): unknown {
    return decodeCbor(this.bytes);
  }
  static of(value: unknown): EmbeddedCbor {
    return new EmbeddedCbor(encodeCbor(value));
  }
}

export type CborMap = Map<unknown, unknown>;

// ---- decoding ----

export function decodeCbor(bytes: Uint8Array): unknown {
  const r = new Reader(bytes);
  const value = r.item();
  if (r.pos !== bytes.length) throw new Error('Trailing bytes after CBOR item');
  return value;
}

class Reader {
  pos = 0;
  private view: DataView;
  constructor(private bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  private need(n: number) {
    if (this.pos + n > this.bytes.length) throw new Error('Truncated CBOR');
  }

  private arg(info: number): number {
    if (info < 24) return info;
    if (info === 24) {
      this.need(1);
      return this.bytes[this.pos++];
    }
    if (info === 25) {
      this.need(2);
      const v = this.view.getUint16(this.pos);
      this.pos += 2;
      return v;
    }
    if (info === 26) {
      this.need(4);
      const v = this.view.getUint32(this.pos);
      this.pos += 4;
      return v;
    }
    if (info === 27) {
      this.need(8);
      const v = this.view.getBigUint64(this.pos);
      this.pos += 8;
      if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('CBOR integer too large');
      return Number(v);
    }
    throw new Error('Indefinite-length CBOR is not supported');
  }

  item(): unknown {
    this.need(1);
    const ib = this.bytes[this.pos++];
    const major = ib >> 5;
    const info = ib & 31;
    switch (major) {
      case 0:
        return this.arg(info);
      case 1:
        return -1 - this.arg(info);
      case 2: {
        const n = this.arg(info);
        this.need(n);
        const out = this.bytes.slice(this.pos, this.pos + n);
        this.pos += n;
        return out;
      }
      case 3: {
        const n = this.arg(info);
        this.need(n);
        const out = new TextDecoder().decode(this.bytes.subarray(this.pos, this.pos + n));
        this.pos += n;
        return out;
      }
      case 4: {
        const n = this.arg(info);
        const out: unknown[] = [];
        for (let i = 0; i < n; i++) out.push(this.item());
        return out;
      }
      case 5: {
        const n = this.arg(info);
        const out: CborMap = new Map();
        for (let i = 0; i < n; i++) {
          const k = this.item();
          out.set(k, this.item());
        }
        return out;
      }
      case 6: {
        const tag = this.arg(info);
        const value = this.item();
        if (tag === 24 && value instanceof Uint8Array) return new EmbeddedCbor(value);
        return new Tagged(tag, value);
      }
      default: {
        if (info === 20) return false;
        if (info === 21) return true;
        if (info === 22) return null;
        if (info === 23) return undefined;
        if (info === 25) {
          this.need(2);
          const h = this.view.getUint16(this.pos);
          this.pos += 2;
          return halfToFloat(h);
        }
        if (info === 26) {
          this.need(4);
          const v = this.view.getFloat32(this.pos);
          this.pos += 4;
          return v;
        }
        if (info === 27) {
          this.need(8);
          const v = this.view.getFloat64(this.pos);
          this.pos += 8;
          return v;
        }
        throw new Error(`Unsupported CBOR simple value ${info}`);
      }
    }
  }
}

function halfToFloat(h: number): number {
  const s = h & 0x8000 ? -1 : 1;
  const e = (h >> 10) & 0x1f;
  const f = h & 0x3ff;
  if (e === 0) return s * 2 ** -14 * (f / 1024);
  if (e === 31) return f ? NaN : s * Infinity;
  return s * 2 ** (e - 15) * (1 + f / 1024);
}

// ---- encoding (deterministic: shortest argument encoding, definite lengths) ----

export function encodeCbor(value: unknown): Uint8Array {
  const out: number[] = [];
  write(out, value);
  return Uint8Array.from(out);
}

function head(out: number[], major: number, n: number) {
  const m = major << 5;
  if (n < 24) out.push(m | n);
  else if (n < 0x100) out.push(m | 24, n);
  else if (n < 0x10000) out.push(m | 25, n >> 8, n & 255);
  else if (n < 0x100000000) out.push(m | 26, (n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255);
  else {
    const big = BigInt(n);
    out.push(m | 27);
    for (let i = 7; i >= 0; i--) out.push(Number((big >> BigInt(i * 8)) & 255n));
  }
}

function write(out: number[], v: unknown) {
  if (v === null) return void out.push(0xf6);
  if (v === undefined) return void out.push(0xf7);
  if (v === false) return void out.push(0xf4);
  if (v === true) return void out.push(0xf5);
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return v >= 0 ? head(out, 0, v) : head(out, 1, -1 - v);
    const buf = new DataView(new ArrayBuffer(8));
    buf.setFloat64(0, v);
    out.push(0xfb);
    for (let i = 0; i < 8; i++) out.push(buf.getUint8(i));
    return;
  }
  if (typeof v === 'string') {
    const b = new TextEncoder().encode(v);
    head(out, 3, b.length);
    for (const x of b) out.push(x);
    return;
  }
  if (v instanceof Uint8Array) {
    head(out, 2, v.length);
    for (const x of v) out.push(x);
    return;
  }
  if (v instanceof EmbeddedCbor) {
    head(out, 6, 24);
    return write(out, v.bytes);
  }
  if (v instanceof Tagged) {
    head(out, 6, v.tag);
    return write(out, v.value);
  }
  if (Array.isArray(v)) {
    head(out, 4, v.length);
    for (const x of v) write(out, x);
    return;
  }
  const entries = v instanceof Map ? [...v.entries()] : Object.entries(v as Record<string, unknown>);
  head(out, 5, entries.length);
  for (const [k, x] of entries) {
    write(out, k);
    write(out, x);
  }
}

/** Reads a map entry whether the decoded value is a Map or a plain object. */
export function get(map: unknown, key: string | number): unknown {
  if (map instanceof Map) return map.get(key);
  if (map && typeof map === 'object') return (map as Record<string, unknown>)[String(key)];
  return undefined;
}

/** Converts decoded CBOR into JSON-friendly values for display. */
export function toPlain(v: unknown): unknown {
  if (v instanceof Map) {
    const o: Record<string, unknown> = {};
    for (const [k, x] of v) o[String(k)] = toPlain(x);
    return o;
  }
  if (Array.isArray(v)) return v.map(toPlain);
  if (v instanceof EmbeddedCbor) return toPlain(v.decode());
  if (v instanceof Tagged) return v.tag === 0 || v.tag === 1004 ? String(v.value) : toPlain(v.value);
  return v;
}
