const logger = require('./config/logger');
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

// Browser-like UA so YouTube serves the full channel page / feed.
const YT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const decodeEntities = (str) =>
  str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

// Resolve the UC… channel id from a handle URL (e.g. youtube.com/@NoLimitSecu).
async function resolveChannelId(channelUrl) {
  const direct = channelUrl.match(/channel\/(UC[\w-]+)/);
  if (direct) return direct[1];

  const res = await fetch(channelUrl, { headers: { 'User-Agent': YT_UA, 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(`channel page HTTP ${res.status}`);
  const html = await res.text();
  const m = html.match(/"channelId":"(UC[\w-]+)"/) || html.match(/channel\/(UC[\w-]+)/);
  if (!m) throw new Error('could not resolve channelId from channel page');
  return m[1];
}

async function getLatestVideo(channelUrl) {
  try {
    const channelId = await resolveChannelId(channelUrl);
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
      headers: { 'User-Agent': YT_UA, 'Accept-Language': 'en' },
    });
    if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);

    const xml = await res.text();
    const entry = xml.split('<entry>')[1] || '';
    const id = (entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    if (!id) throw new Error('No videos found in channel feed');
    const title = (entry.match(/<title>([^<]+)<\/title>/) || [])[1] || '';

    return {
      url: `https://www.youtube.com/watch?v=${id}`,
      title: decodeEntities(title),
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
