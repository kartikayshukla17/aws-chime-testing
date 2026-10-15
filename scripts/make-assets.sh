#!/usr/bin/env bash
# Generates looping fake camera (y4m) and fake mic (wav) used by Playwright bots.
set -euo pipefail
cd "$(dirname "$0")/../assets"
ffmpeg -y -f lavfi -i testsrc2=size=640x360:rate=15 -t 10 -pix_fmt yuv420p bot.y4m
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=10" -ar 48000 -ac 1 bot.wav
echo "assets ready"
