const Anthropic = require('@anthropic-ai/sdk');

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

const DEFAULT_PARAMS = {
  model: process.env.CLAUDE_MODEL || 'claude-opus-4-20250514',
  max_tokens: parseInt(process.env.CLAUDE_MAX_TOKENS, 10) || 2000,
  temperature: parseFloat(process.env.CLAUDE_TEMPERATURE) || 0.1,
};

class ClaudeProvider {
  constructor() {
    if (!CLAUDE_API_KEY) {
      throw new Error('CLAUDE_API_KEY is not set');
    }
    this.client = new Anthropic({ apiKey: CLAUDE_API_KEY });
    this.name = 'Claude';
  }

  async generate(prompt, overrideParams = {}) {
    const claudeParams = this._mapParams(overrideParams);

    const response = await this.client.messages.create({
      ...DEFAULT_PARAMS,
      ...claudeParams,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content[0].text;
  }

  _mapParams(params) {
    const mapped = { ...params };

    delete mapped.top_p;
    delete mapped.random_seed;
    delete mapped.presence_penalty;
    delete mapped.frequency_penalty;

    return mapped;
  }
}

module.exports = { ClaudeProvider, DEFAULT_PARAMS };
