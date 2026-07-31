#!/bin/bash
# Submit KimiMint contracts for BscScan v2 verification
# Usage: ./submit-verify.sh <address> <contract-name> [constructor-args]
set -e

ADDR="$1"
CONTRACT="$2"
ARGS="${3:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SOURCE_FILE="$PROJECT_DIR/work/full-standard-json-input.json"

if [ ! -f "$SOURCE_FILE" ]; then
  echo "ERROR: $SOURCE_FILE not found. Run node scripts/prepare-full-verify.mjs first."
  exit 1
fi

API_KEY="${BSCSCAN_API_KEY:-Y9SWA2SK9A2MUEBHGVR5Q4TSHQ3U4R5YES}"
PROXY="${HTTPS_PROXY:-http://127.0.0.1:7898}"

# Build the form data manually with the source file
TMPFILE=$(mktemp)
echo -n "module=contract&action=verifysourcecode&apikey=${API_KEY}&contractaddress=${ADDR}&contractname=${CONTRACT}&codeformat=solidity-standard-json-input&compilerversion=v0.8.36%2Bcommit.8a079791&optimizationUsed=1&runs=1&licenseType=3" > "$TMPFILE"

if [ -n "$ARGS" ]; then
  echo -n "&constructorArguements=${ARGS}" >> "$TMPFILE"
fi

echo -n "&sourceCode=" >> "$TMPFILE"
# URL-encode the source file content
python3 -c "
import urllib.parse, sys
with open('$SOURCE_FILE') as f:
    sys.stdout.write(urllib.parse.quote(f.read(), safe=''))
" >> "$TMPFILE"

# Submit
if [ -n "$PROXY" ] && [ "$PROXY" != "none" ]; then
  curl -s --proxy "$PROXY" -X POST "https://api.etherscan.com/v2/api?chainid=56" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "@$TMPFILE"
else
  curl -s -X POST "https://api.etherscan.com/v2/api?chainid=56" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "@$TMPFILE"
fi

rm -f "$TMPFILE"
