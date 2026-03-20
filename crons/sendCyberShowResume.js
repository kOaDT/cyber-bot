const { runPodcast } = require('./utils/podcastRunner');
const cheerio = require('cheerio');
const { AssemblyAI } = require('assemblyai');
const fs = require('fs').promises;
const logger = require('./config/logger');

const PROTOCOL = process.env.CYBERSHOW_PROTOCOL || 'https://';

const getLastEpisode = async () => {
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

const getTranscription = async (episode) => {
  const tempFilePath = `./temp-audio-${Date.now()}.mp3`;

  try {
    const audioResponse = await fetch(`${PROTOCOL}cybershow.uk/${episode.audioUrl}`);
    const audioBuffer = await audioResponse.arrayBuffer();
    await fs.writeFile(tempFilePath, Buffer.from(audioBuffer));

    const client = new AssemblyAI({
      apiKey: process.env.ASSEMBLYAI_API_KEY,
    });
    const transcript = await client.transcripts.transcribe({ audio: tempFilePath });

    if (transcript.status === 'completed') {
      return transcript.text;
    }
    throw new Error(`The transcription failed with the status: ${transcript.status}`);
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
};

const run = ({ dryMode, lang }) =>
  runPodcast(
    {
      name: 'The Cyber Show',
      assetFile: 'assets/processedCyberShow.json',
      getLastEpisode,
      getTranscription,
      getEpisodeUrl: (episode) => `${PROTOCOL}cybershow.uk/episodes.php?id=${episode.episodeNumber}`,
      preCheck: () => {
        if (!process.env.ASSEMBLYAI_API_KEY) {
          logger.error('ASSEMBLYAI_API_KEY is not set');
          return false;
        }
        return true;
      },
    },
    { dryMode, lang }
  );

module.exports = { run };
