process.env.REDDIT_DAYS_LOOKBACK = '3';
process.env.REDDIT_SUBREDDITS = 'netsec,cybersecurity';
process.env.TELEGRAM_TOPIC_REDDIT = '123';

const mockPage = {
  goto: jest.fn().mockResolvedValue(),
  evaluate: jest.fn(),
};

const mockBrowser = {
  init: jest.fn().mockReturnThis(),
  page: mockPage,
  close: jest.fn().mockResolvedValue(),
};

jest.mock('../../../crons/utils/puppeteerUtils', () => ({
  BrowserManager: jest.fn().mockImplementation(() => mockBrowser),
}));

jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

jest.mock('../../../crons/utils/sendMessage', () => ({
  sendMessage: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../crons/utils/generate', () => ({
  generate: jest.fn().mockResolvedValue('Generated summary'),
}));

jest.mock('../../../crons/utils/prompts', () => ({
  createRedditPrompt: jest.fn().mockReturnValue('Reddit prompt'),
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
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

const fs = require('fs').promises;
const { run } = require('../../../crons/sendRedditPost');
const { sendMessage } = require('../../../crons/utils/sendMessage');
const { generate } = require('../../../crons/utils/generate');
const { createRedditPrompt } = require('../../../crons/utils/prompts');
const { cleanProcessedData } = require('../../../crons/utils/cleanJsonFile');
const logger = require('../../../crons/config/logger');

const makeRedditJson = (id, title, subreddit, score, selftext = '') => ({
  data: {
    data: {
      children: [
        {
          data: {
            id,
            title,
            permalink: `/r/${subreddit}/comments/${id}/${title.toLowerCase().replace(/\s/g, '_')}/`,
            score,
            selftext,
            url: selftext ? `https://reddit.com/r/${subreddit}/comments/${id}/` : `https://example.com/${id}`,
            created_utc: Date.now() / 1000 - 1 * 24 * 60 * 60,
          },
        },
      ],
    },
  },
});

describe('sendRedditPost cron job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('run function', () => {
    beforeEach(() => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify([{ id: 'oldpost', processedAt: '2023-01-01T00:00:00.000Z' }]));

      mockPage.evaluate
        .mockResolvedValueOnce(makeRedditJson('post1', 'Netsec Post', 'netsec', 100))
        .mockResolvedValueOnce(makeRedditJson('post2', 'Cybersecurity Post', 'cybersecurity', 200));
    });

    test('should run in dry mode', async () => {
      await run({ dryMode: true, lang: 'french' });

      expect(cleanProcessedData).toHaveBeenCalledWith('3', './assets/processedReddit.json');
      expect(mockBrowser.init).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledWith('https://www.reddit.com', { waitUntil: 'domcontentloaded' });
      expect(mockPage.evaluate).toHaveBeenCalledTimes(2);
      expect(createRedditPrompt).toHaveBeenCalledWith(
        'Cybersecurity Post',
        'https://example.com/post2',
        'https://reddit.com/r/cybersecurity/comments/post2/cybersecurity_post/',
        'french'
      );
      expect(generate).toHaveBeenCalledWith('Reddit prompt');
      expect(sendMessage).not.toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Would send Telegram message', { summary: 'Generated summary' });
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    test('should send message when not in dry mode', async () => {
      await run({ dryMode: false, lang: 'english' });

      expect(sendMessage).toHaveBeenCalledWith('Generated summary', '123');
      expect(fs.writeFile).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Successfully sent Reddit post', { id: 'post2' });
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    test('should handle no new posts', async () => {
      fs.readFile.mockReset();
      fs.readFile.mockResolvedValueOnce(
        JSON.stringify([
          { id: 'post1', processedAt: '2023-01-01T00:00:00.000Z' },
          { id: 'post2', processedAt: '2023-01-01T00:00:00.000Z' },
        ])
      );

      await run({ dryMode: false });

      expect(sendMessage).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('No new posts to process');
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    test('should handle errors', async () => {
      cleanProcessedData.mockRejectedValueOnce(new Error('Clean error'));

      await run({ dryMode: false });

      expect(logger.error).toHaveBeenCalledWith('Error sending Reddit post', { error: 'Clean error' });
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });
});
