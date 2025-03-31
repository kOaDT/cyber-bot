/* eslint-disable max-len */
const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');

// Constants
const NVD_API_BASE_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const RESULTS_PER_PAGE = 2000;
const CVSS_SEVERITY_THRESHOLD = parseFloat(process.env.CVSS_SEVERITY_THRESHOLD || 7.0);
const RATE_LIMIT_DELAY = 1000; // 1 second
const HOURS_DELAY = parseInt(process.env.HOURS_DELAY || 24);

// configuration
const TECHNOLOGIES_OF_INTEREST = (
  process.env.TECHNOLOGIES_OF_INTEREST ||
  'Windows,Linux,Cisco,VMware,Azure,AWS,Kubernetes,Docker,Apache,Nginx,NodeJS,Python,PHP,Java,WordPress,Javascript,Next.js,React,Vue,Svelte,Laravel,Ruby,Go,Swift,Kotlin,Rust'
).split(',');

// types of vulnerabilities to monitor in priority
const VULNERABILITY_KEYWORDS = {
  'Remote Code Execution': ['remote code', 'rce', 'command execution', 'arbitrary code', 'execute code'],
  'Privilege Escalation': ['privilege', 'escalation', 'elevation', 'admin', 'root', 'sudo'],
  'Information Disclosure': ['information disclosure', 'leak', 'sensitive data', 'data exposure', 'confidential'],
  'Authentication Bypass': ['authentication', 'bypass', 'auth', 'login', 'credentials'],
  'Denial of Service': ['denial of service', 'dos', 'availability', 'crash', 'flood'],
  Injection: ['injection', 'sql', 'xss', 'cross-site', 'script', 'command injection'],
  'Zero-day': ['zero-day', 'zero day', '0-day', 'unpatched', 'no patch'],
  Other: [],
};

