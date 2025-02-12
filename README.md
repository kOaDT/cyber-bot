# Cyber Bot

Cyber Bot is an open-source Node.js project designed to help users improve their cybersecurity skills through scheduled Telegram messages. The bot runs on a VPS (OVH) and uses Mistral AI to generate content about cybersecurity.

This project is completely open-source, and you are welcome to clone, modify, and use it to create your own bot. If you'd like to see the bot in action, join my Telegram channel: [@bot_cyber_fr](https://t.me/bot_cyber_fr).

## Features

- Sends daily reminders to users for TryHackMe

```
npm run cron -- -c sendTHM
```

- Sends summary notes taken from a github repository, enhanced by Mistral AI

```
npm run cron -- -c sendGithubNotes
```

- Sends a summary of the latest cybersecurity news. Based on the RSS feed: [CyberSecurity RSS](https://raw.githubusercontent.com/kOaDT/cyber-bot/refs/heads/develop/assets/CyberSecurityRSS.opml)

```
npm run cron -- -c sendNewsResume
```

- More features coming soon...

## Getting Started

### Prerequisites

- Node.js installed
- A Telegram bot (create one via [BotFather](https://t.me/BotFather))
- A Mistral AI API key ([Get one here](https://mistral.ai/))
- A VPS (optional, but recommended)

### Installation

1. Clone the repository:

   ```sh
   git clone git@github.com:kOaDT/cyber-bot.git
   cd cyber-bot
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Create a `.env` file and add the following environment variables:

   ```env
   # GitHub Configuration
   GITHUB_SECRET=
   GITHUB_USERNAME=
   GITHUB_REPO=

   # Telegram Configuration
   TELEGRAM_BOT_TOKEN=
   CHAT_ID=

   # Mistral AI Configuration
   MISTRAL_API_KEY=

   # Optional
   EXCLUDED_GITHUB_FILES=
   AUTHORIZED_LANGUAGES=
   ```

4. Configure Mistral AI settings (if needed) by editing the `DEFAULT_PARAMS` in:

   ```sh
   /crons/config/mistral.js
   ```

5. Customize the bot's prompts (if needed) in:
   ```sh
   /crons/utils/prompts
   ```

## Running the Bot

To execute a cron job, use:

```sh
npm run cron -- -c CRON_NAME
```

You can also specify a language (for example, French):

```sh
npm run cron -- -c CRON_NAME -l french
```

The language is used to generate the content with Mistral AI. If you specify 'french', the bot will generate the content in French.

To avoid prompt injection, the language is limited with the `AUTHORIZED_LANGUAGES` environment variable. You can add as many languages as you want, separated by commas. The default language for generated content is english.

## Deployment

If you need help deploying your bot on a VPS, check out this guide: [Deploy Your Own Cron Jobs Server on a VPS](https://www.caleb-tech.blog/blog/deploy-your-own-cron-jobs-server-on-a-vps-in-9-simple-steps/).

## Contributing

Contributions are welcome! Feel free to submit issues, pull requests, or feature suggestions.

## License

This project is completely open-source. You are free to reuse, modify, or distribute the code as long as you provide appropriate credit by citing the original source (this repository).

![QR Code](./assets/qr.jpg)
