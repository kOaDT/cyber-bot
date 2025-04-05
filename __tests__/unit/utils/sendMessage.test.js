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

const { sendMessage } = require('../../../crons/utils/sendMessage');

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
