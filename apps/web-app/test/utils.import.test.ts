// ensure the ESM bundle of @team-soju/utils resolves correctly in the web-app testing environment
import { getSpriteUrl, getNationalNumber } from '@team-soju/utils';

test('utils package exports functions as expected (ESM)', () => {
  expect(typeof getSpriteUrl).toBe('function');
  expect(typeof getNationalNumber).toBe('function');
});
