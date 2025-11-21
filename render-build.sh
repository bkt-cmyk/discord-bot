#!/usr/bin/env bash
set -e

echo "Installing dependencies"
npm install

echo "Rebuilding puppeteer with bundled chrome"
PUPPETEER_PRODUCT=chrome \
PUPPETEER_CACHE_DIR="/opt/render/project/.cache/puppeteer" \
npm rebuild puppeteer

echo "Build completed"
