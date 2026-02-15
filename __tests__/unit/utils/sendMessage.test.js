jest.mock('../../../crons/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('node-telegram-bot-api');

jest.mock('../../../crons/utils/database', () => ({
  promise: jest.fn(),
}));

const logger = require('../../../crons/config/logger');
const TelegramBot = require('node-telegram-bot-api');

const mockSendMessage = jest.fn().mockResolvedValue({});
TelegramBot.mockImplementation(() => ({
  sendMessage: mockSendMessage,
}));

const { sendMessage, sanitizeTelegramHtml } = require('../../../crons/utils/sendMessage');

describe('sendMessage', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      TELEGRAM_BOT_TOKEN: 'test-token',
      CHAT_ID: '123456789',
      I_WANT_TO_SAVE_MESSAGES_IN_DB: 'false',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should send a message to Telegram', async () => {
    await sendMessage('Test message');

    expect(mockSendMessage).toHaveBeenCalledWith('123456789', 'Test message', {});
    expect(logger.info).toHaveBeenCalledWith('Message sent successfully');
  });

  it('should send a message with topic ID', async () => {
    await sendMessage('Test message', 42);

    expect(mockSendMessage).toHaveBeenCalledWith('123456789', 'Test message', { message_thread_id: 42 });
  });

  it('should handle errors when sending messages', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('API error'));

    await sendMessage('Test message');

    expect(logger.error).toHaveBeenCalledWith('Error sending message', { error: 'API error' });
  });

  it('should split long messages into chunks', async () => {
    const longMessage = 'A'.repeat(4000) + '\n' + 'B'.repeat(4000);

    await sendMessage(longMessage);

    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });
});

describe('sanitizeTelegramHtml', () => {
  it('should keep allowed tags', () => {
    const input = '<b>bold</b> <i>italic</i> <code>code</code> <pre>block</pre> <u>underline</u> <s>strike</s>';
    expect(sanitizeTelegramHtml(input)).toBe(input);
  });

  it('should keep <a> tags with attributes', () => {
    const input = '<a href="https://example.com">link</a>';
    expect(sanitizeTelegramHtml(input)).toBe(input);
  });

  it('should strip unsupported tags', () => {
    const input = '<table><tr><td>cell</td></tr></table>';
    expect(sanitizeTelegramHtml(input)).toBe('cell');
  });

  it('should strip div, span, p, h1, br, ul, li tags', () => {
    const input = '<div><h1>Title</h1><p>Text</p><ul><li>item</li></ul></div>';
    expect(sanitizeTelegramHtml(input)).toBe('TitleTextitem');
  });

  it('should handle mixed allowed and disallowed tags', () => {
    const input = '<div><b>bold</b> and <table><tr><td><i>italic</i></td></tr></table></div>';
    expect(sanitizeTelegramHtml(input)).toBe('<b>bold</b> and <i>italic</i>');
  });

  it('should return empty string for null or undefined', () => {
    expect(sanitizeTelegramHtml(null)).toBe('');
    expect(sanitizeTelegramHtml(undefined)).toBe('');
  });

  it('should return empty string for non-string input', () => {
    expect(sanitizeTelegramHtml(123)).toBe('');
  });

  it('should leave plain text unchanged', () => {
    expect(sanitizeTelegramHtml('no tags here')).toBe('no tags here');
  });

  it('should fix misnested tags like <b>...<code>...</b>...</code>', () => {
    const input = '<b>bold<code>mixed</b>rest</code>';
    expect(sanitizeTelegramHtml(input)).toBe('<b>bold<code>mixed</code></b>rest');
  });

  it('should fix misnested <b> inside <i>', () => {
    const input = '<i>italic<b>bold</i>rest</b>';
    expect(sanitizeTelegramHtml(input)).toBe('<i>italic<b>bold</b></i>rest');
  });

  it('should close unclosed tags', () => {
    const input = '<b>bold text';
    expect(sanitizeTelegramHtml(input)).toBe('<b>bold text</b>');
  });

  it('should ignore orphan closing tags', () => {
    const input = 'text</b>';
    expect(sanitizeTelegramHtml(input)).toBe('text');
  });

  it('should escape bare < and > in text for Telegram parser', () => {
    expect(sanitizeTelegramHtml('x < 5 and y > 0')).toBe('x &lt; 5 and y &gt; 0');
  });

  it('should escape & in text', () => {
    expect(sanitizeTelegramHtml('a & b')).toBe('a &amp; b');
  });

  it('should escape < > & in text while keeping allowed tags', () => {
    const input = 'compare: <b>a < 1</b> & <i>b > 2</i>';
    expect(sanitizeTelegramHtml(input)).toBe('compare: <b>a &lt; 1</b> &amp; <i>b &gt; 2</i>');
  });
});
