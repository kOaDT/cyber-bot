const fs = require('fs').promises;
const { run, _selectChallenge: selectChallenge } = require('../../../crons/sendCTFChallenge');
const logger = require('../../../crons/config/logger');

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    rename: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    rmdir: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../crons/utils/sendMessage', () => ({
  sendMessage: jest.fn().mockResolvedValue(true),
  sanitizeTelegramHtml: jest.fn((html) => html),
}));

jest.mock('../../../crons/utils/generate', () => ({
  generate: jest.fn().mockResolvedValue('Message traduit'),
}));

jest.mock('../../../crons/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../crons/utils/prompts', () => ({
  translatePrompt: jest.fn().mockReturnValue('Translation prompt'),
}));

const { sendMessage } = require('../../../crons/utils/sendMessage');
const { generate } = require('../../../crons/utils/generate');
const { translatePrompt } = require('../../../crons/utils/prompts');

const buildChallenge = (overrides = {}) => ({
  number: 1,
  title: 'Public env variable leak',
  difficulty: 'EASY',
  category: 'INFORMATION_DISCLOSURE',
  estimatedMinutes: { min: 15, max: 20 },
  url: 'https://koadt.github.io/oss-oopssec-store/roadmap#challenge-01',
  chapter: {
    index: 1,
    title: 'Reconnaissance & Disclosure',
    tagline: 'Most attacks start with reading, not exploiting.',
    url: 'https://koadt.github.io/oss-oopssec-store/roadmap#chapter-01',
  },
  prerequisites: [],
  walkthrough: {
    slug: 'next-public-env-variable-leak',
    title: 'Reading Secrets From the Browser',
    description: 'Recovering a payment secret from the client bundle.',
    url: 'https://koadt.github.io/oss-oopssec-store/posts/next-public-env-variable-leak',
  },
  ...overrides,
});

const buildFeed = (challenges) => ({
  version: 1,
  totalChallenges: challenges.length,
  challenges,
});

const mockFeed = (feed, ok = true, status = 200) => {
  global.fetch.mockResolvedValueOnce({ ok, status, json: () => Promise.resolve(feed) });
};

