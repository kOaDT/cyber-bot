jest.mock('../../../crons/utils/sendMessage', () => ({
  sendMessage: jest.fn().mockResolvedValue(true),
}));

const sendCve = require('../../../crons/sendCve');
const sendMessage = require('../../../crons/utils/sendMessage');

describe('sendCve cron job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should run without errors in dry mode', async () => {
    await expect(sendCve.run({ dryMode: true })).resolves.not.toThrow();
  });

  test('should call sendMessage when not in dry mode', async () => {
    await sendCve.run({ dryMode: false });
    expect(sendMessage.sendMessage).toHaveBeenCalled();
  });
});
