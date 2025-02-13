const { onError } = require('./config/errors');
const logger = require('./config/logger');
const { YoutubeTranscript } = require('youtube-transcript');
const youtubedl = require('youtube-dl-exec');
const { createYoutubeResumePrompt } = require('./utils/prompts');
const { sendMessage } = require('./utils/sendMessage');
const { generate } = require('./utils/generate');
const fs = require('fs').promises;

/**
 * Fetches the transcript of a YouTube video
 * @param {string} videoId - The YouTube video ID
 * @returns {Promise<string>} The concatenated transcript text
 * @throws {Error} If the transcript cannot be fetched
 */
async function getVideoTranscript(videoId) {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript.map((t) => t.text).join(' ');
  } catch (error) {
    throw new Error(`Failed to fetch transcript for video ${videoId}: ${error.message}`);
  }
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
 * Fetches the latest video URL from a YouTube channel
 * @param {string} channelUrl - The YouTube channel URL
 * @returns {Promise<string>} The URL of the latest video
 * @throws {Error} If the channel or video cannot be fetched
 */
async function getLatestVideoUrl(channelUrl) {
  try {
    const output = await youtubedl(channelUrl + '/videos', {
      dumpSingleJson: true,
      flatPlaylist: true,
      playlistEnd: 1,
    });

    if (!output.entries || output.entries.length === 0) {
      throw new Error('No videos found in channel');
    }

    return `https://www.youtube.com/watch?v=${output.entries[0].id}`;
  } catch (error) {
    throw new Error(`Failed to fetch latest video from channel: ${error.message}`);
  }
}

/**
 * Get the last processed episode
 * @param {string} channel - The channel name
 * @returns {Object} The last processed episode
 */
const getLastProcessedEpisode = async (channel) => {
  try {
    const data = await fs.readFile('assets/lastProcessedYT.json', 'utf8');
    const content = JSON.parse(data);
    return content[channel] || { videoId: null };
  } catch (error) {
    logger.warn('No last processed episode found, creating a new one:' + error.message);
    return { [channel]: { videoId: null } };
  }
};

/**
 * Save the last processed episode
 * @param {string} channel - The channel name
 * @param {Object} episodeData - The episode data
 */
const saveLastProcessedEpisode = async (channel, episodeData) => {
  try {
    let content = {};
    try {
      const data = await fs.readFile('assets/lastProcessedYT.json', 'utf8');
      content = JSON.parse(data);
    } catch (error) {
      // If file doesn't exist or is invalid, start with empty object
      logger.warn('Could not read existing data, starting fresh:', error.message);
    }

    content[channel] = {
      videoId: episodeData,
      processedAt: new Date().toISOString(),
    };

    await fs.writeFile('assets/lastProcessedYT.json', JSON.stringify(content, null, 2));
  } catch (error) {
    throw new Error(`Failed to save last processed episode: ${error.message}`);
  }
};

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
    const latestVideoUrl = await getLatestVideoUrl(youtube);
    logger.info(`Processing latest video: ${latestVideoUrl}`);

    const videoId = extractVideoId(latestVideoUrl);
    const lastProcessedEpisode = await getLastProcessedEpisode(channelName);

    if (lastProcessedEpisode.videoId === videoId) {
      logger.info(`Latest video already processed, skipping`);
      return;
    }

    const transcriptText = await getVideoTranscript(videoId);

    logger.info(`Transcript fetched successfully`);

    const prompt = createYoutubeResumePrompt(channelName, videoId, transcriptText, lang);
    logger.info(`Prompt created successfully`);

    const summary = await generate(prompt);
    logger.info(`Summary created successfully`);

    if (dryMode) {
      logger.info(`Dry mode enabled, skipping summary sending`);
      logger.info(`Summary: ${summary}`);
      return;
    }
    await sendMessage(summary);

    await saveLastProcessedEpisode(channelName, videoId);
  } catch (error) {
    onError(error, 'Error processing the YouTube video');
  }
}

module.exports = { run };
