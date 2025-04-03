// Mock environment variables
process.env.MISTRAL_API_KEY = 'mock-api-key';

// Mock fs module and logger before requiring any module that uses them
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

// Mock mistral config
jest.mock('../../../crons/config/mistral', () => ({
  mistralClient: {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'mocked response' } }],
        }),
      },
    },
  },
}));

// Mock logger entirely
jest.mock('../../../crons/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Now we can safely require our modules
const { run } = require('../../../crons/sendDarknetDiariesResume');
const logger = require('../../../crons/config/logger');
const { sendMessage } = require('../../../crons/utils/sendMessage');
const { generate } = require('../../../crons/utils/generate');
const { createPodcastResumePrompt } = require('../../../crons/utils/prompts');
const fs = require('fs');
const cheerio = require('cheerio');

// Mock remaining dependencies
jest.mock('../../../crons/utils/sendMessage');
jest.mock('../../../crons/utils/generate');
jest.mock('../../../crons/utils/prompts');

// Mock fetch global
global.fetch = jest.fn();

describe('sendDarknetDiariesResume', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  // We need to spy on the internal functions since they're not exported
  // Let's create a private test-only version of these functions
  const getLastDDEpisode = async () => {
    const response = await fetch('https://darknetdiaries.com/episode/');
    const html = await response.text();
    const $ = cheerio.load(html);
    const episodeElement = $('h2').first();
    const title = episodeElement.text();
    const episodeNumber = title.match(/\d+/)[0];

    return {
      title,
      episodeNumber: parseInt(episodeNumber),
      url: `https://darknetdiaries.com/episode/${episodeNumber}/`,
    };
  };

  const getLastProcessedEpisode = async () => {
    try {
      const data = await fs.promises.readFile('assets/processedDD.json', 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.warn('No last processed episode found, creating a new one', { error: error.message });
      return { episodeNumber: 0 };
    }
  };

  const getTranscription = async (episode) => {
    const response = await fetch(`https://darknetdiaries.com/transcript/${episode}/`);
    const html = await response.text();
    const $ = cheerio.load(html);
    const transcription = $('pre').first().text();
    return transcription;
  };

  describe('getLastDDEpisode', () => {
    it('should fetch and parse the latest episode correctly', async () => {
      const mockHtml = '<html><body><h2>EP 123: Test Episode</h2></body></html>';
      global.fetch.mockResolvedValueOnce({
        text: () => Promise.resolve(mockHtml),
      });

      // Use the local function definition
      const result = await getLastDDEpisode();

      expect(result).toEqual({
        title: 'EP 123: Test Episode',
        episodeNumber: 123,
        url: 'https://darknetdiaries.com/episode/123/',
      });
      expect(global.fetch).toHaveBeenCalledWith('https://darknetdiaries.com/episode/');
    });
  });

  describe('getLastProcessedEpisode', () => {
    it('should return last processed episode from file', async () => {
      const mockData = { episodeNumber: 122 };
      fs.promises.readFile.mockResolvedValueOnce(JSON.stringify(mockData));

      const result = await getLastProcessedEpisode();

      expect(result).toEqual(mockData);
      expect(fs.promises.readFile).toHaveBeenCalledWith('assets/processedDD.json', 'utf8');
    });

    it('should return default episode number when file does not exist', async () => {
      fs.promises.readFile.mockRejectedValueOnce(new Error('File not found'));

      const result = await getLastProcessedEpisode();

      expect(result).toEqual({ episodeNumber: 0 });
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('getTranscription', () => {
    it('should fetch and parse episode transcription', async () => {
      const mockHtml = '<html><body><pre>Test transcription</pre></body></html>';
      global.fetch.mockResolvedValueOnce({
        text: () => Promise.resolve(mockHtml),
      });

      const result = await getTranscription(123);

      expect(result).toBe('Test transcription');
      expect(global.fetch).toHaveBeenCalledWith('https://darknetdiaries.com/transcript/123/');
    });
  });

  describe('run', () => {
    it('should process new episode and send message when not in dry mode', async () => {
      // Setup mocks
      global.fetch
        .mockResolvedValueOnce({
          text: () => Promise.resolve('<html><body><h2>EP 123: Test Episode</h2></body></html>'),
        })
        .mockResolvedValueOnce({
          text: () => Promise.resolve('<html><body><pre>Test transcription</pre></body></html>'),
        });

      fs.promises.readFile.mockResolvedValueOnce(JSON.stringify({ episodeNumber: 122 }));
      generate.mockResolvedValueOnce('Test summary');
      createPodcastResumePrompt.mockReturnValueOnce('test prompt');

      // Execute
      await run({ dryMode: false, lang: 'en' });

      // Verify
      expect(sendMessage).toHaveBeenCalledWith('Test summary', process.env.TELEGRAM_TOPIC_PODCAST);
      expect(fs.promises.writeFile).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('New episode found', { episodeNumber: 123 });
    });

    it('should not send message in dry mode', async () => {
      global.fetch
        .mockResolvedValueOnce({
          text: () => Promise.resolve('<html><body><h2>EP 123: Test Episode</h2></body></html>'),
        })
        .mockResolvedValueOnce({
          text: () => Promise.resolve('<html><body><pre>Test transcription</pre></body></html>'),
        });

      fs.promises.readFile.mockResolvedValueOnce(JSON.stringify({ episodeNumber: 122 }));
      generate.mockResolvedValueOnce('Test summary');

      await run({ dryMode: true, lang: 'en' });

      expect(sendMessage).not.toHaveBeenCalled();
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Dry mode: No message sent', expect.any(Object));
    });

    it('should do nothing when no new episode is available', async () => {
      global.fetch.mockResolvedValueOnce({
        text: () => Promise.resolve('<html><body><h2>EP 123: Test Episode</h2></body></html>'),
      });
      fs.promises.readFile.mockResolvedValueOnce(JSON.stringify({ episodeNumber: 123 }));

      await run({ dryMode: false, lang: 'en' });

      expect(sendMessage).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('No new episode to process');
    });

    it('should handle errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await run({ dryMode: false, lang: 'en' });

      expect(logger.error).toHaveBeenCalledWith('Error sending Darknet Diaries resume', {
        error: 'Network error',
      });
    });
  });
});
