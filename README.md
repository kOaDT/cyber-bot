# Cyber Bot

![Logo](./assets/logo.jpg)

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/kOaDT/cyber-bot?style=social)](https://github.com/kOaDT/cyber-bot/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/kOaDT/cyber-bot?style=social)](https://github.com/kOaDT/cyber-bot/network/members)

[![Version](https://img.shields.io/badge/version-1.19.0-blue.svg)](https://github.com/kOaDT/cyber-bot/releases)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
[![Telegram](https://img.shields.io/badge/Telegram-@bot__cyber__fr-2CA5E0?logo=telegram&logoColor=white)](https://t.me/bot_cyber_fr)
[![Mistral AI](https://img.shields.io/badge/Mistral%20AI-Powered-5A67D8?logo=ai&logoColor=white)](https://mistral.ai/)

</div>

## About

Cyber Bot is a Node.js project that helps users enhance their cybersecurity skills through automated Telegram messages. The bot runs on a VPS (OVH) and leverages Mistral AI to generate cybersecurity-related content.

### Community

- Telegram: [@bot_cyber_fr](https://t.me/bot_cyber_fr)
- Bluesky: [@calebpr.bsky.social](https://bsky.app/profile/cyberhub.blog)
- Website: [www.cyberhub.blog](https://www.cyberhub.blog/)
- Documentation: [koadt.github.io/cyber-bot](https://koadt.github.io/cyber-bot/)

## Features

### Daily TryHackMe Reminders

```
npm run cron -- -c sendTHM
```

### TryHackMe Challenges

```
npm run cron -- -c sendTHMCTF
```

### AI-Enhanced Study Notes

Sends curated notes from a GitHub repository, enhanced by Mistral AI.

```
npm run cron -- -c sendGithubNotes
```

### Cybersecurity News Digest

Aggregates and summarizes news from our [curated RSS feed](https://raw.githubusercontent.com/kOaDT/cyber-bot/refs/heads/develop/assets/CyberSecurityRSS.opml).

```
npm run cron -- -c sendNewsResume
```

### CVE Updates

Fetches and analyzes the latest CVE (Common Vulnerabilities and Exposures) entries.

```
npm run cron -- -c sendCve
```

> Using https://nvd.nist.gov/developers/vulnerabilities

### Darknet Diaries Podcast Summaries

Provides summaries of the latest [Darknet Diaries](https://darknetdiaries.com/) podcast episodes.

```
npm run cron -- -c sendDarknetDiariesResume
```

### Snyk Podcast Summaries

Provides summaries of the latest [Snyk](https://snyk.io/fr/podcasts/the-secure-developer/) podcast episodes.

```
npm run cron -- -c sendSnykResume
```

### Security Now Podcast Summaries

Provides summaries of the latest [Security Now](https://twit.tv/shows/security-now) podcast episodes.

```
npm run cron -- -c sendSecurityNowResume
```

### The Cyber Show Podcast Summaries

Provides summaries of the latest [The Cyber Show](https://cybershow.uk/episodes.php) podcast episodes.

```
npm run cron -- -c sendCyberShowResume
```

### Reddit Content

Fetches and summarizes posts from specified cybersecurity subreddit.

```
npm run cron -- -c sendRedditPost
```

### YouTube Content

Summarizes the latest videos from specified channels.

```
npm run cron -- -c sendYoutubeResume -y https://www.youtube.com/[channel-name]
```

#### Curated Shorts

Shares relevant short-form videos based on customizable parameters (search period, queries, and blacklisted terms). Configure settings in the `sendShort.js` script.

```
npm run cron -- -c sendShort
```

## Getting Started

### Prerequisites

- Node.js 18+
- Telegram Bot Token ([BotFather](https://t.me/BotFather))
- Mistral AI API Key ([Register](https://mistral.ai/))
- VPS (recommended)

### Installation

1. **Clone and Initialize**

```sh
git clone git@github.com:kOaDT/cyber-bot.git
cd cyber-bot

# Create tracking files
mkdir -p assets
touch assets/processedNotes.json       # GithubNotes tracking
touch assets/processedArticles.json    # News tracking
touch assets/processedShorts.json      # Shorts tracking
touch assets/processedDD.json          # Darknet Diaries Podcast tracking
touch assets/processedSnyk.json        # Snyk Podcast tracking
touch assets/processedYt.json          # YouTube tracking
touch assets/processedReddit.json      # Reddit post tracking
touch assets/processedCTF.json         # CTF tracking
touch assets/processedSecurityNow.json # Security Now Podcast tracking
touch assets/processedCyberShow.json   # The Cyber Show Podcast tracking
```

2. **Install Dependencies**

```sh
npm install
```

3. **Configure Environment**

Create a `.env` file with the following variables:

```env
# GitHub Settings
GITHUB_SECRET=
GITHUB_USERNAME=
GITHUB_REPO=
# Optional
EXCLUDED_GITHUB_FILES=

# Telegram Settings
TELEGRAM_BOT_TOKEN=
CHAT_ID=
# Optional Topic IDs for message organization
TELEGRAM_TOPIC_THM=
TELEGRAM_TOPIC_NEWS=
TELEGRAM_TOPIC_YOUTUBE=
TELEGRAM_TOPIC_PODCAST=
TELEGRAM_TOPIC_GITHUB=
TELEGRAM_TOPIC_REDDIT=
TELEGRAM_TOPIC_CVE=

# Mistral AI Settings
MISTRAL_API_KEY=
# Optional, comma-separated
AUTHORIZED_LANGUAGES=

# AssemblyAI - Text-to-Speech
ASSEMBLYAI_API_KEY=

# YouTube Settings
YOUTUBE_API_KEY=

# Reddit
REDDIT_SUBREDDITS=
REDDIT_DAYS_LOOKBACK=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=

# CVE
CVSS_SEVERITY_THRESHOLD=   # Default >= 7.0
HOURS_DELAY=               # Default 24 hours
TECHNOLOGIES_OF_INTEREST=

# Optional Database Settings
MYSQL_HOST=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=
I_WANT_TO_SAVE_MESSAGES_IN_DB=true # Enable message logging in database
```

> **Note:** This project is designed to work without a database by default. However, you can enable message logging in a MySQL database by setting `I_WANT_TO_SAVE_MESSAGES_IN_DB=true` and configuring the database connection variables defined in `/config/dbConfig.js`. The database should contain a `TelegramLogs` table with at least two columns: `message` and `dateAdd`. This feature uses the `mysql2` package.

4. **Optional: Customize Mistral AI parameters**

```
/crons/config/mistral.js
```

5. **Optional: Modify bot prompts**

```
/crons/utils/prompts
```

## Usage

### Basic Command

```sh
npm run cron -- -c <CRON_NAME>
```

### With Language Specification

```sh
npm run cron -- -c <CRON_NAME> -l <language>
```

> **Note:** Content language is restricted by the `AUTHORIZED_LANGUAGES` environment variable to avoid prompt injection. Default is English.

## Documentation

For VPS deployment guidance, check our [deployment guide](https://koadt.vercel.app/blog/deploy-your-own-cron-jobs-server-on-a-vps-in-9-simple-steps/).

## Contributing

We welcome contributions! Feel free to:

- Report issues
- Submit pull requests
- Suggest new features

## License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0).

This means you are free to share and adapt this work for non-commercial purposes, as long as you provide appropriate attribution. More information: [LICENSE](./LICENSE)

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)

---

<div align="center">
Made by <a href="https://github.com/kOaDT">kOaDT</a>
</div>
