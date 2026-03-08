process.env.REDDIT_DAYS_LOOKBACK = '3';
process.env.REDDIT_SUBREDDITS = 'netsec,cybersecurity';
process.env.TELEGRAM_TOPIC_REDDIT = '123';

const mockPage = {
  goto: jest.fn().mockResolvedValue(),
  content: jest.fn(),
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

const timestamp = Date.now() - 1 * 24 * 60 * 60 * 1000; // 1 day ago in ms

const netsecHtml = `<div id="siteTable">
  <div class="thing link" data-fullname="t3_post1" data-timestamp="${timestamp}"
       data-url="https://example.com/netsec-article" data-domain="example.com">
    <div class="score unvoted">100</div>
    <a class="title">Netsec Post</a>
    <a class="comments" href="/r/netsec/comments/post1/netsec_post/">5 comments</a>
  </div>
</div>`;

const cybersecHtml = `<div id="siteTable">
  <div class="thing link" data-fullname="t3_post2" data-timestamp="${timestamp}"
       data-url="https://example.com/cybersec-article" data-domain="example.com">
    <div class="score unvoted">200</div>
    <a class="title">Cybersecurity Post</a>
    <a class="comments" href="/r/cybersecurity/comments/post2/cybersecurity_post/">10 comments</a>
  </div>
</div>`;

describe('sendRedditPost cron job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('run function', () => {
    beforeEach(() => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify([{ id: 'oldpost', processedAt: '2023-01-01T00:00:00.000Z' }]));

      mockPage.content.mockResolvedValueOnce(netsecHtml).mockResolvedValueOnce(cybersecHtml);
    });

    test('should run in dry mode', async () => {
      await run({ dryMode: true, lang: 'french' });

      expect(cleanProcessedData).toHaveBeenCalledWith('3', './assets/processedReddit.json');
      expect(mockBrowser.init).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledTimes(2);
      expect(createRedditPrompt).toHaveBeenCalledWith(
        'Cybersecurity Post',
        'https://example.com/cybersec-article',
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
