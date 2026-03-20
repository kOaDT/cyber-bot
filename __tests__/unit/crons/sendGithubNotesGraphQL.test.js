jest.mock('../../../crons/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../crons/utils/sendMessage', () => ({
  sendMessage: jest.fn(),
  sanitizeTelegramHtml: jest.fn((v) => v),
}));

jest.mock('../../../crons/utils/generate', () => ({
  generate: jest.fn(),
}));

jest.mock('../../../crons/utils/relevance', () => ({
  evaluateRelevance: jest.fn().mockResolvedValue({ relevant: true, score: 8 }),
}));

jest.mock('../../../crons/utils/processedItems', () => ({
  createArrayStore: jest.fn(() => ({
    load: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
  })),
}));

jest.mock('node:crypto', () => ({
  randomInt: jest.fn().mockReturnValue(0),
}));

global.fetch = jest.fn();

describe('sendGithubNotes - GraphQL parameterization', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      GITHUB_SECRET: 'test-token',
      GITHUB_USERNAME: 'testuser',
      GITHUB_REPO: 'test-repo',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use parameterized GraphQL variables instead of string interpolation', async () => {
    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        data: {
          repository: {
            object: {
              entries: [{ name: 'note.md', type: 'blob', object: { text: 'content', oid: '123' } }],
            },
          },
        },
      }),
    });

    const { _getGithubFile } = require('../../../crons/sendGithubNotes');
    await _getGithubFile();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/graphql',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      })
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);

    expect(body.variables).toEqual({ owner: 'testuser', name: 'test-repo' });
    expect(body.query).toContain('query($owner: String!, $name: String!)');
    expect(body.query).toContain('repository(owner: $owner, name: $name)');
    expect(body.query).not.toMatch(/repository\(owner: ".*", name: ".*"\)/);
  });
});
