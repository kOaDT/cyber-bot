#!/bin/bash

npm run cron -- -c sendCTFChallenge --dry-mode && \
npm run cron -- -c sendCve --dry-mode && \
npm run cron -- -c sendGithubNotes --dry-mode && \
npm run cron -- -c sendNewsResume --dry-mode && \
npm run cron -- -c sendDarknetDiariesResume --dry-mode && \
npm run cron -- -c sendSnykResume --dry-mode && \
npm run cron -- -c sendSecurityNowResume --dry-mode && \
npm run cron -- -c sendCyberShowResume --dry-mode && \
npm run cron -- -c sendYoutubeResume -y https://www.youtube.com/@NoLimitSecu --dry-mode && \
npm run cron -- -c sendRedditPost --dry-mode