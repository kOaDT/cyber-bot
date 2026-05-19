const { runPodcast } = require('./utils/podcastRunner');
const RSSParser = require('rss-parser');
const { AssemblyAI } = require('assemblyai');
const fs = require('fs').promises;
const logger = require('./config/logger');

const FEED_URL = process.env.CYBERSHOW_FEED_URL || 'https://cybershow.uk/rss/feed.xml';
const AUDIO_CATEGORIES = new Set(['audio-episode', 'audio-only']);
const ALLOWED_AUDIO_HOST = 'cybershow.uk';

const assertTrustedAudioUrl = (rawUrl) => {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid audio URL: ${rawUrl}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`Refused non-https audio URL: ${rawUrl}`);
  }
  if (parsed.hostname !== ALLOWED_AUDIO_HOST && !parsed.hostname.endsWith(`.${ALLOWED_AUDIO_HOST}`)) {
    throw new Error(`Refused audio URL outside ${ALLOWED_AUDIO_HOST}: ${rawUrl}`);
  }
  return parsed.toString();
};

const getLastEpisode = async () => {
  const parser = new RSSParser({
    customFields: {
      item: [['enclosure', 'enclosures', { keepArray: true }]],
    },
  });
  const feed = await parser.parseURL(FEED_URL);

  const audioEpisodes = feed.items
    .filter((item) => (item.categories || []).some((c) => AUDIO_CATEGORIES.has(c)))
    .sort((a, b) => new Date(b.isoDate) - new Date(a.isoDate));

  const latest = audioEpisodes[0];
  if (!latest) {
    throw new Error('No audio episodes found in The Cyber Show feed');
  }

  const audioEnclosure = (latest.enclosures || []).find((e) => e?.$?.type?.startsWith('audio/'));
  if (!audioEnclosure) {
    throw new Error(`No audio enclosure found for episode "${latest.title}"`);
  }

  return {
    id: (latest.guid || latest.link || '').trim(),
    title: latest.title.trim(),
    audioUrl: assertTrustedAudioUrl(audioEnclosure.$.url),
    url: latest.link,
  };
};

const getTranscription = async (episode) => {
  const tempFilePath = `./temp-audio-${Date.now()}.mp3`;

  try {
    const audioResponse = await fetch(episode.audioUrl);
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
