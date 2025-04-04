process.env.REDDIT_CLIENT_ID = 'client_id';
process.env.REDDIT_CLIENT_SECRET = 'client_secret';
process.env.REDDIT_DAYS_LOOKBACK = '3';
process.env.REDDIT_SUBREDDITS = 'netsec,cybersecurity';
process.env.TELEGRAM_TOPIC_REDDIT = '123';
process.env.REDDIT_USERNAME = 'test_user';

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

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

global.fetch = jest.fn();

const fs = require('fs').promises;
const { run } = require('../../../crons/sendRedditPost');
const { sendMessage } = require('../../../crons/utils/sendMessage');
const { generate } = require('../../../crons/utils/generate');
const { createRedditPrompt } = require('../../../crons/utils/prompts');
const { cleanProcessedData } = require('../../../crons/utils/cleanJsonFile');
const logger = require('../../../crons/config/logger');

describe('sendRedditPost cron job', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ access_token: 'mocked_token' }),
    });
  });

  describe('run function', () => {
    beforeEach(() => {
      fs.readFile.mockResolvedValueOnce(JSON.stringify([{ id: 'oldpost', processedAt: '2023-01-01T00:00:00.000Z' }]));

      fetch.mockReset();

      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ access_token: 'mocked_token' }),
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            children: [
              {
                data: {
                  id: 'post1',
                  title: 'Netsec Post',
                  permalink: '/r/netsec/comments/post1/netsec_post',
                  score: 100,
                  selftext: 'This is a netsec post',
                  created_utc: Date.now() / 1000 - 1 * 24 * 60 * 60, // 1 day ago
                },
              },
            ],
          },
        }),
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ access_token: 'mocked_token' }),
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            children: [
              {
                data: {
                  id: 'post2',
                  title: 'Cybersecurity Post',
                  permalink: '/r/cybersecurity/comments/post2/cybersecurity_post',
                  score: 200,
                  selftext: 'This is a cybersecurity post',
                  created_utc: Date.now() / 1000 - 1 * 24 * 60 * 60, // 1 day ago
                },
              },
            ],
          },
        }),
      });
    });

    test('should run in dry mode', async () => {
      await run({ dryMode: true, lang: 'french' });

      expect(cleanProcessedData).toHaveBeenCalledWith('3', './assets/processedReddit.json');
      expect(createRedditPrompt).toHaveBeenCalledWith(
        'Cybersecurity Post',
        'This is a cybersecurity post',
        'https://reddit.com/r/cybersecurity/comments/post2/cybersecurity_post',
        'french'
      );
      expect(generate).toHaveBeenCalledWith('Reddit prompt');
      expect(sendMessage).not.toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled(); // For saving the processed post
      expect(logger.info).toHaveBeenCalledWith('Would send Telegram message', { summary: 'Generated summary' });
    });

    test('should send message when not in dry mode', async () => {
      await run({ dryMode: false, lang: 'english' });

      expect(sendMessage).toHaveBeenCalledWith('Generated summary', '123');
      expect(fs.writeFile).toHaveBeenCalled(); // For saving the processed post
      expect(logger.info).toHaveBeenCalledWith('Successfully sent Reddit post', { id: 'post2' });
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
    });

    test('should handle errors', async () => {
      cleanProcessedData.mockRejectedValueOnce(new Error('Clean error'));

      await run({ dryMode: false });

      expect(logger.error).toHaveBeenCalledWith('Error sending Reddit post', { error: 'Clean error' });
    });
  });
});
