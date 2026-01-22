const logger = require('./config/logger');
const { sendMessage } = require('./utils/sendMessage');
const { getCveStats } = require('./utils/cveStats');

const NVD_API_BASE_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const RESULTS_PER_PAGE = 2000;
const CVSS_SEVERITY_THRESHOLD = parseFloat(process.env.CVSS_SEVERITY_THRESHOLD || 7.0);
const HOURS_DELAY = parseInt(process.env.HOURS_DELAY || 24);
const ENABLE_CVE_STATS = process.env.ENABLE_CVE_STATS === 'true';
const TOP_CVES_COUNT = 5;

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

const fetchCVEPage = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

const fetchCVEs = async () => {
  const searchParams = createSearchParams();

  try {
    const url = `${NVD_API_BASE_URL}?${searchParams.toString()}`;
    const data = await fetchCVEPage(url);

    if (data.vulnerabilities && data.vulnerabilities.length > 0) {
      return data.vulnerabilities;
    }
    return [];
  } catch (error) {
    logger.error('Error fetching CVEs:', error.message);
    throw error;
  }
};

const getCVSSScore = (metrics) => {
  const cvssV3 = metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore;
  const cvssV2 = metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore;
  return cvssV3 || cvssV2 || 0;
};

const getSeverityLabel = (score) => {
  if (score >= 9.0) return 'CRITICAL';
  if (score >= 7.0) return 'HIGH';
  if (score >= 4.0) return 'MEDIUM';
  return 'LOW';
};

const escapeHtml = (text) => {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const processCVEs = (cves) => {
  const enrichedCves = cves.map((cve) => {
    const severity = getCVSSScore(cve.cve.metrics);
    const description = cve.cve.descriptions.find((d) => d.lang === 'en')?.value || 'No description available';

    return {
      id: cve.cve.id,
      severity,
      severityLabel: getSeverityLabel(severity),
      description,
    };
  });

  return enrichedCves.filter((cve) => cve.severity >= CVSS_SEVERITY_THRESHOLD).sort((a, b) => b.severity - a.severity);
};

const createAsciiChart = (dailyCounts) => {
  if (!dailyCounts || dailyCounts.length === 0) return '';

  const maxCount = Math.max(...dailyCounts.map((d) => d.count), 1);
  const chartWidth = 12;

  let chart = '<b>7-Day Trend</b>\n<pre>\n';

  dailyCounts.forEach((day) => {
    const date = new Date(day.date);
    const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 3);
    const barLength = Math.round((day.count / maxCount) * chartWidth);
    const bar = '█'.repeat(barLength) + '░'.repeat(chartWidth - barLength);
    chart += `${dayLabel} ${bar} ${day.count}\n`;
  });

  chart += '</pre>';
  return chart;
};

const createStatsSection = (stats) => {
  if (!stats) return '';

  let section = '<b>Statistics</b>\n';
  section += `Today: <b>${stats.today}</b> (${stats.todayCritical} critical)\n`;
  section += `This week: <b>${stats.week}</b>\n`;
  section += `This month: <b>${stats.month}</b>\n`;
  section += `${stats.currentYear} (as of ${stats.currentDate}): <b>${stats.year}</b>`;

  if (stats.yearOverYearChange !== null) {
    const trend = parseFloat(stats.yearOverYearChange) >= 0 ? '+' : '';
    section += ` (${trend}${stats.yearOverYearChange}% vs same period ${stats.lastYearNumber})`;
  }

  section += '\n';

  if (stats.dailyCounts && stats.dailyCounts.length > 0) {
    section += '\n' + createAsciiChart(stats.dailyCounts);
  }

  return section;
};

const formatTopCVE = (cve, index) => {
  const shortDesc = cve.description.length > 100 ? `${cve.description.substring(0, 100)}...` : cve.description;

  return (
    `<b>${index + 1}. ${cve.id}</b> [${cve.severity.toFixed(1)} ${cve.severityLabel}]\n` + `${escapeHtml(shortDesc)}`
  );
};

const createTopCVEsSection = (cves) => {
  if (cves.length === 0) return '';

  const topCves = cves.slice(0, TOP_CVES_COUNT);

  let section = `<b>Top ${topCves.length} Most Critical</b>\n\n`;
  section += topCves.map((cve, index) => formatTopCVE(cve, index)).join('\n\n');

  return section;
};

const createCVEMessage = (processedCVEs, stats = null) => {
  const totalFiltered = processedCVEs.length;
  const criticalCount = processedCVEs.filter((cve) => cve.severity >= 9.0).length;
  const highCount = processedCVEs.filter((cve) => cve.severity >= 7.0 && cve.severity < 9.0).length;

  let message = `<b>CVE Daily Report</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  message += `<b>Last ${HOURS_DELAY}h Summary</b>\n`;
  message += `Total (CVSS ≥${CVSS_SEVERITY_THRESHOLD}): <b>${totalFiltered}</b>\n`;
  message += `Critical (≥9.0): <b>${criticalCount}</b> | High (≥7.0): <b>${highCount}</b>\n`;

  if (stats) {
    message += '\n━━━━━━━━━━━━━━━━━━━━\n\n';
    message += createStatsSection(stats);
  }

  message += '\n━━━━━━━━━━━━━━━━━━━━\n\n';
  message += createTopCVEsSection(processedCVEs);

  message += '\n\n━━━━━━━━━━━━━━━━━━━━\n';
  message += '<a href="https://www.cyberhub.blog/cves">Full CVE analysis</a>';

  return message;
};

const run = async ({ dryMode }) => {
  try {
    const cves = await fetchCVEs();

    if (cves.length === 0) {
      logger.info(`No new CVEs found in the last ${HOURS_DELAY} hours`);
      return;
    }

    const processedCVEs = processCVEs(cves);

    if (processedCVEs.length === 0) {
      logger.info(`No severe CVEs found in the last ${HOURS_DELAY} hours (CVSS ≥ ${CVSS_SEVERITY_THRESHOLD})`);
      return;
    }

    logger.info(`Found ${cves.length} new CVEs in the last ${HOURS_DELAY} hours, ${processedCVEs.length} are severe`);

    let stats = null;
    if (ENABLE_CVE_STATS) {
      stats = await getCveStats();
    }

    const message = createCVEMessage(processedCVEs, stats);

    if (dryMode) {
      logger.info(`Would send Telegram message`, { message });
      return;
    }

    await sendMessage(message, process.env.TELEGRAM_TOPIC_CVE, null, { parse_mode: 'HTML' });
    logger.info('CVE message sent successfully');
  } catch (err) {
    logger.error('Error sending CVE message', { error: err.message });
  }
};

module.exports = { run };
