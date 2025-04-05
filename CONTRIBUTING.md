# Contributing to Cyber Bot

Thank you for your interest in contributing to Cyber Bot! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct:

- Be respectful and inclusive toward other contributors
- Use welcoming and inclusive language
- Be accepting of constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Types of Contributions

There are many ways to contribute to Cyber Bot:

### Code Contributions

- Fixing bugs
- Adding new features
- Improving existing functionality
- Optimizing performance
- Writing tests

### Documentation

- Improving existing documentation
- Adding new documentation

### Content & Data

- Adding new data sources
- Improving prompt templates
- Adding support for new APIs
- Curating cybersecurity resources

### Community Support

- Answering questions
- Reporting bugs
- Suggesting features
- Sharing the project

## Getting Started

### Setting Up Your Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally:

   ```bash
   git clone https://github.com/YOUR_USERNAME/cyber-bot.git
   cd cyber-bot
   ```

3. Add the upstream repository as a remote:

   ```bash
   git remote add upstream https://github.com/kOaDT/cyber-bot.git
   ```

4. Create a new branch for your changes:

   ```bash
   git checkout -b feature/your-feature-name
   ```

5. Install dependencies:

   ```bash
   npm install
   ```

6. Set up your environment variables

### Making Changes

1. Make your changes to the codebase
2. Ensure your code follows the project's coding standards
3. Add or update tests as necessary
4. Run tests to make sure everything works:
   ```bash
   npm test
   ```
5. Update documentation as needed

### Submitting Changes

1. Commit your changes with a descriptive commit message:

   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

2. Push your branch to your fork:

   ```bash
   git push origin feature/your-feature-name
   ```

3. Create a pull request from your fork to the main repository
4. Describe your changes in the pull request, including the motivation for the changes and any additional context

## Pull Request Process

When submitting a pull request:

1. Ensure your code follows the project's coding standards
2. Include tests for new functionality
3. Update documentation as necessary
4. Link any related issues in the pull request description
5. Be responsive to feedback and be willing to make changes to your pull request if requested

### Pull Request Checklist

- ✅ Code follows project coding standards
- ✅ Tests have been added/updated and pass
- ✅ Documentation has been updated
- ✅ Commit messages are clear and descriptive
- ✅ Branch is up to date with the main branch

## Coding Standards

### File Organization

The project follows this general file organization:

- `/crons` - Individual cron job scripts
- `/crons/utils` - Shared utility functions
- `/crons/utils/prompts` - AI prompt templates
- `/services` - External API service integrations
- `/config` - Configuration files
- `/documentation` - Project documentation
- `/assets` - Tracking files and other assets

## Adding New Cron Jobs

If you want to add a new cron job to Cyber Bot, follow these steps:

1. Create a new file in the `/crons` directory with a descriptive name (e.g., `sendNewFeature.js`)
2. Implement the cron job using the established patterns:

   ```javascript
   // Example structure for a new cron job
   const logger = require('./config/logger');
   const { sendMessage } = require('./utils/sendMessage');

   const run = async ({ dryMode, lang }) => {
     try {
       // Your code here
       await sendMessage(message);
       logger.info('Message sent successfully');
     } catch (err) {
       logger.error('Error', { error: err.message });
     }
   };

   module.exports = { run };
   ```

3. Add appropriate tracking files if needed
4. Write tests for your cron job
5. Update documentation to describe your new feature

## License

By contributing to Cyber Bot, you agree that your contributions will be licensed under the project's license.

Cyber Bot is licensed under the [Creative Commons Attribution-NonCommercial 4.0 International License (CC-BY-NC-4.0)](./LICENSE).

## Need Help?

We're excited to have you join the Cyber Bot community! If you have any questions about contributing, feel free to open an issue on GitHub or reach out to the maintainers.

For more detailed information about the project, check our [official documentation](https://koadt.github.io/cyber-bot/).
