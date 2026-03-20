const { validateLLMOutput, SENSITIVE_OUTPUT_PATTERNS } = require('../../../crons/utils/sanitize');

describe('SENSITIVE_OUTPUT_PATTERNS', () => {
  test('should include YOUTUBE_API_KEY pattern', () => {
    const hasYoutubePattern = SENSITIVE_OUTPUT_PATTERNS.some((p) => p.source.includes('YOUTUBE_API_KEY'));
    expect(hasYoutubePattern).toBe(true);
  });
});

describe('validateLLMOutput', () => {
  test('should flag YOUTUBE_API_KEY in output', () => {
    const result = validateLLMOutput('YOUTUBE_API_KEY=AIzaSyD1234567890');
    expect(result.valid).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('should pass clean output', () => {
    const result = validateLLMOutput('This is a normal cybersecurity summary.');
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});
