import { expect, test } from '@jest/globals';
import { en, sl } from './strings';

test('every Slovenian string has an English translation', () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(sl).sort());
  for (const value of Object.values(en)) expect(value.trim()).not.toBe('');
});