describe('sendCTFChallenge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    process.env.TELEGRAM_TOPIC_CTF = '123';
    fs.readFile.mockResolvedValue(JSON.stringify({ lastChallengeNumber: 0 }));
  });

  afterEach(() => {
    delete global.fetch;
    delete process.env.TELEGRAM_TOPIC_CTF;
  });

  describe('selectChallenge', () => {
    const challenges = [buildChallenge({ number: 1 }), buildChallenge({ number: 2 }), buildChallenge({ number: 3 })];

    it('should start at the first challenge when nothing was posted yet', () => {
      expect(selectChallenge(challenges, 0).number).toBe(1);
    });

    it('should follow the curriculum order', () => {
      expect(selectChallenge(challenges, 1).number).toBe(2);
    });

    it('should loop back to the first challenge once the curriculum is exhausted', () => {
      expect(selectChallenge(challenges, 3).number).toBe(1);
    });

    it('should resume at the next existing challenge when numbers are missing', () => {
      const withGap = [buildChallenge({ number: 1 }), buildChallenge({ number: 4 })];
      expect(selectChallenge(withGap, 2).number).toBe(4);
    });

    it('should ignore the order of the feed array', () => {
      const shuffled = [buildChallenge({ number: 3 }), buildChallenge({ number: 1 }), buildChallenge({ number: 2 })];
      expect(selectChallenge(shuffled, 0).number).toBe(1);
    });
  });

  describe('run', () => {
    it('should send the next challenge and remember it', async () => {
      mockFeed(buildFeed([buildChallenge({ number: 1 }), buildChallenge({ number: 2, title: 'Second' })]));
      fs.readFile.mockResolvedValue(JSON.stringify({ lastChallengeNumber: 1 }));

      await run({ dryMode: false, lang: 'english' });

      expect(sendMessage).toHaveBeenCalledTimes(1);
      const [message, topicId, categories, options] = sendMessage.mock.calls[0];
      expect(message).toContain('Challenge 2/2');
      expect(message).toContain('Second');
      expect(topicId).toBe('123');
      expect(categories).toEqual(['ctf']);
      expect(options).toEqual({ parse_mode: 'HTML' });
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('assets/ctfChallenge.json'),
        expect.stringContaining('"lastChallengeNumber":2')
      );
    });

    it('should include difficulty, category, duration and install command', async () => {
      mockFeed(buildFeed([buildChallenge({ difficulty: 'MEDIUM', category: 'BROKEN_ACCESS_CONTROL' })]));

      await run({ dryMode: false, lang: 'english' });

      const [message] = sendMessage.mock.calls[0];
      expect(message).toContain('🟡 Medium');
      expect(message).toContain('Broken Access Control');
      expect(message).toContain('15–20 min');
      expect(message).toContain('npx create-oss-store my-ctf-lab');
    });

    it('should render an open-ended duration when max is null', async () => {
      mockFeed(buildFeed([buildChallenge({ estimatedMinutes: { min: 90, max: null } })]));

      await run({ dryMode: false, lang: 'english' });

      expect(sendMessage.mock.calls[0][0]).toContain('90+ min');
    });

    it('should list prerequisites with their titles', async () => {
      const challenges = [
        buildChallenge({ number: 1, title: 'Stored XSS' }),
        buildChallenge({ number: 2, title: 'CSRF chain', prerequisites: [1] }),
      ];
      mockFeed(buildFeed(challenges));
      fs.readFile.mockResolvedValue(JSON.stringify({ lastChallengeNumber: 1 }));

      await run({ dryMode: false, lang: 'english' });

      expect(sendMessage.mock.calls[0][0]).toContain('Builds on Stored XSS (#1)');
    });

    it('should fall back to the chapter tagline when no walkthrough is published', async () => {
      mockFeed(buildFeed([buildChallenge({ walkthrough: null })]));

      await run({ dryMode: false, lang: 'english' });

      const [message] = sendMessage.mock.calls[0];
      expect(message).toContain('Most attacks start with reading');
      expect(message).not.toContain('Walkthrough</a>');
    });

    it('should translate the message for a non-English language', async () => {
      mockFeed(buildFeed([buildChallenge()]));

      await run({ dryMode: false, lang: 'french' });

      expect(translatePrompt).toHaveBeenCalled();
      expect(generate).toHaveBeenCalled();
      expect(sendMessage.mock.calls[0][0]).toBe('Message traduit');
    });

    it('should send the English message when translation fails', async () => {
      mockFeed(buildFeed([buildChallenge()]));
      generate.mockResolvedValueOnce(null);

      await run({ dryMode: false, lang: 'french' });

      expect(logger.warn).toHaveBeenCalledWith('Translation failed, falling back to the English message', {
        lang: 'french',
      });
      expect(sendMessage.mock.calls[0][0]).toContain('Public env variable leak');
    });

    it('should not translate an English message', async () => {
      mockFeed(buildFeed([buildChallenge()]));

      await run({ dryMode: false, lang: 'english' });

      expect(translatePrompt).not.toHaveBeenCalled();
      expect(generate).not.toHaveBeenCalled();
    });

    it('should not send nor persist anything in dry mode', async () => {
      mockFeed(buildFeed([buildChallenge()]));

      await run({ dryMode: true, lang: 'english' });

      expect(sendMessage).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Dry mode: No message sent', expect.any(Object));
    });

    it('should start over when the state file is missing', async () => {
      mockFeed(buildFeed([buildChallenge({ number: 1 }), buildChallenge({ number: 2 })]));
      fs.readFile.mockRejectedValue(new Error('ENOENT'));

      await run({ dryMode: false, lang: 'english' });

      expect(sendMessage.mock.calls[0][0]).toContain('Challenge 1/2');
    });

    it('should throw when the feed is unreachable', async () => {
      mockFeed(null, false, 503);

      await expect(run({ dryMode: false, lang: 'english' })).rejects.toThrow('responded with 503');
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('should throw on an unsupported feed version', async () => {
      mockFeed({ version: 2, totalChallenges: 1, challenges: [buildChallenge()] });

      await expect(run({ dryMode: false, lang: 'english' })).rejects.toThrow('Unsupported challenge feed version 2');
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('should throw on an empty feed', async () => {
      mockFeed(buildFeed([]));

      await expect(run({ dryMode: false, lang: 'english' })).rejects.toThrow('no challenge');
      expect(sendMessage).not.toHaveBeenCalled();
    });
  });
});
