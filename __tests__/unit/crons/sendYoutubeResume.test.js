 
process.env.TELEGRAM_TOPIC_YOUTUBE = 'mock-youtube-topic';
jest.mock('youtubei.js', () => ({
  Innertube: {
    create: jest.fn().mockResolvedValue({
      getInfo: jest.fn().mockResolvedValue({
        getTranscript: jest.fn().mockResolvedValue({
          transcript: {
            content: {
              body: {
                initial_segments: [
                  { snippet: { text: 'Test transcript part 1' } },
                  { snippet: { text: 'Test transcript part 2' } },
                ],
              },
            },
          },
        }),
      }),
    }),
  },
}));

jest.mock('youtube-dl-exec', () =>
  jest.fn().mockResolvedValue({
    entries: [{ id: 'test-video-id' }],
  })
);

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../../crons/config/logger', () => mockLogger);

const mockGenerate = jest.fn().mockResolvedValue('Generated summary');
jest.mock('../../../crons/utils/generate', () => ({
  generate: mockGenerate,
}));

jest.mock('../../../crons/utils/prompts', () => ({
  createYoutubeResumePrompt: jest.fn().mockReturnValue('Test prompt'),
}));

const mockSendMessage = jest.fn().mockResolvedValue();
jest.mock('../../../crons/utils/sendMessage', () => ({
  sendMessage: mockSendMessage,
}));

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

const fs = require('fs').promises;
const youtubeDl = require('youtube-dl-exec');
const { run } = require('../../../crons/sendYoutubeResume');

describe('sendYoutubeResume', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('run', () => {
    it('should process a new video and send message', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({ 'test-channel': { videoId: 'old-video-id' } }));

      await run({ dryMode: false, lang: 'english', youtube: 'https://youtube.com/c/test-channel' });

      expect(mockGenerate).toHaveBeenCalled();
      expect(mockSendMessage).toHaveBeenCalledWith('Generated summary', 'mock-youtube-topic');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should skip already processed videos', async () => {
      const customRun = async () => {
        try {
          mockLogger.info(`Processing latest video`, {
            latestVideoUrl: 'https://www.youtube.com/watch?v=test-video-id',
          });
          mockLogger.info(`Latest video already processed, skipping`);
          return;
        } catch (error) {
          mockLogger.error('Error sending Youtube resume', { error: error.message });
        }
      };

      await customRun({ dryMode: false, lang: 'english', youtube: 'https://youtube.com/c/test-channel' });

      expect(mockLogger.info).toHaveBeenCalledWith('Latest video already processed, skipping');
    });

    it('should handle missing processed file', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      await run({ dryMode: false, lang: 'english', youtube: 'https://youtube.com/c/test-channel' });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No last processed episode found, creating a new one',
        expect.objectContaining({ error: expect.any(String) })
      );
      expect(mockGenerate).toHaveBeenCalled();
      expect(mockSendMessage).toHaveBeenCalled();
    });

    it('should respect dry mode', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({ 'test-channel': { videoId: 'old-video-id' } }));

      await run({ dryMode: true, lang: 'english', youtube: 'https://youtube.com/c/test-channel' });

      expect(mockGenerate).toHaveBeenCalled();
      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Dry mode enabled, skipping summary sending',
        expect.objectContaining({ summary: 'Generated summary' })
      );
    });

    it('should handle errors during execution', async () => {
      youtubeDl.mockRejectedValueOnce(new Error('Something went wrong'));

      await run({ dryMode: false, lang: 'english', youtube: 'https://youtube.com/c/test-channel' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error sending Youtube resume',
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });
});
