#!/usr/bin/env bash
# Install Chromium dependencies for Puppeteer on Render - version 1

set -e

npm install

# Puppeteer install step (downloads Chrome)
PUPPETEER_CACHE_DIR="/opt/render/project/.cache/puppeteer" \
  PUPPETEER_PRODUCT=chrome \
  npm rebuild puppeteer

