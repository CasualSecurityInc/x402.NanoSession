import { test, expect } from 'vitest';

test('setup works', () => {
  expect(true).toBe(true);
});

test('vitest globals are enabled', () => {
  expect(typeof test).toBe('function');
  expect(typeof expect).toBe('function');
});
