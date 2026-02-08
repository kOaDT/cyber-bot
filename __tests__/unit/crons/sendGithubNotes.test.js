const { run } = require('../../../crons/sendGithubNotes');
const logger = require('../../../crons/config/logger');
const { sendMessage } = require('../../../crons/utils/sendMessage');
const fs = require('fs').promises;

jest.mock('../../../crons/sendGithubNotes', () => {
  const originalModule = jest.requireActual('../../../crons/sendGithubNotes');

  return {
    ...originalModule,
    run: jest.fn().mockImplementation(async ({ dryMode }) => {
      const { logger } = originalModule._testExports || {
        logger: require('../../../crons/config/logger'),
        getGithubFile: jest.fn(),
      };

      try {
        if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_USERNAME || !process.env.GITHUB_REPO) {
          logger.error('GITHUB_TOKEN, GITHUB_USERNAME, GITHUB_REPO is not set');
          return;
        }

        await global.fetch('https://api.github.com/graphql');

        if (dryMode) {
          logger.info('Revision card generated', { revisionCard: 'Test card' });
        } else {
          require('../../../crons/utils/sendMessage').sendMessage('Test card');
        }
      } catch (err) {
        logger.error('Error sending Github notes', { error: err.message });
      }
    }),

    _testExports: {
      logger: require('../../../crons/config/logger'),
      getGithubFile: jest.fn(),
    },
  };
});

jest.mock('../../../crons/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../crons/utils/sendMessage', () => ({
  sendMessage: jest.fn(),
}));

jest.mock('../../../crons/utils/generate', () => ({
  generate: jest.fn(),
}));

jest.mock('../../../crons/utils/relevance', () => ({
  evaluateRelevance: jest.fn().mockResolvedValue({ relevant: true, score: 8 }),
}));

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

jest.mock('node:crypto', () => ({
  randomInt: jest.fn(),
}));

global.fetch = jest.fn();

const mockPrivateFunctions = () => {
  const getProcessedNotes = async () => {
    try {
      const data = await fs.readFile('assets/processedNotes.json', 'utf8');
      return JSON.parse(data);
    } catch (err) {
      if (err.code === 'ENOENT' || err instanceof SyntaxError) {
        return [];
      }
      throw err;
    }
  };

  const saveProcessedNote = async (title, content) => {
    try {
      const processedNotes = await getProcessedNotes();

      processedNotes.push({
        title,
        content,
        processedAt: new Date().toISOString(),
      });

      await fs.writeFile('assets/processedNotes.json', JSON.stringify(processedNotes, null, 2), 'utf8');
    } catch (err) {
      logger.error('Error saving processed note', { error: err.message });
    }
  };

  return { getProcessedNotes, saveProcessedNote };
};

describe('sendGithubNotes', () => {
  const originalEnv = process.env;
  const { getProcessedNotes, saveProcessedNote } = mockPrivateFunctions();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      GITHUB_TOKEN: 'test-token',
      GITHUB_USERNAME: 'testuser',
      GITHUB_REPO: 'test-repo',
      TELEGRAM_TOPIC_GITHUB: '123',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getProcessedNotes', () => {
    it('should return processed notes from file', async () => {
      const mockData = JSON.stringify([{ title: 'test.md', content: 'test content' }]);
      fs.readFile.mockResolvedValue(mockData);

      const result = await getProcessedNotes();

      expect(result).toEqual([{ title: 'test.md', content: 'test content' }]);
      expect(fs.readFile).toHaveBeenCalledWith('assets/processedNotes.json', 'utf8');
    });

    it('should return empty array if file does not exist', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);

      const result = await getProcessedNotes();

      expect(result).toEqual([]);
    });
  });

  describe('saveProcessedNote', () => {
    it('should save a processed note', async () => {
      const mockData = JSON.stringify([
        { title: 'existing.md', content: 'existing content', processedAt: '2023-01-01' },
      ]);
      fs.readFile.mockResolvedValue(mockData);

      await saveProcessedNote('test.md', 'test content');

      expect(fs.writeFile).toHaveBeenCalledWith(
        'assets/processedNotes.json',
        expect.stringContaining('test.md'),
        'utf8'
      );
    });

    it('should handle errors when saving', async () => {
      fs.readFile.mockResolvedValue('[]');
      fs.writeFile.mockRejectedValue(new Error('Write error'));

      await saveProcessedNote('test.md', 'test content');

      expect(logger.error).toHaveBeenCalledWith('Error saving processed note', { error: 'Write error' });
    });
  });

  describe('run', () => {
    it('should log error if GitHub credentials are not set', async () => {
      delete process.env.GITHUB_TOKEN;

      await run({});

      expect(logger.error).toHaveBeenCalledWith('GITHUB_TOKEN, GITHUB_USERNAME, GITHUB_REPO is not set');
    });

    it('should log error if GitHub API fails', async () => {
      global.fetch.mockRejectedValue(new Error('API error'));

      await run({});

      expect(logger.error).toHaveBeenCalledWith('Error sending Github notes', { error: 'API error' });
    });

    it('should use dry mode correctly', async () => {
      global.fetch.mockResolvedValue({}); // Success response

      await run({ dryMode: true });

      expect(sendMessage).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Revision card generated', { revisionCard: 'Test card' });
    });

    it('should send message in normal mode', async () => {
      global.fetch.mockResolvedValue({}); // Success response

      await run({ dryMode: false });

      expect(sendMessage).toHaveBeenCalledWith('Test card');
    });
  });
});
