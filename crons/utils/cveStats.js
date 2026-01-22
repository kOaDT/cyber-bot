const pool = require('./database');
const logger = require('../config/logger');

const db = pool.promise();

const getStartOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getStartOfWeek = (date = new Date()) => {
  const d = getStartOfDay(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
};

const getStartOfMonth = (date = new Date()) => {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getStartOfYear = (date = new Date()) => {
  const d = new Date(date);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDate = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

const countCvesBetween = async (startDate, endDate) => {
  const [rows] = await db.execute('SELECT COUNT(*) as count FROM Cve WHERE published >= ? AND published < ?', [
    formatDate(startDate),
    formatDate(endDate),
  ]);
  return rows[0].count;
};

const countCvesBySeverityBetween = async (startDate, endDate, minCvss = 0, maxCvss = 10) => {
  const [rows] = await db.execute(
    'SELECT COUNT(*) as count FROM Cve WHERE published >= ? AND published < ? AND cvss >= ? AND cvss <= ?',
    [formatDate(startDate), formatDate(endDate), minCvss, maxCvss]
  );
  return rows[0].count;
};

const getDailyCountsForPeriod = async (days = 7) => {
  const [rows] = await db.execute(
    `SELECT DATE(published) as date, COUNT(*) as count
     FROM Cve
     WHERE published >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(published)
     ORDER BY date ASC`,
    [days]
  );
  return rows;
};

const getMonthlyCountsForYear = async (year) => {
  const [rows] = await db.execute(
    `SELECT MONTH(published) as month, COUNT(*) as count
     FROM Cve
     WHERE YEAR(published) = ?
     GROUP BY MONTH(published)
     ORDER BY month ASC`,
    [year]
  );
  return rows;
};

const getCveStats = async () => {
  try {
    const now = new Date();
    const today = getStartOfDay();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekStart = getStartOfWeek();
    const monthStart = getStartOfMonth();
    const yearStart = getStartOfYear();

    const lastYearStart = new Date(yearStart);
    lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
    const lastYearEnd = new Date(yearStart);

    const lastYearSamePeriodEnd = new Date(now);
    lastYearSamePeriodEnd.setFullYear(lastYearSamePeriodEnd.getFullYear() - 1);

    const [
      todayCount,
      todayCritical,
      weekCount,
      monthCount,
      yearCount,
      lastYearTotal,
      lastYearSamePeriod,
      dailyCounts,
    ] = await Promise.all([
      countCvesBetween(today, tomorrow),
      countCvesBySeverityBetween(today, tomorrow, 9.0, 10),
      countCvesBetween(weekStart, tomorrow),
      countCvesBetween(monthStart, tomorrow),
      countCvesBetween(yearStart, tomorrow),
      countCvesBetween(lastYearStart, lastYearEnd),
      countCvesBetween(lastYearStart, lastYearSamePeriodEnd),
      getDailyCountsForPeriod(7),
    ]);

    const yearOverYearChange =
      lastYearSamePeriod > 0 ? (((yearCount - lastYearSamePeriod) / lastYearSamePeriod) * 100).toFixed(1) : null;

    return {
      today: todayCount,
      todayCritical,
      week: weekCount,
      month: monthCount,
      year: yearCount,
      lastYear: lastYearTotal,
      lastYearSamePeriod,
      yearOverYearChange,
      dailyCounts,
      currentYear: now.getFullYear(),
      lastYearNumber: now.getFullYear() - 1,
      currentDate: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  } catch (error) {
    logger.error('Error fetching CVE stats from database', { error: error.message });
    return null;
  }
};

module.exports = {
  getCveStats,
  getDailyCountsForPeriod,
  getMonthlyCountsForYear,
};
