const puppeteer = require('puppeteer');
const logger = require('../config/logger');

/**
 * BrowserManager class
 * Manages the browser instance and provides methods for navigation and interaction
 */
class BrowserManager {
  /**
   * Constructor for the BrowserManager class
   * @param {Object} options - Configuration options for the browser
   */
  constructor(options = {}) {
    this.options = {
      headless: 'new',
      timeout: 30000,
      ...options,
    };
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize the browser instance
   * @returns {Promise<BrowserManager>} The initialized BrowserManager instance
   */
  async init() {
    try {
      this.browser = await puppeteer.launch(this.options);
      this.page = await this.browser.newPage();
      await this.page.setUserAgent(
        // eslint-disable-next-line max-len
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      );
      await this.page.setDefaultTimeout(this.options.timeout);
      await this.page.setDefaultNavigationTimeout(this.options.timeout);

      this.page.on('console', (msg) => {
        if (msg.type() === 'error') {
          logger.error(`Page Error`, { error: msg.text() });
        }
      });

      return this;
    } catch (error) {
      logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  /**
   * Navigate to a specific URL
   * @param {string} url - The URL to navigate to
   * @param {Object} options - Additional options for the navigation
   * @returns {Promise<void>}
   */
  async navigateTo(url, options = {}) {
    try {
      await this.page.goto(url, {
        waitUntil: 'networkidle0',
        ...options,
      });
    } catch (error) {
      logger.error(`Failed to navigate to ${url}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Click on an element and wait for navigation or selector
   * @param {string} selector - The selector of the element to click
   * @param {Object} options - Additional options for the click
   * @returns {Promise<void>}
   */
  async clickAndWait(selector, options = {}) {
    try {
      await this.page.waitForSelector(selector, { visible: true });
      await this.page.click(selector);

      if (options.waitForNavigation) {
        await this.page.waitForNavigation();
      }

      if (options.waitForSelector) {
        await this.page.waitForSelector(options.waitForSelector);
      }
    } catch (error) {
      logger.error(`Failed to click element ${selector}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get the text content of an element
   * @param {string} selector - The selector of the element to get the text from
   * @returns {Promise<string>} The text content of the element
   */
  async getText(selector) {
    try {
      await this.page.waitForSelector(selector);
      return await this.page.$eval(selector, (el) => el.textContent.trim());
    } catch (error) {
      logger.error(`Failed to get text from ${selector}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get the title of the page
   * @returns {Promise<string>} The title of the page
   */
  async getPageTitle() {
    return await this.page.title();
  }

  /**
   * Get the value of an attribute from an element
   * @param {string} selector - The selector of the element to get the attribute from
   * @param {string} attribute - The attribute to get the value from
   * @returns {Promise<string>} The value of the attribute
   */
  async getAttributeValue(selector, attribute) {
    try {
      await this.page.waitForSelector(selector);
      return await this.page.$eval(selector, (el, attr) => el.getAttribute(attr), attribute);
    } catch (error) {
      logger.error(`Failed to get attribute ${attribute} from ${selector}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Wait for an element to be present in the DOM
   * @param {string} selector - The selector of the element to wait for
   * @param {Object} options - Additional options for the wait
   * @returns {Promise<void>}
   */
  async waitForElement(selector, options = {}) {
    try {
      return await this.page.waitForSelector(selector, options);
    } catch (error) {
      logger.error(`Failed to wait for element ${selector}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Close the browser instance
   * @returns {Promise<void>}
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

module.exports = { BrowserManager };
