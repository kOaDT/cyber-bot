jest.mock('../../../crons/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('node-telegram-bot-api');

jest.mock('../../../crons/utils/database', () => ({
  getPool: jest.fn(() => null),
}));

const logger = require('../../../crons/config/logger');
const TelegramBot = require('node-telegram-bot-api');

const mockSendMessage = jest.fn().mockResolvedValue({});
TelegramBot.mockImplementation(() => ({
  sendMessage: mockSendMessage,
}));

const { sendMessage, sanitizeTelegramHtml, splitMessage } = require('../../../crons/utils/sendMessage');

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

  it('should close and reopen HTML tags when splitting in HTML mode', async () => {
    const message = '<pre>' + 'A'.repeat(4080) + '\n' + 'B'.repeat(50) + '</pre>';

    await sendMessage(message, null, null, { parse_mode: 'HTML' });

    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    const chunk1 = mockSendMessage.mock.calls[0][1];
    const chunk2 = mockSendMessage.mock.calls[1][1];
    expect(chunk1).toMatch(/<\/pre>$/);
    expect(chunk2).toMatch(/^<pre>/);
  });
});

describe('splitMessage', () => {
  it('should return a single chunk for short messages', () => {
    const chunks = splitMessage('hello world', true);
    expect(chunks).toEqual(['hello world']);
  });

  it('should not add tags for plain text mode', () => {
    const longMessage = 'A'.repeat(4000) + '\n' + 'B'.repeat(4000);
    const chunks = splitMessage(longMessage, false);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe('A'.repeat(4000));
    expect(chunks[1]).toBe('B'.repeat(4000));
  });

  it('should close and reopen a single tag across chunks', () => {
    const line1 = '<b>' + 'A'.repeat(4080);
    const line2 = 'B'.repeat(50) + '</b>';
    const chunks = splitMessage(line1 + '\n' + line2, true);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(line1 + '</b>');
    expect(chunks[1]).toBe('<b>' + line2);
  });

  it('should close and reopen nested tags in correct order', () => {
    const line1 = '<pre><code>' + 'A'.repeat(4070);
    const line2 = 'B'.repeat(50) + '</code></pre>';
    const chunks = splitMessage(line1 + '\n' + line2, true);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(line1 + '</code></pre>');
    expect(chunks[1]).toBe('<pre><code>' + line2);
  });

  it('should preserve tag attributes when reopening', () => {
    const line1 = '<a href="https://example.com">' + 'A'.repeat(4050);
    const line2 = 'B'.repeat(50) + '</a>';
    const chunks = splitMessage(line1 + '\n' + line2, true);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(line1 + '</a>');
    expect(chunks[1]).toBe('<a href="https://example.com">' + line2);
  });

  it('should not add empty closing tags when no tags are open', () => {
    const line1 = '<b>bold</b> ' + 'A'.repeat(4070);
    const line2 = 'B'.repeat(50);
    const chunks = splitMessage(line1 + '\n' + line2, true);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(line1);
    expect(chunks[1]).toBe(line2);
  });

  it('should handle multiple split points with ongoing tags', () => {
    const line = 'X'.repeat(4000);
    const message = `<pre>${line}\n${line}\n${line}</pre>`;
    const chunks = splitMessage(message, true);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const chunk of chunks) {
      expect(chunk).toMatch(/^<pre>/);
      expect(chunk).toMatch(/<\/pre>$/);
    }
  });

  it('should account for closing tag length when deciding split point', () => {
    const tagOverhead = '</blockquote>'.length;
    const contentLen = 4096 - '<blockquote>'.length - tagOverhead;
    const line1 = '<blockquote>' + 'A'.repeat(contentLen);
    const line2 = 'B'.repeat(50) + '</blockquote>';
    const chunks = splitMessage(line1 + '\n' + line2, true);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].length).toBeLessThanOrEqual(4096);
    expect(chunks[0]).toMatch(/<\/blockquote>$/);
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
