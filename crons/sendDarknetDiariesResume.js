const { runPodcast } = require('./utils/podcastRunner');
const cheerio = require('cheerio');

const getLastEpisode = async () => {
  const response = await fetch('https://darknetdiaries.com/episode/');
  const html = await response.text();
  const $ = cheerio.load(html);
  const episodeElement = $('h2').first();
  const title = episodeElement.text();
  const episodeNumber = parseInt(title.match(/\d+/)[0]);

  return {
    title,
    episodeNumber,
    url: `https://darknetdiaries.com/episode/${episodeNumber}/`,
  };
};

const getTranscription = async (episode) => {
  const response = await fetch(`https://darknetdiaries.com/transcript/${episode.episodeNumber}/`);
  const html = await response.text();
  const $ = cheerio.load(html);
  return $('pre').first().text();
};

const run = ({ dryMode, lang }) =>
  runPodcast(
    {
      name: 'Darknet Diaries',
      assetFile: 'assets/processedDD.json',
      getLastEpisode,
      getTranscription,
    },
    { dryMode, lang }
  );

module.exports = { run };
