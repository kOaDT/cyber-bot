const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../../crons/config/logger', () => mockLogger);

jest.mock('../../../crons/utils/sendMessage', () => ({
  sendMessage: jest.fn().mockResolvedValue(true),
}));

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({
    vulnerabilities: [
      {
        cve: {
          id: 'CVE-2023-1234',
          descriptions: [{ lang: 'en', value: 'Test CVE description' }],
          metrics: {
            cvssMetricV31: [{ cvssData: { baseScore: 8.5 } }],
          },
          references: [],
          configurations: [{ nodes: [] }],
        },
      },
    ],
    totalResults: 1,
  }),
});

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue(JSON.stringify({ lastUpdate: '2023-01-01' })),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
  existsSync: jest.fn().mockReturnValue(true),
}));

process.env.TELEGRAM_TOPIC_CVE = 'mock-topic';
process.env.CVSS_SEVERITY_THRESHOLD = '7.0';
process.env.HOURS_DELAY = '24';

const sendCve = require('../../../crons/sendCve');
const sendMessage = require('../../../crons/utils/sendMessage');

describe('sendCve cron job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should run without errors in dry mode', async () => {
    await expect(sendCve.run({ dryMode: true })).resolves.not.toThrow();
    expect(sendMessage.sendMessage).not.toHaveBeenCalled();
  });

  test('should call sendMessage when not in dry mode', async () => {
    await sendCve.run({ dryMode: false });
    expect(sendMessage.sendMessage).toHaveBeenCalled();
  });

  test('should handle empty CVE results', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ vulnerabilities: [], totalResults: 0 }),
    });

    await sendCve.run({ dryMode: false });
    expect(sendMessage.sendMessage).not.toHaveBeenCalled();
  });

  test('should filter low severity CVEs', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        vulnerabilities: [
          {
            cve: {
              id: 'CVE-2023-9999',
              descriptions: [{ lang: 'en', value: 'Low severity test' }],
              metrics: {
                cvssMetricV31: [{ cvssData: { baseScore: 3.5 } }],
              },
              references: [],
              configurations: [{ nodes: [] }],
            },
          },
        ],
        totalResults: 1,
      }),
    });

    await sendCve.run({ dryMode: false });
    expect(sendMessage.sendMessage).not.toHaveBeenCalled();
  });
});
