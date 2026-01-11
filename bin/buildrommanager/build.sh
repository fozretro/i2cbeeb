#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Parse command line arguments
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

# Check if Node.js is available
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed or not in PATH"
  exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
  echo "Error: npm is not installed or not in PATH"
  exit 1
fi

# Check if package.json exists
[ ! -f "package.json" ] && {
  echo "Error: package.json not found" >&2
  exit 1
}

# Ensure dependencies are installed
npm install >/dev/null 2>&1 || {
  echo "Error: Failed to install dependencies" >&2
  exit 1
}

# Clear output directory at start
OUT_DIR="out"
if [ -d "$OUT_DIR" ]; then
  rm -rf "$OUT_DIR"/*
fi
mkdir -p "$OUT_DIR"

# Check if rommanager.bas exists
[ ! -f "../../src.rommanager/rommanager.bas" ] && {
  echo "Error: rommanager.bas not found" >&2
  exit 1
}

# Check if required build files exist
[ ! -f "bin/!Compile" ] && {
  echo "Error: !Compile not found" >&2
  exit 1
}

[ ! -f "bin/6502_BASIC" ] && {
  echo "Error: 6502_BASIC not found" >&2
  exit 1
}

# ANSI color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
RESET='\033[0m'

echo ""
echo -e "${GREEN}*** Building ROM Manager ROM ***${RESET}"
if [ "$VERBOSE" = true ]; then
  set +e  # Temporarily disable exit on error to capture exit code
  node build.js --verbose
  BUILD_RESULT=$?
  set -e  # Re-enable exit on error
else
  set +e  # Temporarily disable exit on error to capture exit code
  node build.js
  BUILD_RESULT=$?
  set -e  # Re-enable exit on error
fi

if [ $BUILD_RESULT -eq 0 ]; then
  echo ""
  echo -e "${GREEN}Build completed successfully${RESET}"
else
  echo ""
  echo -e "${RED}Build failed${RESET}"
  exit 1
fi
