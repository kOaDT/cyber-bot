const logger = require('./config/logger');
const youtubedl = require('youtube-dl-exec');
const { Supadata } = require('@supadata/js');
const { createYoutubeResumePrompt } = require('./utils/prompts');
const { sendMessage } = require('./utils/sendMessage');
const { generate } = require('./utils/generate');
const { evaluateRelevance } = require('./utils/relevance');
const fs = require('fs').promises;

/**
 * Fetches the transcript of a YouTube video using Supadata
 * @param {string} videoId - The YouTube video ID
 * @returns {Promise<string>} The transcript text
 * @throws {Error} If the transcript cannot be fetched
 */
async function getVideoTranscript(videoId) {
  if (!process.env.SUPADATA_KEY) {
    throw new Error('SUPADATA_KEY environment variable is not set');
  }

  const supadata = new Supadata({
    apiKey: process.env.SUPADATA_KEY,
  });

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  let transcriptResult = await supadata.transcript({
    url: videoUrl,
    lang: 'en',
    text: true,
    mode: 'native',
  });

  if (transcriptResult.jobId || !transcriptResult.content) {
    logger.info('Native transcript not available, trying auto mode', { videoId });
    transcriptResult = await supadata.transcript({
      url: videoUrl,
      lang: 'en',
      text: true,
      mode: 'auto',
    });
  }

  if (transcriptResult.jobId) {
    logger.info('Polling for async job completion', {
      videoId,
      jobId: transcriptResult.jobId,
    });

    const startTime = Date.now();
    const timeout = 60000;
    const pollInterval = 2000;

    while (Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const jobResult = await supadata.transcript.getJobStatus(transcriptResult.jobId);

      if (jobResult.status === 'completed') {
        if (!jobResult.content || jobResult.content.length === 0) {
          throw new Error('Job completed but transcript content is empty');
        }
        return jobResult.content;
      }

      if (jobResult.status === 'failed') {
        throw new Error(`Job failed: ${jobResult.error || 'Unknown error'}`);
      }
    }

    throw new Error('Job did not complete within timeout');
  }

  if (!transcriptResult.content || transcriptResult.content.length === 0) {
    throw new Error('No transcript content received from Supadata');
  }

  return transcriptResult.content;
}

/**
 * Extracts video ID from a YouTube URL
 * @param {string} url - The full YouTube video URL
 * @returns {string} The video ID
 * @throws {Error} If the URL is invalid
 */
function extractVideoId(url) {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);

  if (!match) {
    throw new Error('Invalid YouTube URL');
  }

  return match[1];
}

/**
 * Fetches the latest video metadata from a YouTube channel
 * @param {string} channelUrl - The YouTube channel URL
 * @returns {Promise<{url: string, title: string}>} The URL and title of the latest video
 * @throws {Error} If the channel or video cannot be fetched
 */
async function getLatestVideo(channelUrl) {
  try {
    const output = await youtubedl(channelUrl + '/videos', {
      dumpSingleJson: true,
      flatPlaylist: true,
      playlistEnd: 1,
    });

    if (!output.entries || output.entries.length === 0) {
      throw new Error('No videos found in channel');
    }

    const entry = output.entries[0];
    return {
      url: `https://www.youtube.com/watch?v=${entry.id}`,
      title: entry.title || '',
    };
  } catch (error) {
    throw new Error(`Failed to fetch latest video from channel: ${error.message}`);
  }
}

/**
 * Get the last processed episode
 * @param {string} channel - The channel name
 * @returns {Promise<Object>} The last processed episode
 */
async function getLastProcessedEpisode(channel) {
  try {
    const data = await fs.readFile('assets/processedYT.json', 'utf8');
    const content = JSON.parse(data);
    return content[channel] || { videoId: null };
  } catch (error) {
    logger.warn('No last processed episode found, creating a new one', {
      error: error.message,
    });
    return { [channel]: { videoId: null } };
  }
}

/**
 * Save the last processed episode
 * @param {string} channel - The channel name
 * @param {Object} episodeData - The episode data
 */
async function saveLastProcessedEpisode(channel, episodeData) {
  try {
    let content = {};
    try {
      const data = await fs.readFile('assets/processedYT.json', 'utf8');
      content = JSON.parse(data);
    } catch (error) {
      logger.warn('Could not read existing data, starting fresh', {
        error: error.message,
      });
    }

    content[channel] = {
      videoId: episodeData,
      processedAt: new Date().toISOString(),
    };

    await fs.writeFile('assets/processedYT.json', JSON.stringify(content, null, 2));
  } catch (error) {
    throw new Error(`Failed to save last processed episode: ${error.message}`);
  }
}

/**
 * Main function to process YouTube videos and generate transcripts
 * @param {Object} options - The options object
 * @param {boolean} options.dryMode - Whether to run in dry mode
 * @param {string} options.lang - The language code
 * @param {string} options.youtube - The YouTube channel URL
 * @returns {Promise<void>}
 */
async function run({ dryMode, lang, youtube }) {
  try {
    const channelName = youtube.split('/').pop();
    const latestVideo = await getLatestVideo(youtube);
    logger.info(`Processing latest video`, { latestVideoUrl: latestVideo.url });

    const videoId = extractVideoId(latestVideo.url);
    const lastProcessedEpisode = await getLastProcessedEpisode(channelName);

    if (lastProcessedEpisode.videoId === videoId) {
      logger.info(`Latest video already processed, skipping`);
      return;
    }

    const { relevant } = await evaluateRelevance({
      title: latestVideo.title,
      source: 'YouTube video',
    });

    if (!relevant) {
      await saveLastProcessedEpisode(channelName, videoId);
      return;
    }

    await saveLastProcessedEpisode(channelName, videoId);

    const transcriptText = await getVideoTranscript(videoId);

    logger.info(`Transcript fetched successfully`);

    const prompt = createYoutubeResumePrompt(channelName, videoId, transcriptText, lang);

    const summary = await generate(prompt);
    logger.info(`Summary created successfully`);

    if (dryMode) {
      logger.info(`Dry mode enabled, skipping summary sending`, { summary });
      return;
    }

    await sendMessage(summary, process.env.TELEGRAM_TOPIC_YOUTUBE);
  } catch (error) {
    logger.error('Error sending Youtube resume', { error: error.message });
  }
}

module.exports = { run };
