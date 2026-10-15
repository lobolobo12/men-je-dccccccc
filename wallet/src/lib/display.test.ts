import { expect, test } from '@jest/globals';
import { formatValue } from './display';

test('formats dates, driving privileges and nested objects for people', () => {
  expect(formatValue('1995-04-12', 'sl')).toBe('12. 4. 1995');
  expect(formatValue('1995-04-12', 'en')).toBe('12 Apr 1995');
  expect(formatValue([{ vehicle_category_code: 'B', issue_date: '2013-06-01', expiry_date: '2033-06-01' }], 'sl')).toBe('B (1. 6. 2013 – 1. 6. 2033)');
  expect(formatValue({ locality: 'Ljubljana', country: 'SI' }, 'sl')).toBe('Kraj: Ljubljana, Država: SI');
  expect(formatValue(true, 'sl')).toBe('✓');
});
