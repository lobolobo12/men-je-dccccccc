import { expect, test } from '@jest/globals';
import { decodeCbor, EmbeddedCbor, encodeCbor, Tagged, toPlain } from './cbor';

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const unhex = (h: string) => new Uint8Array(Buffer.from(h, 'hex'));

// Vectors from RFC 8949 Appendix A.
test.each([
  [0, '00'],
  [23, '17'],
  [24, '1818'],
  [1000, '1903e8'],
  [1000000, '1a000f4240'],
  [-1, '20'],
  [-1000, '3903e7'],
  ['IETF', '6449455446'],
  ['ü', '62c3bc'],
  [[1, [2, 3], [4, 5]], '8301820203820405'],
  [{ a: 1, b: [2, 3] }, 'a26161016162820203'],
  [true, 'f5'],
  [null, 'f6'],
])('encodes %p', (value, expected) => {
  expect(hex(encodeCbor(value))).toBe(expected);
});

test('decodes RFC vectors', () => {
  expect(decodeCbor(unhex('1903e8'))).toBe(1000);
  expect(decodeCbor(unhex('3903e7'))).toBe(-1000);
  expect(decodeCbor(unhex('f93c00'))).toBe(1);
  expect(decodeCbor(unhex('fb3ff199999999999a'))).toBe(1.1);
  expect(toPlain(decodeCbor(unhex('a26161016162820203')))).toEqual({ a: 1, b: [2, 3] });
  const tagged = decodeCbor(unhex('c074323031332d30332d32315432303a30343a30305a')) as Tagged;
  expect(tagged.tag).toBe(0);
});

test('tag 24 round trip keeps embedded bytes', () => {
  const e = EmbeddedCbor.of(new Map<unknown, unknown>([['x', 1]]));
  const back = decodeCbor(encodeCbor([e])) as unknown[];
  expect(back[0]).toBeInstanceOf(EmbeddedCbor);
  expect(hex((back[0] as EmbeddedCbor).bytes)).toBe(hex(e.bytes));
});
