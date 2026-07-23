#!/usr/bin/env bash
set -euo pipefail

project_name="$(basename "$PWD")"

export COLLECTION_NAME="$project_name"

exec uvx mcp-server-qdrant
