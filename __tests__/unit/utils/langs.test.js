const { AUTHORIZED_LANGUAGES } = require('../../../crons/utils/langs');

describe('language utilities', () => {
  test('AUTHORIZED_LANGUAGES should be an array', () => {
    expect(Array.isArray(AUTHORIZED_LANGUAGES)).toBe(true);
  });

  test('AUTHORIZED_LANGUAGES should contain the default languages', () => {
    expect(AUTHORIZED_LANGUAGES).toContain('english');
    expect(AUTHORIZED_LANGUAGES).toContain('french');
  });

  test('AUTHORIZED_LANGUAGES length should be at least 5', () => {
    expect(AUTHORIZED_LANGUAGES.length).toBeGreaterThanOrEqual(5);
  });
});
