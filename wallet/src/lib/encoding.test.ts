import { expect, test } from '@jest/globals';
import { base64ToBytes, base64UrlDecodeJson, base64UrlEncodeJson, bytesToBase64, bytesToBase64Url, utf8 } from './encoding';

test('base64 matches Node for all padding lengths', () => {
  for (const s of ['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar', 'čšž €']) {
    const bytes = utf8(s);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    expect(bytesToBase64Url(bytes)).toBe(Buffer.from(bytes).toString('base64url'));
    expect(Array.from(base64ToBytes(Buffer.from(bytes).toString('base64url')))).toEqual(Array.from(bytes));
  }
});

test('json round trip', () => {
  const v = { a: 1, b: ['š', null] };
  expect(base64UrlDecodeJson(base64UrlEncodeJson(v))).toEqual(v);
});
