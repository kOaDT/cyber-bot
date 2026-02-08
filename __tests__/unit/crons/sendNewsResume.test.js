// Mock dependencies
jest.mock('../../../crons/utils/sendMessage', () => ({
  sendMessage: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../crons/utils/generate', () => ({
  generate: jest.fn().mockResolvedValue('Generated summary'),
}));

jest.mock('../../../crons/utils/prompts', () => ({
  createNewsResumePrompt: jest.fn().mockReturnValue('Generated prompt'),
}));

jest.mock('../../../crons/utils/cleanJsonFile', () => ({
  cleanProcessedData: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../crons/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../crons/utils/relevance', () => ({
  evaluateRelevance: jest.fn().mockResolvedValue({ relevant: true, score: 8 }),
}));

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue('[]'),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('xml2js', () => ({
  Parser: jest.fn().mockImplementation(() => ({
    parseStringPromise: jest.fn().mockResolvedValue({
      opml: {
        body: [
          {
            outline: [{ $: { xmlUrl: 'https://feed1.com/rss' } }, { $: { xmlUrl: 'https://feed2.com/rss' } }],
          },
        ],
      },
    }),
  })),
}));

jest.mock('rss-parser', () =>
  jest.fn().mockImplementation(() => ({
    parseURL: jest.fn().mockResolvedValue({
      items: [
        {
          title: 'Article 1',
          link: 'https://example.com/article1',
          pubDate: new Date().toISOString(),
          categories: ['cybersecurity', 'hacking'],
          content: 'Article 1 content',
        },
      ],
    }),
  }))
);

const { run } = require('../../../crons/sendNewsResume');
const { sendMessage } = require('../../../crons/utils/sendMessage');
const logger = require('../../../crons/config/logger');

describe('sendNewsResume cron job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TELEGRAM_TOPIC_NEWS = '123';
  });

  test('should execute in dry mode without sending messages', async () => {
    await run({ dryMode: true, lang: 'english' });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('Would send Telegram message', expect.any(Object));
  });

  test('should handle errors appropriately', async () => {
    const { cleanProcessedData } = require('../../../crons/utils/cleanJsonFile');
    const testError = new Error('Clean data error');
    cleanProcessedData.mockRejectedValueOnce(testError);

    await run({ dryMode: false, lang: 'english' });

    expect(logger.error).toHaveBeenCalledWith('Error sending news resume', { error: 'Clean data error' });
  });
});
