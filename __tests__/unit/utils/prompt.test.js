const {
  createRevisionCardPrompt,
  translatePrompt,
  createNewsResumePrompt,
  createPodcastResumePrompt,
  createYoutubeResumePrompt,
  createRedditPrompt,
} = require('../../../crons/utils/prompts');

describe('Prompt utils', () => {
  // Tests for createRevisionCardPrompt
  describe('createRevisionCardPrompt', () => {
    test('should generate proper revision card prompt with english language', () => {
      const title = 'XSS Attacks';
      const content = 'Cross-site scripting (XSS) is a type of security vulnerability.';
      const lang = 'english';

      const result = createRevisionCardPrompt(title, content, lang);

      // Check if all required parts are included (no sanitization for trusted GitHub source)
      expect(result).toContain(`Title: ${title}`);
      expect(result).toContain(`Content: ${content}`);
      expect(result).toContain(`Content Structure in ${lang}`);
      expect(result).toContain('Generate the response in english');
      expect(result).toContain('<b>Key Concepts</b>');
      expect(result).toContain('<b>Technical Details</b>');
      expect(result).toContain('<b>Security Implications</b>');
      expect(result).toContain('<b>Learn More</b>');
    });

    test('should generate proper revision card prompt with french language', () => {
      const title = 'Attaques XSS';
      const content = 'Le cross-site scripting (XSS) est un type de vulnérabilité.';
      const lang = 'french';

      const result = createRevisionCardPrompt(title, content, lang);

      expect(result).toContain(`Title: ${title}`);
      expect(result).toContain(`Content: ${content}`);
      expect(result).toContain(`Content Structure in ${lang}`);
      expect(result).toContain('Generate the response in french');
    });
  });

  // Tests for translatePrompt
  describe('translatePrompt', () => {
    test('should generate proper translation prompt', () => {
      const prompt = 'This is a test prompt for translation';
      const lang = 'french';

      const result = translatePrompt(prompt, lang);

      expect(result).toContain(`Translate the following text to ${lang}`);
      expect(result).toContain(prompt);
    });

    test('should generate proper translation prompt for Arabic', () => {
      const prompt = 'This is a test prompt for translation to Arabic';
      const lang = 'arabic';

      const result = translatePrompt(prompt, lang);

      expect(result).toContain(`Translate the following text to ${lang}`);
      expect(result).toContain(prompt);
    });
  });

  // Tests for createNewsResumePrompt
  describe('createNewsResumePrompt', () => {
    test('should generate proper news resume prompt with english language', () => {
      const title = 'New Vulnerability Found in OpenSSL';
      const tags = ['vulnerability', 'openssl', 'security'];
      const url = 'https://example.com/news/1';
      const content = 'Researchers discovered a critical vulnerability in OpenSSL';
      const lang = 'english';

      const result = createNewsResumePrompt(title, tags, url, content, lang);

      expect(result).toContain(`Title: ${title}`);
      expect(result).toContain(`Tags: ${tags.join(', ')}`);
      expect(result).toContain('<ARTICLE_START>');
      expect(result).toContain(content);
      expect(result).toContain('<ARTICLE_END>');
      expect(result).toContain('SECURITY NOTICE');
      expect(result).toContain(`security news in ${lang}`);
      expect(result).toContain(`End with the source URL: ${url}`);
      expect(result).not.toContain('Keep technical terms, CVE numbers');
    });

    test('should generate proper news resume prompt with non-english language', () => {
      const title = 'Nouvelle vulnérabilité trouvée dans OpenSSL';
      const tags = ['vulnerability', 'openssl', 'security'];
      const url = 'https://example.com/news/1';
      const content = 'Des chercheurs ont découvert une vulnérabilité critique dans OpenSSL';
      const lang = 'french';

      const result = createNewsResumePrompt(title, tags, url, content, lang);

      expect(result).toContain(`Title: ${title}`);
      expect(result).toContain(`security news in ${lang}`);
      expect(result).toContain('Keep technical terms, CVE numbers, tool names, and security standards in English');
    });

    test('should handle empty tags array', () => {
      const title = 'Test Title';
      const tags = [];
      const url = 'https://example.com';
      const content = 'Test content';
      const lang = 'english';

      const result = createNewsResumePrompt(title, tags, url, content, lang);

      expect(result).toContain('Tags: ');
    });

    test('should handle null tags', () => {
      const title = 'Test Title';
      const tags = null;
      const url = 'https://example.com';
      const content = 'Test content';
      const lang = 'english';

      const result = createNewsResumePrompt(title, tags, url, content, lang);

      expect(result).toContain('Tags: ');
    });
  });

  // Tests for createPodcastResumePrompt
  describe('createPodcastResumePrompt', () => {
    test('should generate proper podcast resume prompt with english language', () => {
      const podcast = 'Security Now';
      const title = 'Latest Security Threats';
      const transcription = 'In this episode, we discuss the latest security threats...';
      const url = 'https://example.com/podcast/1';
      const lang = 'english';

      const result = createPodcastResumePrompt(podcast, title, transcription, url, lang);

      expect(result).toContain(`Episode Title: ${title}`);
      expect(result).toContain('<TRANSCRIPT_START>');
      expect(result).toContain(transcription);
      expect(result).toContain('<TRANSCRIPT_END>');
      expect(result).toContain('SECURITY NOTICE');
      expect(result).toContain(`The summary should be in ${lang}`);
      expect(result).toContain(`Start with: 🎙️ NEW EPISODE OF ${podcast.toUpperCase()}: ${title}`);
      expect(result).toContain(`Finish with the podcast url: ${url}`);
      expect(result).not.toContain('Do not translate technical terms');
    });

    test('should generate proper podcast resume prompt with non-english language', () => {
      const podcast = 'Security Now';
      const title = 'Latest Security Threats';
      const transcription = 'In this episode, we discuss the latest security threats...';
      const url = 'https://example.com/podcast/1';
      const lang = 'french';

      const result = createPodcastResumePrompt(podcast, title, transcription, url, lang);

      expect(result).toContain(`The summary should be in ${lang}`);
      expect(result).toContain('Do not translate technical terms, keep them in english');
    });
  });

  // Tests for createYoutubeResumePrompt
  describe('createYoutubeResumePrompt', () => {
    test('should generate proper youtube resume prompt with english language', () => {
      const channel = 'SecurityTube';
      const videoId = 'abc123';
      const transcription = 'In this video, I demonstrate how to secure your network...';
      const lang = 'english';

      const result = createYoutubeResumePrompt(channel, videoId, transcription, lang);

      expect(result).toContain(`Channel: ${channel}`);
      expect(result).toContain('<TRANSCRIPT_START>');
      expect(result).toContain(transcription);
      expect(result).toContain('<TRANSCRIPT_END>');
      expect(result).toContain('SECURITY NOTICE');
      expect(result).toContain(`produce a concise, fact-based summary of the following YouTube video in ${lang}`);
      expect(result).toContain('1. Start with "🎬"');
      expect(result).toContain(`3. End with the video URL: https://www.youtube.com/watch?v=${videoId}`);
      expect(result).not.toContain('Keep technical terms, tool names, CVE numbers, and security standards in English');
    });

    test('should generate proper youtube resume prompt with non-english language', () => {
      const channel = 'SecurityTube';
      const videoId = 'abc123';
      const transcription = 'In this video, I demonstrate how to secure your network...';
      const lang = 'french';

      const result = createYoutubeResumePrompt(channel, videoId, transcription, lang);

      expect(result).toContain(`produce a concise, fact-based summary of the following YouTube video in ${lang}`);
      expect(result).toContain('Keep technical terms, tool names, CVE numbers, and security standards in English');
    });
  });

  // Tests for createRedditPrompt
  describe('createRedditPrompt', () => {
    test('should generate proper reddit prompt with english language', () => {
      const title = 'How to secure my home network?';
      const content = 'I recently got a new router and want to make sure my network is secure...';
      const url = 'https://reddit.com/r/cybersecurity/posts/12345';
      const lang = 'english';

      const result = createRedditPrompt(title, content, url, lang);

      expect(result).toContain(`Post Title: ${title}`);
      expect(result).toContain('<POST_START>');
      expect(result).toContain(content);
      expect(result).toContain('<POST_END>');
      expect(result).toContain('SECURITY NOTICE');
      expect(result).toContain(`Reddit post below in ${lang}`);
      expect(result).toContain(`End with the source URL: ${url}`);
      expect(result).not.toContain('Keep technical terms in English');
    });

    test('should generate proper reddit prompt with non-english language', () => {
      const title = 'Comment sécuriser mon réseau domestique?';
      const content = "J'ai récemment acheté un nouveau routeur et je veux m'assurer que mon réseau est sécurisé...";
      const url = 'https://reddit.com/r/cybersecurity/posts/12345';
      const lang = 'french';

      const result = createRedditPrompt(title, content, url, lang);

      expect(result).toContain(`Reddit post below in ${lang}`);
      expect(result).toContain('Keep technical terms in English');
    });
  });
});
