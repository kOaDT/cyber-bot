jest.mock('../../../crons/config/mistral', () => ({
  mistralClient: {},
  DEFAULT_PARAMS: {},
}));

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
jest.mock('../../../crons/config/logger', () => mockLogger);
jest.mock('../../../crons/utils/sendMessage', () => ({
  sendMessage: jest.fn(),
}));
jest.mock('../../../crons/utils/generate', () => ({
  generate: jest.fn(),
}));
jest.mock('../../../crons/utils/prompts', () => ({
  createPodcastResumePrompt: jest.fn(),
}));
jest.mock('assemblyai', () => ({}));
jest.mock('fs', () => ({}));
jest.mock('cheerio', () => ({}));

const { run } = require('../../../crons/sendCyberShowResume');

describe('sendCyberShowResume basic tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should log error if ASSEMBLYAI_API_KEY is not set', async () => {
    process.env.ASSEMBLYAI_API_KEY = '';

    await run({ dryMode: false, lang: 'french' });

    expect(mockLogger.error).toHaveBeenCalledWith('ASSEMBLYAI_API_KEY is not set');
  });
});
