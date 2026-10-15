import { expect, test } from '@jest/globals';
import { classifyLink } from './links';

test('classifies offers and requests', () => {
  expect(classifyLink('openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fi.example%2Fo').kind).toBe('offer');
  expect(classifyLink(' eudi-openid4vp://?client_id=x&request_uri=https%3A%2F%2Fv.example ').kind).toBe('request');
  expect(classifyLink('openid4vp://?request_uri=x').kind).toBe('request');
  expect(classifyLink('https://example.com').kind).toBe('unknown');
});