// List of emojis by category for a more visual formatting
const CATEGORY_EMOJIS = {
  'Remote Code Execution': '⚡',
  'Privilege Escalation': '🔑',
  'Information Disclosure': '🔍',
  'Authentication Bypass': '🚪',
  'Denial of Service': '💥',
  Injection: '💉',
  'Zero-day': '🔥',
  Other: '⚠️',
};

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
  const past = new Date(now.getTime() - HOURS_DELAY * 60 * 60 * 1000);

  return new URLSearchParams({
    pubStartDate: formatDateForNVD(past),
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
 * Fetches all CVEs from the NVD API for the last HOURS_DELAY hours
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
      logger.error('Error fetching CVEs', { error: error.message });
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
 * Get the text severity of a CVE
 * @param {number} score - CVSS score
 * @returns {string} Description of the severity
 */
const getSeverityLabel = (score) => {
  if (score >= 9.0) return 'CRITICAL';
  if (score >= 7.0) return 'HIGH';
  if (score >= 4.0) return 'MEDIUM';
  return 'LOW';
};

/**
 * Check if a CVE corresponds to a technology of interest
 * @param {Object} cve - CVE object
 * @returns {boolean} True if the CVE concerns a technology of interest
 */
const matchesTechnologyOfInterest = (cve) => {
  // Extraction of relevant information from the CVE
  const description = cve.cve.descriptions.find((d) => d.lang === 'en')?.value || '';
  const configNodes = cve.cve.configurations?.[0]?.nodes || [];

  // Search in the description
  const descriptionMatch = TECHNOLOGIES_OF_INTEREST.some((tech) =>
    description.toLowerCase().includes(tech.toLowerCase())
  );

  if (descriptionMatch) return true;

  // Search in the CPE (Common Platform Enumeration)
  for (const node of configNodes) {
    const cpeMatches = node.cpeMatch || [];
    for (const cpeMatch of cpeMatches) {
      const criteria = cpeMatch.criteria || '';
      if (TECHNOLOGIES_OF_INTEREST.some((tech) => criteria.toLowerCase().includes(tech.toLowerCase()))) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Check if a CVE is potentially exploitable
 * @param {Object} cve - CVE object
 * @returns {Object} Exploitability information
 */
const getExploitabilityInfo = (cve) => {
  const references = cve.cve.references || [];

  // Known exploit sources
  const exploitSources = ['exploit-db.com', 'github.com', 'poc', 'proof of concept', 'metasploit'];

  // Search for exploit sources in references
  const exploitRefs = references.filter(
    (ref) => ref.tags?.includes('Exploit') || exploitSources.some((source) => ref.url.toLowerCase().includes(source))
  );

  return {
    hasExploit: exploitRefs.length > 0,
    exploitCount: exploitRefs.length,
    exploitLinks: exploitRefs.map((ref) => ref.url),
  };
};

/**
 * Enrich and categorize CVEs
 * @param {Array} cves - Array of CVE objects
 * @returns {Object} Object with enriched and categorized CVEs
 */
const processCVEs = (cves) => {
  // Enrichment
  const enrichedCves = cves.map((cve) => {
    const severity = getCVSSScore(cve.cve.metrics);
    const description = cve.cve.descriptions.find((d) => d.lang === 'en')?.value || 'No description available';
    const exploitInfo = getExploitabilityInfo(cve);

    return {
      ...cve,
      severity,
      severityLabel: getSeverityLabel(severity),
      description,
      exploitInfo,
      relevantToInterests: matchesTechnologyOfInterest(cve),
    };
  });

  // Filter by severity and interest
  const filteredCves = enrichedCves.filter(
    (cve) => cve.severity >= CVSS_SEVERITY_THRESHOLD && (process.env.FILTER_BY_TECH ? cve.relevantToInterests : true)
  );

  // Sort by severity
  const sortedCves = filteredCves.sort((a, b) => b.severity - a.severity);

  // Categorization
  const categorizedCves = {};

  // Initialize all categories
  Object.keys(VULNERABILITY_KEYWORDS).forEach((category) => {
    categorizedCves[category] = [];
  });

  // Categorize each CVE
  sortedCves.forEach((cve) => {
    let categorized = false;

    // Search for a match with the keywords
    Object.entries(VULNERABILITY_KEYWORDS).forEach(([category, keywords]) => {
      if (category === 'Other') return; // Skip 'Other' for now

      if (keywords.some((keyword) => cve.description.toLowerCase().includes(keyword))) {
        categorizedCves[category].push(cve);
        categorized = true;
      }
    });

    // If no category was found, put it in 'Other'
    if (!categorized) {
      categorizedCves['Other'].push(cve);
    }
  });

  return {
    all: sortedCves,
    categorized: categorizedCves,
  };
};

/**
 * Create a summary of CVEs
 * @param {Object} categorizedCves - Categorized CVEs
 * @returns {string} Formatted summary
 */
const createSummary = (categorizedCves) => {
  let summary = '📊 *VULNERABILITIES SUMMARY*\n\n';

  // Get all CVEs
  const allCves = Object.values(categorizedCves).flat();
  const exploitableCves = allCves.filter((cve) => cve.exploitInfo.hasExploit);
  const criticalCves = allCves.filter((cve) => cve.severity >= 9.0);

  // Add general statistics
  summary += `• *Total*: ${allCves.length} vulnerabilities\n`;
  if (criticalCves.length > 0) {
    summary += `• *Critical (CVSS ≥ 9.0)*: ${criticalCves.length}\n`;
  }
  if (exploitableCves.length > 0) {
    summary += `• *With potential exploit*: ${exploitableCves.length}\n`;
  }

  summary += '\n*By category:*\n';

  // Add statistics by category
  Object.entries(categorizedCves).forEach(([category, cves]) => {
    if (cves.length > 0) {
      summary += `• ${CATEGORY_EMOJIS[category]} *${category}*: ${cves.length}\n`;
    }
  });

  return summary;
};

/**
 * Create the detail of a CVE for the message
 * @param {Object} cve - Enriched CVE
 * @returns {string} Formatted detail
 */
const formatCVEDetail = (cve) => {
  // Create a short version of the description
  const shortDesc = cve.description.length > 150 ? `${cve.description.substring(0, 150)}...` : cve.description;

  // Build the message for this CVE
  let cveDetail = `*${cve.cve.id}* (CVSS: ${cve.severity.toFixed(1)} - ${cve.severityLabel})`;

  // Add exploit indicator if available
  if (cve.exploitInfo.hasExploit) {
    cveDetail += ` ⚠️ *POTENTIAL EXPLOIT*`;
  }

  // Add the description
  cveDetail += `\n${shortDesc}\n`;

  return cveDetail;
};

/**
 * Create the message to send
 * @param {Object} processedCVEs - Processed CVEs
 * @returns {string} Formatted message
 */
const createCVEMessage = (processedCVEs) => {
  const { categorized: categorizedCves } = processedCVEs;

  // Create the summary
  const summary = createSummary(categorizedCves);

  // Create the details by category
  let details = '';

  Object.entries(categorizedCves).forEach(([category, cves]) => {
    if (cves.length === 0) return;

    details += `\n\n${CATEGORY_EMOJIS[category]} *${category.toUpperCase()}* (${cves.length})\n`;
    details += `${'─'.repeat(30)}\n`;

    // Limit to 5 CVEs per category to avoid too long messages
    const displayCves = cves.slice(0, 5);
    const hiddenCount = cves.length - displayCves.length;

    displayCves.forEach((cve) => {
      details += `\n${formatCVEDetail(cve)}\n`;
    });

    if (hiddenCount > 0) {
      details += `\n_...and ${hiddenCount} other vulnerabilities in this category not displayed_\n`;
    }
  });

  // Add the footer
  const footer = `\n\n📚 More information and complete analyses on https://www.cyberhub.blog/cves`;

  return summary + details + footer;
};

/**
 * Filter CVEs based on severity and interest criteria
 * @param {Array} cves - CVEs to filter
 * @returns {Array} Filtered CVEs
 */
const filterCVEs = (cves) => {
  return cves.filter((cve) => {
    const severity = getCVSSScore(cve.cve.metrics);
    return severity >= CVSS_SEVERITY_THRESHOLD;
  });
};

/**
 * Main function to fetch and process CVEs
 * @param {Object} options - Configuration options
 * @param {boolean} options.dryMode - Whether to run in dry mode (no actual message sending)
 */
const run = async ({ dryMode }) => {
  try {
    // Fetch CVEs
    const cves = await fetchCVEs();

    if (cves.length === 0) {
      logger.info(`No new CVEs found in the last ${HOURS_DELAY} hours`);
      return;
    }

    // Filter by severity
    const severeCves = filterCVEs(cves);
    if (severeCves.length === 0) {
      logger.info(`No severe CVEs found in the last ${HOURS_DELAY} hours (CVSS ≥ ${CVSS_SEVERITY_THRESHOLD})`);
      return;
    }

    logger.info(
      `Found ${cves.length} new CVEs in the last ${HOURS_DELAY} hours, ${severeCves.length} are severe (CVSS ≥ ${CVSS_SEVERITY_THRESHOLD})`
    );

    // Process and enrich CVEs
    const processedCVEs = processCVEs(severeCves);

    // Create the message
    const message = createCVEMessage(processedCVEs);

    if (dryMode) {
      logger.info(`Would send Telegram message`, { message });
      return;
    }

    // Send the message
    await sendMessage(message, process.env.TELEGRAM_TOPIC_CVE);
    logger.info('CVE message sent successfully');
  } catch (err) {
    logger.error('Error sending CVE message', { error: err.message });
  }
};

module.exports = { run };
