#!/bin/sh

curl --silent --show-error \
  -X POST http://127.0.0.1:4252/run \
  -H 'Content-Type: application/json' \
  -d '{"script":"enable.sh"}'
