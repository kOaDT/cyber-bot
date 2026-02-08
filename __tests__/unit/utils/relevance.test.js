jest.mock('../../../crons/utils/generate', () => ({
  generate: jest.fn(),
}));

jest.mock('../../../crons/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../crons/utils/prompts', () => ({
  createRelevancePrompt: jest.fn(() => 'mocked prompt'),
}));

describe('evaluateRelevance', () => {
  let evaluateRelevance;
  let generate;
  let logger;
  let createRelevancePrompt;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.RELEVANCE_THRESHOLD;

    generate = require('../../../crons/utils/generate').generate;
    logger = require('../../../crons/config/logger');
    createRelevancePrompt = require('../../../crons/utils/prompts').createRelevancePrompt;
    evaluateRelevance = require('../../../crons/utils/relevance').evaluateRelevance;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should return relevant when score is above default threshold', async () => {
    generate.mockResolvedValue('8');

    const result = await evaluateRelevance({
      title: 'Critical RCE in Apache',
      content: 'A remote code execution vulnerability...',
      source: 'news article',
    });

    expect(result).toEqual({ relevant: true, score: 8 });
    expect(generate).toHaveBeenCalledWith('mocked prompt', {
      max_tokens: 10,
      temperature: 0,
      skipValidation: true,
    });
  });

  test('should return not relevant when score is below default threshold', async () => {
    generate.mockResolvedValue('3');

    const result = await evaluateRelevance({
      title: 'Best coffee makers 2025',
      content: 'Review of top coffee makers...',
      source: 'news article',
    });

    expect(result).toEqual({ relevant: false, score: 3 });
  });

  test('should return relevant when score equals threshold', async () => {
    generate.mockResolvedValue('6');

    const result = await evaluateRelevance({
      title: 'Tech company security update',
      source: 'news article',
    });

    expect(result).toEqual({ relevant: true, score: 6 });
  });

  test('should respect custom RELEVANCE_THRESHOLD', async () => {
    process.env.RELEVANCE_THRESHOLD = '8';
    jest.resetModules();
    generate = require('../../../crons/utils/generate').generate;
    evaluateRelevance = require('../../../crons/utils/relevance').evaluateRelevance;

    generate.mockResolvedValue('7');

    const result = await evaluateRelevance({
      title: 'Network security basics',
      source: 'podcast episode',
    });

    expect(result).toEqual({ relevant: false, score: 7 });
  });

  test('should fail open when generate returns null', async () => {
    generate.mockResolvedValue(null);

    const result = await evaluateRelevance({
      title: 'Some article',
      source: 'news article',
    });

    expect(result).toEqual({ relevant: true, score: null });
    expect(logger.warn).toHaveBeenCalledWith(
      'Relevance check returned no result, defaulting to relevant',
      expect.objectContaining({ title: 'Some article' })
    );
  });

  test('should fail open when generate returns non-numeric text', async () => {
    generate.mockResolvedValue('This is very relevant content');

    const result = await evaluateRelevance({
      title: 'Some article',
      source: 'news article',
    });

    expect(result).toEqual({ relevant: true, score: null });
    expect(logger.warn).toHaveBeenCalledWith(
      'Relevance check returned invalid score, defaulting to relevant',
      expect.objectContaining({ rawResult: 'This is very relevant content' })
    );
  });

  test('should fail open when generate throws an error', async () => {
    generate.mockRejectedValue(new Error('API error'));

    const result = await evaluateRelevance({
      title: 'Some article',
      source: 'news article',
    });

    expect(result).toEqual({ relevant: true, score: null });
    expect(logger.warn).toHaveBeenCalledWith(
      'Relevance check failed, defaulting to relevant',
      expect.objectContaining({ error: 'API error' })
    );
  });

  test('should handle score with whitespace', async () => {
    generate.mockResolvedValue('  7  \n');

    const result = await evaluateRelevance({
      title: 'Malware analysis techniques',
      source: 'YouTube video',
    });

    expect(result).toEqual({ relevant: true, score: 7 });
  });

  test('should reject score out of range (> 10)', async () => {
    generate.mockResolvedValue('15');

    const result = await evaluateRelevance({
      title: 'Some article',
      source: 'news article',
    });

    expect(result).toEqual({ relevant: true, score: null });
    expect(logger.warn).toHaveBeenCalledWith(
      'Relevance check returned invalid score, defaulting to relevant',
      expect.objectContaining({ rawResult: '15' })
    );
  });

  test('should reject score out of range (< 1)', async () => {
    generate.mockResolvedValue('0');

    const result = await evaluateRelevance({
      title: 'Some article',
      source: 'news article',
    });

    expect(result).toEqual({ relevant: true, score: null });
  });

  test('should work without content parameter', async () => {
    generate.mockResolvedValue('9');

    const result = await evaluateRelevance({
      title: 'Zero-day exploit discovered',
      source: 'podcast episode',
    });

    expect(result).toEqual({ relevant: true, score: 9 });
    expect(createRelevancePrompt).toHaveBeenCalledWith('Zero-day exploit discovered', '', 'podcast episode');
  });

  test('should truncate content to excerpt length', async () => {
    generate.mockResolvedValue('7');
    const longContent = 'A'.repeat(1000);

    await evaluateRelevance({
      title: 'Test',
      content: longContent,
      source: 'news article',
    });

    expect(createRelevancePrompt).toHaveBeenCalledWith('Test', 'A'.repeat(500), 'news article');
  });

  test('should log relevance decision with score and threshold', async () => {
    generate.mockResolvedValue('4');

    await evaluateRelevance({
      title: 'Low relevance article',
      source: 'Reddit post',
    });

    expect(logger.info).toHaveBeenCalledWith('Relevance check: skipped', {
      title: 'Low relevance article',
      source: 'Reddit post',
      score: 4,
      threshold: 6,
    });
  });
});
