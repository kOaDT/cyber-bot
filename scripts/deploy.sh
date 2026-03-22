#!/bin/bash
set -euo pipefail

DEPLOY_DIR="/home/ubuntu/dev/cyber-bot"

if [ ! -d "$DEPLOY_DIR" ]; then
  echo "Error: deploy directory $DEPLOY_DIR does not exist" >&2
  exit 1
fi

cd "$DEPLOY_DIR"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Error: expected branch 'main', currently on '$CURRENT_BRANCH'" >&2
  exit 1
fi

echo "Pulling latest changes..."
git pull origin main --ff-only

echo "Installing dependencies..."
npm ci --omit=dev

echo "Deployment complete."
