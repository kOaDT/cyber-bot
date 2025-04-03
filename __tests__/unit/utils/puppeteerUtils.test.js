const puppeteer = require('puppeteer');
const logger = require('../../../crons/config/logger');
const { BrowserManager } = require('../../../crons/utils/puppeteerUtils');

// Mock dependencies
jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

jest.mock('../../../crons/config/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

describe('BrowserManager', () => {
  let browserManager;
  let mockBrowser;
  let mockPage;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock objects
    mockPage = {
      setDefaultTimeout: jest.fn(),
      setDefaultNavigationTimeout: jest.fn(),
      on: jest.fn(),
      goto: jest.fn(),
      waitForSelector: jest.fn(),
      click: jest.fn(),
      waitForNavigation: jest.fn(),
      $eval: jest.fn(),
      title: jest.fn(),
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    };

    // Set up puppeteer to return our mock browser
    puppeteer.launch.mockResolvedValue(mockBrowser);

    // Create a new instance for each test
    browserManager = new BrowserManager();
  });

  test('should initialize with default options', () => {
    expect(browserManager.options).toEqual({
      headless: 'new',
      timeout: 30000,
    });
  });

  test('should initialize with custom options', () => {
    const customOptions = {
      headless: false,
      timeout: 60000,
      slowMo: 100,
    };

    browserManager = new BrowserManager(customOptions);

    expect(browserManager.options).toEqual(customOptions);
  });

  test('should launch browser and create page on init', async () => {
    await browserManager.init();

    expect(puppeteer.launch).toHaveBeenCalledWith({
      headless: 'new',
      timeout: 30000,
    });

    expect(mockBrowser.newPage).toHaveBeenCalled();
    expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(30000);
    expect(mockPage.setDefaultNavigationTimeout).toHaveBeenCalledWith(30000);
    expect(mockPage.on).toHaveBeenCalledWith('console', expect.any(Function));
  });

  test('should handle init errors', async () => {
    const error = new Error('Browser launch failed');
    puppeteer.launch.mockRejectedValueOnce(error);

    await expect(browserManager.init()).rejects.toThrow('Browser launch failed');
    expect(logger.error).toHaveBeenCalledWith('Failed to initialize browser:', error);
  });

  test('should navigate to URL', async () => {
    await browserManager.init();
    await browserManager.navigateTo('https://example.com');

    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
      waitUntil: 'networkidle0',
    });
  });

  test('should handle navigation errors', async () => {
    const error = new Error('Navigation failed');

    await browserManager.init();
    mockPage.goto.mockRejectedValueOnce(error);

    await expect(browserManager.navigateTo('https://example.com')).rejects.toThrow();
    expect(logger.error).toHaveBeenCalledWith('Failed to navigate to https://example.com', {
      error: 'Navigation failed',
    });
  });

  test('should click and wait for navigation', async () => {
    await browserManager.init();
    await browserManager.clickAndWait('button', { waitForNavigation: true });

    expect(mockPage.waitForSelector).toHaveBeenCalledWith('button', { visible: true });
    expect(mockPage.click).toHaveBeenCalledWith('button');
    expect(mockPage.waitForNavigation).toHaveBeenCalled();
  });

  test('should click and wait for selector', async () => {
    await browserManager.init();
    await browserManager.clickAndWait('button', { waitForSelector: '#result' });

    expect(mockPage.click).toHaveBeenCalledWith('button');
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('#result');
  });

  test('should get text from element', async () => {
    await browserManager.init();
    mockPage.$eval.mockResolvedValue('Element text');

    const text = await browserManager.getText('p.content');

    expect(mockPage.waitForSelector).toHaveBeenCalledWith('p.content');
    expect(mockPage.$eval).toHaveBeenCalled();
    expect(text).toBe('Element text');
  });

  test('should get page title', async () => {
    await browserManager.init();
    mockPage.title.mockResolvedValue('Page Title');

    const title = await browserManager.getPageTitle();

    expect(mockPage.title).toHaveBeenCalled();
    expect(title).toBe('Page Title');
  });

  test('should get attribute value', async () => {
    await browserManager.init();
    mockPage.$eval.mockResolvedValue('attribute-value');

    const value = await browserManager.getAttributeValue('img', 'src');

    expect(mockPage.waitForSelector).toHaveBeenCalledWith('img');
    expect(mockPage.$eval).toHaveBeenCalled();
    expect(value).toBe('attribute-value');
  });

  test('should wait for element', async () => {
    await browserManager.init();

    await browserManager.waitForElement('#element', { visible: true });

    expect(mockPage.waitForSelector).toHaveBeenCalledWith('#element', { visible: true });
  });

  test('should close browser', async () => {
    await browserManager.init();
    await browserManager.close();

    expect(mockBrowser.close).toHaveBeenCalled();
    expect(browserManager.browser).toBeNull();
    expect(browserManager.page).toBeNull();
  });

  test('should do nothing on close if browser is already closed', async () => {
    await browserManager.init();
    browserManager.browser = null;

    await browserManager.close();

    expect(mockBrowser.close).not.toHaveBeenCalled();
  });
});
