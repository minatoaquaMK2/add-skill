#!/usr/bin/env bash
set -euo pipefail

# Idempotent environment setup for skills CLI mission workers
# This script runs at the start of each worker session.

# Ensure Node.js v24 is on PATH (required for .ts file execution)
export PATH="/opt/homebrew/opt/node@24/bin:$HOME/.bun/bin:$PATH"

# Verify required tools
node --version >/dev/null 2>&1 || { echo "ERROR: node not found"; exit 1; }
bun --version >/dev/null 2>&1 || { echo "ERROR: bun not found"; exit 1; }
pnpm --version >/dev/null 2>&1 || { echo "ERROR: pnpm not found"; exit 1; }

# Install dependencies (idempotent)
cd "$(dirname "$0")"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "Environment ready: node $(node --version), bun $(bun --version), pnpm $(pnpm --version)"
