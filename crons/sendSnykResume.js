const { runPodcast } = require('./utils/podcastRunner');
const { BrowserManager } = require('./utils/puppeteerUtils');

const getLastEpisode = async () => {
  const browser = await new BrowserManager().init();

  try {
    await browser.navigateTo('https://snyk.io/podcasts/the-secure-developer/');
    const episodeLink = await browser.getAttributeValue('article a[title="View episode"]', 'href');
    await browser.navigateTo(`https://snyk.io${episodeLink}`);
    await browser.clickAndWait('button[title="View transcript"]', { waitForSelector: '.marg-t-extra-large .txt-rich' });
    const transcript = await browser.getText('.marg-t-extra-large .txt-rich');
    const pageTitle = await browser.getPageTitle();
    const episodeNb = pageTitle.match(/\d+/)?.[0];
    const title = await browser.getText('h1');

    return {
      episodeNumber: parseInt(episodeNb),
      title,
      transcript,
      url: `https://snyk.io${episodeLink}`,
    };
  } finally {
    await browser.close();
  }
};

const run = ({ dryMode, lang }) =>
  runPodcast(
    {
      name: 'Snyk',
      assetFile: 'assets/processedSnyk.json',
      getLastEpisode,
    },
    { dryMode, lang }
  );

module.exports = { run };
