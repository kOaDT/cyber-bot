const logger = require('./config/logger');
const youtubedl = require('youtube-dl-exec');
const { Supadata } = require('@supadata/js');
const { createYoutubeResumePrompt } = require('./utils/prompts');
const { createKeyedStore } = require('./utils/processedItems');
const { runContentJob } = require('./utils/contentRunner');

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
  const channelName = youtube.split('/').pop();

  await runContentJob(
    {
      name: 'YouTube video',
      source: 'YouTube video',
      topicId: process.env.TELEGRAM_TOPIC_YOUTUBE,
      maxItems: 1,
      maxCandidates: 1,

      async fetchItems() {
        const latestVideo = await getLatestVideo(youtube);
        logger.info('Processing latest video', { latestVideoUrl: latestVideo.url });

        const videoId = extractVideoId(latestVideo.url);
        return [{ title: latestVideo.title, videoId, channelName }];
      },

      async filterNew(items) {
        const lastProcessed = await store.load(channelName);
        return items.filter((item) => lastProcessed.videoId !== item.videoId);
      },

      async enrichItem(item) {
        const transcriptText = await getVideoTranscript(item.videoId);
        logger.info('Transcript fetched successfully');
        return { ...item, transcriptText };
      },

      createPrompt(item, lng) {
        return createYoutubeResumePrompt(item.channelName, item.videoId, item.transcriptText, lng);
      },

      async saveProcessed(item) {
        await store.save(channelName, { videoId: item.videoId });
      },
    },
    { dryMode, lang }
  );
}

module.exports = { run };
