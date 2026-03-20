const fs = require('fs').promises;

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../crons/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../crons/utils/relevance', () => ({
  evaluateRelevance: jest.fn().mockResolvedValue({ relevant: true, score: 8 }),
}));

jest.mock('../../../crons/utils/generate', () => ({
  generate: jest.fn().mockResolvedValue('Generated summary'),
}));

jest.mock('../../../crons/utils/sendMessage', () => ({
  sendMessage: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../crons/utils/prompts', () => ({
  createPodcastResumePrompt: jest.fn().mockReturnValue('podcast prompt'),
}));

const { runPodcast } = require('../../../crons/utils/podcastRunner');
const logger = require('../../../crons/config/logger');
const { evaluateRelevance } = require('../../../crons/utils/relevance');
const { generate } = require('../../../crons/utils/generate');
const { sendMessage } = require('../../../crons/utils/sendMessage');
const { createPodcastResumePrompt } = require('../../../crons/utils/prompts');

describe('podcastRunner', () => {
  const baseConfig = {
    name: 'Test Podcast',
    assetFile: 'assets/processedTest.json',
    getLastEpisode: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TELEGRAM_TOPIC_PODCAST = 'podcast-topic';
    fs.readFile.mockResolvedValue(JSON.stringify({ episodeNumber: 5 }));
  });

  it('should process a new episode and send message', async () => {
    baseConfig.getLastEpisode.mockResolvedValue({
      episodeNumber: 6,
      title: 'Episode 6',
      url: 'https://example.com/ep6',
      transcript: 'Full transcript text',
    });

    await runPodcast(baseConfig, { dryMode: false, lang: 'english' });

    expect(evaluateRelevance).toHaveBeenCalledWith({
      title: 'Episode 6',
      source: 'podcast episode',
      content: 'Full transcript text',
    });
    expect(createPodcastResumePrompt).toHaveBeenCalledWith(
      'Test Podcast',
      'Episode 6',
      'Full transcript text',
      'https://example.com/ep6',
      'english'
    );
    expect(generate).toHaveBeenCalledWith('podcast prompt');
    expect(sendMessage).toHaveBeenCalledWith('Generated summary', 'podcast-topic');
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('should skip when no new episode', async () => {
    baseConfig.getLastEpisode.mockResolvedValue({
      episodeNumber: 5,
      title: 'Episode 5',
      url: 'https://example.com/ep5',
    });

    await runPodcast(baseConfig, { dryMode: false, lang: 'english' });

    expect(logger.info).toHaveBeenCalledWith('No new episode to process');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('should skip when not relevant and save state', async () => {
    baseConfig.getLastEpisode.mockResolvedValue({
      episodeNumber: 6,
      title: 'Episode 6',
      url: 'https://example.com/ep6',
    });
    evaluateRelevance.mockResolvedValueOnce({ relevant: false, score: 3 });

    await runPodcast(baseConfig, { dryMode: false, lang: 'english' });

    expect(fs.writeFile).toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('should not send in dry mode', async () => {
    baseConfig.getLastEpisode.mockResolvedValue({
      episodeNumber: 6,
      title: 'Episode 6',
      url: 'https://example.com/ep6',
      transcript: 'Transcript',
    });

    await runPodcast(baseConfig, { dryMode: true, lang: 'english' });

    expect(logger.info).toHaveBeenCalledWith('Dry mode: No message sent', { summary: 'Generated summary' });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should call getTranscription when transcript not in episode', async () => {
    const config = {
      ...baseConfig,
      getTranscription: jest.fn().mockResolvedValue('Fetched transcript'),
    };
    config.getLastEpisode.mockResolvedValue({
      episodeNumber: 6,
      title: 'Episode 6',
      url: 'https://example.com/ep6',
    });

    await runPodcast(config, { dryMode: false, lang: 'english' });

    expect(config.getTranscription).toHaveBeenCalledWith(expect.objectContaining({ episodeNumber: 6 }));
    expect(createPodcastResumePrompt).toHaveBeenCalledWith(
      'Test Podcast',
      'Episode 6',
      'Fetched transcript',
      'https://example.com/ep6',
      'english'
    );
  });

  it('should use getEpisodeUrl when provided', async () => {
    const config = {
      ...baseConfig,
      getEpisodeUrl: (ep) => `https://custom.com/${ep.episodeNumber}`,
    };
    config.getLastEpisode.mockResolvedValue({
      episodeNumber: 6,
      title: 'Episode 6',
      transcript: 'Text',
    });

    await runPodcast(config, { dryMode: false, lang: 'french' });

    expect(createPodcastResumePrompt).toHaveBeenCalledWith(
      'Test Podcast',
      'Episode 6',
      'Text',
      'https://custom.com/6',
      'french'
    );
  });

  it('should respect preCheck returning false', async () => {
    const config = {
      ...baseConfig,
      preCheck: () => false,
    };

    await runPodcast(config, { dryMode: false, lang: 'english' });

    expect(config.getLastEpisode).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    baseConfig.getLastEpisode.mockRejectedValue(new Error('Network error'));

    await runPodcast(baseConfig, { dryMode: false, lang: 'english' });

    expect(logger.error).toHaveBeenCalledWith('Error sending Test Podcast resume', { error: 'Network error' });
  });

  it('should not pass content to relevance when no transcript in episode', async () => {
    baseConfig.getLastEpisode.mockResolvedValue({
      episodeNumber: 6,
      title: 'Episode 6',
      url: 'https://example.com/ep6',
    });
    const config = {
      ...baseConfig,
      getTranscription: jest.fn().mockResolvedValue('Later transcript'),
    };

    await runPodcast(config, { dryMode: false, lang: 'english' });

    expect(evaluateRelevance).toHaveBeenCalledWith({
      title: 'Episode 6',
      source: 'podcast episode',
    });
  });
});
