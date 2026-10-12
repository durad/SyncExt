#!/bin/sh
set -eu

/Applications/Ghostty.app/Contents/MacOS/ghostty \
    --config-file="/Users/dusan/Library/Application Support/com.mitchellh.ghostty/config" \
    --background=000000 \
    </dev/null >/dev/null 2>&1 &

echo "Started Ghostty (PID: $!)"


