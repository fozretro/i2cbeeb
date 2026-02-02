#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VERBOSE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--verbose|-v]"
            echo "  --verbose, -v    Enable verbose logging"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed or not in PATH"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo "Error: npm is not installed or not in PATH"
  exit 1
fi

COMMON_DIR="$(cd "$SCRIPT_DIR/../buildarmbas6502" && pwd)"
[ ! -f "$COMMON_DIR/package.json" ] && {
  echo "Error: buildarmbas6502/package.json not found" >&2
  exit 1
}

npm --prefix "$COMMON_DIR" install >/dev/null 2>&1 || {
  echo "Error: Failed to install dependencies in buildarmbas6502" >&2
  exit 1
}

OUT_DIR="out"
if [ -d "$OUT_DIR" ]; then
  rm -rf "$OUT_DIR"/*
fi
mkdir -p "$OUT_DIR"

[ ! -f "../../src.plus1support/plus1support.bas" ] && {
  echo "Error: plus1support.bas not found" >&2
  exit 1
}

GREEN='\033[0;32m'
RED='\033[0;31m'
RESET='\033[0m'

echo ""
echo -e "${GREEN}*** Building Plus 1 Support ROM ***${RESET}"
if [ "$VERBOSE" = true ]; then
  set +e
  node "$COMMON_DIR/build.js" --config "$SCRIPT_DIR/config.json" --verbose
  BUILD_RESULT=$?
  set -e
else
  set +e
  node "$COMMON_DIR/build.js" --config "$SCRIPT_DIR/config.json"
  BUILD_RESULT=$?
  set -e
fi

if [ $BUILD_RESULT -ne 0 ]; then
  echo ""
  echo -e "${RED}Build failed${RESET}"
  exit 1
fi

echo ""
echo -e "${GREEN}Build completed successfully${RESET}"
