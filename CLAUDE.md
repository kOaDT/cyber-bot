# CLAUDE.md

This file provides guidance for Claude Code when working on this project.

## Project Overview

Cyber Bot is a Node.js application that delivers cybersecurity educational content via Telegram. It uses AI (Mistral or Claude) to summarize and enhance content from various sources (RSS feeds, podcasts, YouTube, Reddit, GitHub, CVEs).

## Architecture

```
cyber-bot/
├── index.js                    # CLI entry point (uses commander)
├── crons/                      # Scheduled job scripts
│   ├── config/                 # Configuration modules
│   │   ├── providers/          # AI provider implementations
│   │   │   ├── index.js        # Provider factory
│   │   │   ├── mistral.js      # Mistral provider
│   │   │   └── claude.js       # Claude provider
│   │   ├── mistral.js          # Legacy Mistral config (backward compat)
│   │   ├── logger.js           # Winston logger with Slack integration
│   │   └── dbConfig.js         # MySQL configuration
│   ├── utils/                  # Utility modules
│   │   ├── generate.js         # AI generation wrapper
│   │   ├── prompts.js          # Prompt templates
│   │   ├── sanitize.js         # Input/output sanitization
│   │   ├── sendMessage.js      # Telegram API wrapper
│   │   └── ...
│   └── send*.js                # Individual cron job scripts
├── assets/                     # Processed item tracking (JSON files)
└── __tests__/                  # Jest test suites
```

## Key Commands

```bash
npm run cron -- -c <CRON_NAME>           # Run a specific cron job
npm run cron -- -c <CRON_NAME> -l fr     # Run with language option
npm test                                  # Run all tests
npm run test:coverage                     # Run tests with coverage
npm run lint                              # Run ESLint
npm run lint-fix                          # Fix linting issues
```

## AI Provider Configuration

The project supports multiple AI providers via environment variables:

```env
AI_PROVIDER=mistral|claude       # Default: mistral

# Mistral configuration
MISTRAL_API_KEY=                 # Required if AI_PROVIDER=mistral
MISTRAL_MODEL=mistral-large-2411 # Default model

# Claude configuration
CLAUDE_API_KEY=                  # Required if AI_PROVIDER=claude
CLAUDE_MODEL=claude-opus-4-20250514  # Default model
```

## Code Patterns

### Provider Pattern

AI providers implement a common interface:

```javascript
class Provider {
  constructor() {
    /* validate API key, init client */
  }
  async generate(prompt, overrideParams = {}) {
    /* return string */
  }
}
```

### Security

- Input sanitization via `sanitizeForPrompt()` before sending to AI
- Output validation via `validateLLMOutput()` to detect credential leaks
- Prompt injection protection patterns in `sanitize.js`

### Error Handling

- Rate limits (429) trigger automatic failover to the alternate provider if both API keys are configured; if both providers are rate-limited, the process exits
- Other API errors return `null` from `generate()`
- All sensitive operations are logged via Winston

## Testing

Tests use Jest with module mocking:

```javascript
jest.mock('../config/providers', () => ({
  getProvider: jest.fn(() => mockProvider),
}));
```

Environment variables are mocked by saving/restoring `process.env` in `beforeEach`/`afterEach`.

## Important Files

- `crons/utils/generate.js` - Core AI abstraction, all crons use this
- `crons/utils/prompts.js` - All prompt templates
- `crons/utils/sanitize.js` - Security validation
- `crons/config/providers/index.js` - Provider factory

## Environment Variables

Required:

- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `CHAT_ID` - Telegram chat ID
- `MISTRAL_API_KEY` or `CLAUDE_API_KEY` - AI provider key

Optional:

- `AI_PROVIDER` - `mistral` (default) or `claude`
- `LOG_LEVEL` - Winston log level (default: `info`)
- Various `TELEGRAM_TOPIC_*` for message organization
