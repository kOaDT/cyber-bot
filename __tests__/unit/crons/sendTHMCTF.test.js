const fs = require('fs').promises;
const { run } = require('../../../crons/sendTHMCTF');
const logger = require('../../../crons/config/logger');

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    rename: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    rmdir: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../crons/utils/sendMessage', () => ({
  sendMessage: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../crons/utils/generate', () => ({
  generate: jest.fn().mockResolvedValue('Translated message'),
}));

jest.mock('../../../crons/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../crons/utils/prompts', () => ({
  translatePrompt: jest.fn().mockReturnValue('Translation prompt'),
}));

jest.mock('../../../crons/sendTHMCTF', () => {
  const originalModule = jest.requireActual('../../../crons/sendTHMCTF');

  return {
    ...originalModule,
    run: originalModule.run,
  };
});

const { sendMessage } = require('../../../crons/utils/sendMessage');
const { generate } = require('../../../crons/utils/generate');
const { translatePrompt } = require('../../../crons/utils/prompts');

describe('sendTHMCTF', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    process.env.TELEGRAM_TOPIC_THM = '123';

    global.fetch.mockImplementation((url) => {
      const pageNumber = url.match(/page=(\d+)/)[1];

      if (pageNumber > 1) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              status: 'success',
              data: { docs: [] },
            }),
        });
      }

      return Promise.resolve({
        json: jest.fn(),
      });
    });
  });

  afterEach(() => {
    delete global.fetch;
  });

  const mockChallenge = {
    code: 'test-room',
    title: 'Test Room',
    description: 'A test room description',
    difficulty: 'easy',
    tagDocs: [{ label: 'test' }, { label: 'security' }],
  };

  const mockApiResponse = {
    status: 'success',
    data: {
      docs: [mockChallenge],
    },
  };

  describe('run', () => {
    it('should handle no new challenges', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(['test-room']));

      global.fetch.mockImplementationOnce(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockApiResponse),
        })
      );

      await run({ dryMode: false, lang: 'english' });

      expect(logger.info).toHaveBeenCalledWith('No new challenges found');
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('should send message for new challenge in English without translation', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify([]));

      global.fetch.mockImplementationOnce(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockApiResponse),
        })
      );

      await run({ dryMode: false, lang: 'english' });

      expect(translatePrompt).not.toHaveBeenCalled();
      expect(generate).not.toHaveBeenCalled();
      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage.mock.calls[0][0]).toContain('New TryHackMe Challenge');
      expect(sendMessage.mock.calls[0][0]).toContain(mockChallenge.title);
    });

    it('should translate and generate message for non-English language', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify([]));

      global.fetch.mockImplementationOnce(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockApiResponse),
        })
      );

      await run({ dryMode: false, lang: 'french' });

      expect(translatePrompt).toHaveBeenCalled();
      expect(generate).toHaveBeenCalled();
      expect(sendMessage).toHaveBeenCalledWith('Translated message', '123');
    });

    it('should not send message in dry mode', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify([]));

      global.fetch.mockImplementationOnce(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockApiResponse),
        })
      );

      await run({ dryMode: true, lang: 'french' });

      expect(sendMessage).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Dry mode: No message sent', expect.any(Object));
    });

    it('should throw on API errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('API Error'));

      await expect(run({ dryMode: false, lang: 'french' })).rejects.toThrow('API Error');
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('should throw on file system errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File system error'));

      await expect(run({ dryMode: false, lang: 'french' })).rejects.toThrow();
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('should paginate through challenges until finding a new one', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(['first-room']));

      const secondPageChallenge = {
        ...mockChallenge,
        code: 'second-room',
      };

      global.fetch
        .mockReset()
        .mockImplementationOnce(() =>
          Promise.resolve({
            json: () =>
              Promise.resolve({
                status: 'success',
                data: { docs: [{ ...mockChallenge, code: 'first-room' }] },
              }),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            json: () =>
              Promise.resolve({
                status: 'success',
                data: { docs: [secondPageChallenge] },
              }),
          })
        )
        .mockImplementation(() =>
          Promise.resolve({
            json: () =>
              Promise.resolve({
                status: 'success',
                data: { docs: [] },
              }),
          })
        );

      await run({ dryMode: false, lang: 'french' });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('assets/processedCTF.json'),
        expect.stringContaining('second-room')
      );
      expect(fs.rename).toHaveBeenCalledWith(expect.stringContaining('.tmp'), 'assets/processedCTF.json');
    });
  });
});
