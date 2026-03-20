const { runPodcast } = require('./utils/podcastRunner');
const { BrowserManager } = require('./utils/puppeteerUtils');

const getLastEpisode = async () => {
  const browser = await new BrowserManager().init();

  try {
    await browser.navigateTo('https://twit.tv/posts/transcripts');
    const episodeLink = await browser.page.evaluate(() => {
      const titles = Array.from(document.querySelectorAll('.title a'));
      const securityNowLink = titles.find((link) => link.textContent.includes('Security Now'));
      return securityNowLink ? securityNowLink.getAttribute('href') : null;
    });

    if (!episodeLink) {
      throw new Error('No Security Now episode found');
    }

    await browser.navigateTo(`https://twit.tv${episodeLink}`);
    const transcript = await browser.getText('.body.textual');
    const episodeNumber = parseInt(episodeLink.match(/\d+/)?.[0]);

    return {
      episodeNumber,
      title: `Security Now ${episodeNumber}`,
      transcript,
      url: `https://twit.tv${episodeLink}`,
    };
  } finally {
    await browser.close();
  }
};

const run = ({ dryMode, lang }) =>
  runPodcast(
    {
      name: 'Security Now',
      assetFile: 'assets/processedSecurityNow.json',
      getLastEpisode,
    },
    { dryMode, lang }
  );

module.exports = { run };
