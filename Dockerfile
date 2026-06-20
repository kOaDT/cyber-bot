FROM node:24-bookworm-slim

# puppeteer needs a browser; use the system chromium and skip its own download.
ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium ca-certificates dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts skips the husky `prepare` hook (dev-only) and puppeteer's
# bundled-chromium download (we use the system one above).
RUN npm ci --omit=dev --ignore-scripts
COPY . .
USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js", "--help"]
