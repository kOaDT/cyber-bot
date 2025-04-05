process.env.MISTRAL_API_KEY = 'mock-api-key';
process.env.TELEGRAM_TOPIC_PODCAST = 'mock-topic-id';

jest.mock('../../../crons/config/mistral', () => ({
  mistralClient: {
    chat: {
      complete: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'Generated text' } }],
      }),
    },
  },
  DEFAULT_PARAMS: {},
}));

jest.mock('../../../crons/utils/database', () => ({
  query: jest.fn().mockResolvedValue([]),
  close: jest.fn().mockResolvedValue(undefined),
}));

const mockBrowser = {
  init: jest.fn().mockReturnThis(),
  navigateTo: jest.fn().mockResolvedValue(),
  getAttributeValue: jest.fn().mockResolvedValue('/podcasts/episode/123'),
  clickAndWait: jest.fn().mockResolvedValue(),
  getText: jest.fn(),
  getPageTitle: jest.fn().mockResolvedValue('Episode 123 - Title'),
  close: jest.fn().mockResolvedValue(),
};

jest.mock('../../../crons/utils/puppeteerUtils', () => ({
  BrowserManager: jest.fn().mockImplementation(() => mockBrowser),
}));

jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
  statSync: jest.fn(() => ({
    isDirectory: () => false,
  })),
}));

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../../crons/config/logger', () => mockLogger);

const mockSendMessage = jest.fn().mockResolvedValue();
jest.mock('../../../crons/utils/sendMessage', () => ({
  sendMessage: mockSendMessage,
}));

const mockGenerate = jest.fn().mockResolvedValue('Generated summary');
jest.mock('../../../crons/utils/generate', () => ({
  generate: mockGenerate,
}));

jest.mock('../../../crons/utils/prompts', () => ({
  createPodcastResumePrompt: jest.fn().mockReturnValue('Test prompt'),
}));

jest.mock('../../../crons/sendSnykResume', () => {
  const originalModule = jest.requireActual('../../../crons/sendSnykResume');

  return {
    ...originalModule,
    getLastSnykEpisode: jest.fn().mockResolvedValue({
      episodeNumber: 123,
      title: 'Episode Title',
      transcript: 'Episode transcript',
      url: 'https://snyk.io/podcasts/episode/123',
    }),
  };
});

const { run } = require('../../../crons/sendSnykResume');
const fs = require('fs');

describe('sendSnykResume', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBrowser.getText.mockResolvedValueOnce('Episode transcript').mockResolvedValueOnce('Episode Title');
  });

  describe('run', () => {
    it('should handle dry mode correctly', async () => {
      fs.promises.readFile.mockResolvedValueOnce(JSON.stringify({ episodeNumber: 122 }));

      await run({ dryMode: true, lang: 'english' });

      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Dry mode: No message sent', expect.any(Object));
    });

    it('should handle when no new episode exists', async () => {
      fs.promises.readFile.mockResolvedValueOnce(JSON.stringify({ episodeNumber: 123 }));

      await run({ dryMode: false, lang: 'english' });

      expect(mockGenerate).not.toHaveBeenCalled();
      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('No new episode to process');
    });

    it('should handle missing process file', async () => {
      fs.promises.readFile.mockRejectedValueOnce(new Error('File not found'));

      await run({ dryMode: false, lang: 'english' });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No last processed episode found, creating a new one',
        expect.objectContaining({ error: expect.any(String) })
      );
      expect(mockSendMessage).toHaveBeenCalled();
    });
  });
});
