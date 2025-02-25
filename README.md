# 🤖 Cyber Bot

![Logo](./assets/logo.jpg)

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/bot_cyber_fr)
[![Mistral AI](https://img.shields.io/badge/Mistral%20AI-5A67D8?style=for-the-badge&logo=ai&logoColor=white)](https://mistral.ai/)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/kOaDT/cyber-bot)

</div>

## 📖 About

Cyber Bot is an Node.js project that helps users enhance their cybersecurity skills through automated Telegram messages. The bot runs on a VPS (OVH) and leverages Mistral AI to generate cybersecurity-related content.

### 🌐 Join Our Community

- 📱 Telegram: [@bot_cyber_fr](https://t.me/bot_cyber_fr)
- 🦋 Bluesky: [@calebpr.bsky.social](https://bsky.app/profile/calebpr.bsky.social)
- 🌐 Website: [www.cyberhub.blog](https://www.cyberhub.blog/)

## ⚡ Features

### 🎯 Daily TryHackMe Reminders

```
npm run cron -- -c sendTHM
```

### 📚 AI-Enhanced Study Notes

Sends curated notes from a GitHub repository, enhanced by Mistral AI

```
npm run cron -- -c sendGithubNotes
```

### 📰 Cybersecurity News Digest

Aggregates and summarizes news from our [curated RSS feed](https://raw.githubusercontent.com/kOaDT/cyber-bot/refs/heads/develop/assets/CyberSecurityRSS.opml)

```
npm run cron -- -c sendNewsResume
```

### 🎙️ Darknet Diaries Summaries

Provides summaries of the latest [Darknet Diaries](https://darknetdiaries.com/) podcast episodes

```
npm run cron -- -c sendDarknetDiariesResume
```

### 🎬 YouTube Content

Summarizes the latest videos from specified channels

```
npm run cron -- -c sendYoutubeResume -y https://www.youtube.com/[channel-name]
```

#### Curated Shorts

Shares relevant short-form videos based on customizable parameters (search period, queries, and blacklisted terms). Configure settings in the `sendShort.js` script.

```
npm run cron -- -c sendShort
```

## 🚀 Getting Started

### Prerequisites

- 📦 Node.js
- 🤖 Telegram Bot Token ([BotFather](https://t.me/BotFather))
- 🧠 Mistral AI API Key ([Register](https://mistral.ai/))
- 💻 VPS (recommended)

### Installation

1. **Clone and Initialize**

```sh
git clone git@github.com:kOaDT/cyber-bot.git
cd cyber-bot

# Create tracking files
mkdir -p assets
touch assets/processedArticles.json    # News tracking
touch assets/lastProcessedDD.json      # Darknet Diaries tracking
touch assets/lastProcessedYt.json      # YouTube tracking
touch assets/processedShorts.json      # Shorts tracking
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
TELEGRAM_TOPIC_DARKNET=
TELEGRAM_TOPIC_GITHUB=

# Mistral AI Settings
MISTRAL_API_KEY=
# Optional, comma-separated
AUTHORIZED_LANGUAGES=

# YouTube Settings
YOUTUBE_API_KEY=
```

4. **Optional: Customize Mistral AI parameters**

```
/crons/config/mistral.js
```

5. **Optional: Modify bot prompts**

```
/crons/utils/prompts
```

## 🛠️ Usage

### Basic Command

```sh
npm run cron -- -c <CRON_NAME>
```

### With Language Specification

```sh
npm run cron -- -c <CRON_NAME> -l <language>
```

> 📝 Note: Content language is restricted by the `AUTHORIZED_LANGUAGES` environment variable to avoid prompt injection. Default is English.

## 📚 Documentation

For VPS deployment guidance, visit our [deployment guide](https://www.caleb-tech.blog/blog/deploy-your-own-cron-jobs-server-on-a-vps-in-9-simple-steps/).

## 🤝 Contributing

We welcome contributions! Feel free to:

- 🐛 Report issues
- 🔀 Submit pull requests
- 💡 Suggest new features

## 📄 License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0).

This means you are free to share and adapt this work for non-commercial purposes, as long as you provide appropriate attribution. More information: [LICENSE](./LICENSE)

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)

---

<div align="center">
Made by <a href="https://github.com/kOaDT">kOaDT</a>
</div>
