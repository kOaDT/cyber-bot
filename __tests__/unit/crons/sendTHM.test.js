// __tests__/unit/crons/sendTHM.test.js

jest.mock('../../../crons/utils/sendMessage', () => ({
  sendMessage: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../crons/utils/generate', () => ({
  generate: jest.fn().mockResolvedValue('Translated message'),
}));

jest.mock('../../../crons/utils/prompts', () => ({
  translatePrompt: jest.fn().mockReturnValue('Translation prompt'),
}));

jest.mock('../../../crons/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

const { run } = require('../../../crons/sendTHM');
const { sendMessage } = require('../../../crons/utils/sendMessage');
const { generate } = require('../../../crons/utils/generate');
const { translatePrompt } = require('../../../crons/utils/prompts');
const logger = require('../../../crons/config/logger');

describe('sendTHM cron job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TELEGRAM_TOPIC_THM = '123';
  });

  test('should run without errors in dry mode', async () => {
    await run({ dryMode: true, lang: 'french' });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('Would send Telegram message', {
      message: "🎯 Hey ! Il est temps de s'entraîner sur TryHackMe !",
    });
  });

  test('should call sendMessage when not in dry mode with French message', async () => {
    await run({ dryMode: false, lang: 'french' });

    expect(translatePrompt).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith("🎯 Hey ! Il est temps de s'entraîner sur TryHackMe !", '123');
    expect(logger.info).toHaveBeenCalledWith('Message sent successfully');
  });

  test('should translate the message when lang is not French', async () => {
    await run({ dryMode: false, lang: 'english' });

    expect(translatePrompt).toHaveBeenCalledWith("🎯 Hey ! Il est temps de s'entraîner sur TryHackMe !", 'english');
    expect(generate).toHaveBeenCalledWith('Translation prompt');
    expect(sendMessage).toHaveBeenCalledWith('Translated message', '123');
  });

  test('should log error when there is an exception', async () => {
    sendMessage.mockRejectedValueOnce(new Error('Failed to send message'));

    await run({ dryMode: false, lang: 'french' });

    expect(logger.error).toHaveBeenCalledWith('Error sending THM', { error: 'Failed to send message' });
  });
});
