const { onError } = require('./config/errors');
const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const { createCVEsPrompt } = require('./utils/prompts');
const { generate } = require('./utils/generate');

// Constants
const NVD_API_BASE_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const RESULTS_PER_PAGE = 2000;
const CVSS_SEVERITY_THRESHOLD = process.env.CVSS_SEVERITY_THRESHOLD || 7.0;
const RATE_LIMIT_DELAY = 1000; // 1 second
const HOURS_DELAY = process.env.HOURS_DELAY || 24;

/**
 * Formats a date according to NVD API requirements (YYYY-MM-ddTHH:mm:ss.SSS+/-ZZ:ZZ)
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
const formatDateForNVD = (date) => {
  const pad = (num) => String(num).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const offsetHours = pad(Math.floor(Math.abs(offset) / 60));
  const offsetMinutes = pad(Math.abs(offset) % 60);
  const offsetSign = offset >= 0 ? '+' : '-';

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.000` +
    `${offsetSign}${offsetHours}:${offsetMinutes}`
  );
};

/**
 * Creates search parameters for the NVD API query
 * @returns {URLSearchParams} URL search parameters
 */
const createSearchParams = () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - HOURS_DELAY * 60 * 60 * 1000);

  return new URLSearchParams({
    pubStartDate: formatDateForNVD(yesterday),
    pubEndDate: formatDateForNVD(now),
    resultsPerPage: RESULTS_PER_PAGE.toString(),
    startIndex: '0',
  });
};

/**
 * Fetches a single page of CVE data from the NVD API
 * @param {string} url - The API URL with search parameters
 * @returns {Promise<Object>} The API response data
 * @throws {Error} If the API request fails
 */
const fetchCVEPage = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

/**
 * Fetches all CVEs from the NVD API for the last 24 hours
 * @see https://nvd.nist.gov/developers/vulnerabilities
 *
 * @returns {Promise<Array>} Array of CVEs
 */
const fetchCVEs = async () => {
  const searchParams = createSearchParams();
  let allCVEs = [];
  let hasMoreResults = true;

  while (hasMoreResults) {
    try {
      const url = `${NVD_API_BASE_URL}?${searchParams.toString()}`;
      const data = await fetchCVEPage(url);

      if (data.vulnerabilities) {
        allCVEs = allCVEs.concat(data.vulnerabilities);
      }

      hasMoreResults = allCVEs.length < data.totalResults;
      if (hasMoreResults) {
        const nextIndex = parseInt(searchParams.get('startIndex')) + RESULTS_PER_PAGE;
        searchParams.set('startIndex', nextIndex.toString());
      }

      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
    } catch (error) {
      logger.error('Error fetching CVEs:', error.message);
      throw error;
    }
  }

  return allCVEs;
};

/**
 * Calculates the CVSS score for a CVE
 * @param {Object} metrics - The CVE metrics object
 * @returns {number} The CVSS score (prioritizing V3 over V2)
 */
const getCVSSScore = (metrics) => {
  const cvssV3 = metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore;
  const cvssV2 = metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore;
  return cvssV3 || cvssV2 || 0;
};

/**
 * Enriches CVE data with severity information and sorts by severity
 * @param {Array} cves - Array of CVE objects
 * @returns {Array} Enriched and sorted CVE objects
 */
const enrichAndSortCVEs = (cves) => {
  return cves
    .map((cve) => ({
      ...cve,
      severity: getCVSSScore(cve.cve.metrics),
    }))
    .sort((a, b) => b.severity - a.severity);
};

/**
 * Formats CVE data for the prompt
 * @param {Array} cves - Array of enriched CVE objects
 * @returns {Array} Formatted CVE entries
 */
const formatCVEsForPrompt = (cves) => {
  return cves.map((cve) => {
    const { id, descriptions } = cve.cve;
    const description = descriptions.find((d) => d.lang === 'en')?.value || 'No description available';
    return {
      id,
      description,
      severity: cve.severity.toFixed(1),
    };
  });
};

/**
 * Filters CVEs to only include severe ones based on CVSS threshold
 * @param {Array} cves - Array of CVEs to filter
 * @returns {Array} Filtered array of severe CVEs
 */
const filterSevereCVEs = (cves) => {
  return cves.filter((cve) => {
    const severity = getCVSSScore(cve.cve.metrics);
    return cve.cve.vulnStatus === 'Received' && severity >= CVSS_SEVERITY_THRESHOLD;
  });
};

/**
 * Creates the message to be sent with CVE information
 * @param {Array} severeCves - Array of severe CVEs
 * @param {string} lang - Language for the CVE descriptions
 * @returns {Promise<string>} Formatted message
 */
const createCVEMessage = async (severeCves, lang) => {
  const enrichedCves = enrichAndSortCVEs(severeCves);
  const formattedCves = formatCVEsForPrompt(enrichedCves);

  const header =
    // eslint-disable-next-line max-len
    `🔍 ${severeCves.length} new CVEs (CVSS ≥ ${CVSS_SEVERITY_THRESHOLD}) have been published in the last ${HOURS_DELAY} hours:\n\n`;
  const prompt = createCVEsPrompt(formattedCves, lang);
  const formattedCVEs = await generate(prompt);
  return header + formattedCVEs;
};

/**
 * Main function to fetch and process CVEs
 * @param {Object} options - Configuration options
 * @param {boolean} options.dryMode - Whether to run in dry mode (no actual message sending)
 * @param {string} options.lang - Language for CVE descriptions
 */
const run = async ({ dryMode, lang }) => {
  try {
    const cves = await fetchCVEs();

    if (cves.length === 0) {
      logger.info('No new CVEs found in the last 24 hours');
      return;
    }

    const severeCves = filterSevereCVEs(cves);
    if (severeCves.length === 0) {
      logger.info('No severe CVEs found in the last 24 hours');
      return;
    }
    logger.info(`Found ${cves.length} new CVEs in the last 24 hours, ${severeCves.length} are severe (CVSS ≥ 7.0)`);

    const message = await createCVEMessage(severeCves, lang);

    if (dryMode) {
      logger.info(`Would send Telegram message: ${message}`);
      return;
    }

    await sendMessage(message, process.env.TELEGRAM_TOPIC_CVE);
    logger.info('CVE message sent successfully');
  } catch (err) {
    onError(err, 'run');
  }
};

module.exports = { run };
