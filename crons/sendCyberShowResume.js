const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const { generate } = require('./utils/generate');
const { createPodcastResumePrompt } = require('./utils/prompts');
const { evaluateRelevance } = require('./utils/relevance');
const fs = require('fs').promises;
const cheerio = require('cheerio');
const { AssemblyAI } = require('assemblyai');

const PROTOCOL = process.env.CYBERSHOW_PROTOCOL || 'https://';

/**
 * Get the last episode of the podcast
 * @returns {Object} The last episode of the podcast
 */
const getLastCyberShowEpisode = async () => {
  const response = await fetch(`${PROTOCOL}cybershow.uk/episodes.php`);
  const html = await response.text();
  const $ = cheerio.load(html);
  const episodeElement = $('.card-body.details').first();
  const title = episodeElement.find('h2').first().text();
  const parentCard = episodeElement.closest('.card');
  const audioUrl = parentCard.find('.card-footer a[href$=".mp3"]').attr('href');
  const episodeNumber = parseInt(title.split(' ')[0].replace('#', ''));

  return {
    episodeNumber,
    title,
    audioUrl,
  };
};

/**
 * Get the last processed episode
 * @returns {Object} The last processed episode
 */
const getLastProcessedEpisode = async () => {
  try {
    const data = await fs.readFile('assets/processedCyberShow.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.warn('No last processed episode found, creating a new one', { error: error.message });
    return { episodeNumber: 0 };
  }
};

/**
 * Save the last processed episode
 * @param {Object} episodeData - The episode data
 */
const saveLastProcessedEpisode = async (episodeData) => {
  await fs.writeFile(
    'assets/processedCyberShow.json',
    JSON.stringify({
      episodeNumber: episodeData.episodeNumber,
      processedAt: new Date().toISOString(),
    })
  );
};

/**
 * Get the transcription of the episode with AssemblyAI
 * @param {string} audioUrl - The audio url
 * @returns {string} The transcription of the episode
 */
const getTranscription = async (audioUrl) => {
  const tempFilePath = `./temp-audio-${Date.now()}.mp3`;
  let transcriptionText = '';

  try {
    // Download the audio
    const audioResponse = await fetch(`${PROTOCOL}cybershow.uk/${audioUrl}`);
    const audioBuffer = await audioResponse.arrayBuffer();
    await fs.writeFile(tempFilePath, Buffer.from(audioBuffer));

    // Initialize AssemblyAI and transcribe the audio
    const client = new AssemblyAI({
      apiKey: process.env.ASSEMBLYAI_API_KEY,
    });
    const data = {
      audio: tempFilePath,
    };
    const transcript = await client.transcripts.transcribe(data);

    if (transcript.status === 'completed') {
      transcriptionText = transcript.text;
    } else {
      throw new Error(`The transcription failed with the status: ${transcript.status}`);
    }
  } catch (error) {
    logger.error('Error transcribing', { error: error.message });
    throw error;
  } finally {
    try {
      await fs.unlink(tempFilePath);
      logger.info(`Temporary file ${tempFilePath} deleted successfully`);
    } catch (deleteError) {
      logger.error(`Failed to delete temporary file ${tempFilePath}`, { error: deleteError.message });
    }
  }

  return transcriptionText;
};

const run = async ({ dryMode, lang }) => {
  if (!process.env.ASSEMBLYAI_API_KEY) {
    logger.error('ASSEMBLYAI_API_KEY is not set');
    return;
  }

  try {
    const lastEpisode = await getLastCyberShowEpisode();
    const lastProcessed = await getLastProcessedEpisode();

    if (lastEpisode.episodeNumber > lastProcessed.episodeNumber) {
      logger.info(`New episode found`, { episodeNumber: lastEpisode.episodeNumber });

      const { relevant } = await evaluateRelevance({
        title: lastEpisode.title,
        source: 'podcast episode',
      });

      if (!relevant) {
        await saveLastProcessedEpisode(lastEpisode);
        return;
      }

      const transcription = await getTranscription(lastEpisode.audioUrl);
      const prompt = createPodcastResumePrompt(
        'The Cyber Show',
        lastEpisode.title,
        transcription,
        `${PROTOCOL}cybershow.uk/episodes.php?id=${lastEpisode.episodeNumber}`,
        lang
      );
      const summary = await generate(prompt);

      if (!dryMode) {
        await saveLastProcessedEpisode(lastEpisode);
        await sendMessage(summary, process.env.TELEGRAM_TOPIC_PODCAST);
      } else {
        logger.info('Dry mode: No message sent', { summary });
      }
    } else {
      logger.info('No new episode to process');
    }
  } catch (error) {
    logger.error('Error sending Cyber Show resume', { error: error.message });
  }
};

module.exports = { run };
