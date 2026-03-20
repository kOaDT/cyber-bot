const logger = require('./config/logger');
const youtubedl = require('youtube-dl-exec');
const { Supadata } = require('@supadata/js');
const { createYoutubeResumePrompt } = require('./utils/prompts');
const { sendMessage } = require('./utils/sendMessage');
const { generate } = require('./utils/generate');
const { evaluateRelevance } = require('./utils/relevance');
const { createKeyedStore } = require('./utils/processedItems');

const store = createKeyedStore('assets/processedYT.json');

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

function extractVideoId(url) {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);

  if (!match) {
    throw new Error('Invalid YouTube URL');
  }

  return match[1];
}

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

async function run({ dryMode, lang, youtube }) {
  try {
    const channelName = youtube.split('/').pop();
    const latestVideo = await getLatestVideo(youtube);
    logger.info('Processing latest video', { latestVideoUrl: latestVideo.url });

    const videoId = extractVideoId(latestVideo.url);
    const lastProcessed = await store.load(channelName);

    if (lastProcessed.videoId === videoId) {
      logger.info('Latest video already processed, skipping');
      return;
    }

    const { relevant } = await evaluateRelevance({
      title: latestVideo.title,
      source: 'YouTube video',
    });

    if (!relevant) {
      await store.save(channelName, { videoId });
      return;
    }

    await store.save(channelName, { videoId });

    const transcriptText = await getVideoTranscript(videoId);
    logger.info('Transcript fetched successfully');

    const prompt = createYoutubeResumePrompt(channelName, videoId, transcriptText, lang);
    const summary = await generate(prompt);
    logger.info('Summary created successfully');

    if (dryMode) {
      logger.info('Dry mode: No message sent', { summary });
      return;
    }

    await sendMessage(summary, process.env.TELEGRAM_TOPIC_YOUTUBE);
  } catch (error) {
    logger.error('Error sending Youtube resume', { error: error.message });
  }
}

module.exports = { run };
