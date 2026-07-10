#!/usr/bin/env bash
# Bump versions for a version group declared in .version-bump.json.
# Usage: scripts/bump-version.sh [--group <name>] [new-semver]
#   default group: marketplace (tracks VERSION — the claude/codex/cursor/factory
#   /github/gemini plugin manifests). The opencode group tracks OPENCODE_VERSION
#   (the @xberg-io/opencode-* npm packages, versioned independently).
# Examples:
#   scripts/bump-version.sh 0.2.3                    # bump the marketplace plugins
#   scripts/bump-version.sh --group opencode 0.1.1   # bump the npm packages
#   scripts/bump-version.sh --group opencode         # sync packages from OPENCODE_VERSION
set -euo pipefail

command -v jq >/dev/null 2>&1 || {
  echo "bump-version: jq is required" >&2
  exit 1
}

GROUP="marketplace"
NEW=""
while [ $# -gt 0 ]; do
  case "$1" in
  --group)
    GROUP="${2:?--group needs a name}"
    shift 2
    ;;
  --group=*)
    GROUP="${1#*=}"
    shift
    ;;
  -h | --help)
    sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  -*)
    echo "bump-version: unknown flag '$1'" >&2
    exit 2
    ;;
  *)
    NEW="$1"
    shift
    ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$REPO_ROOT/.version-bump.json"
[ -f "$CONFIG" ] || {
  echo "bump-version: $CONFIG not found" >&2
  exit 1
}

version_file="$(jq -r --arg g "$GROUP" '.groups[] | select(.name == $g) | .version_file' "$CONFIG")"
if [ -z "$version_file" ] || [ "$version_file" = "null" ]; then
  echo "bump-version: unknown group '$GROUP' (known: $(jq -r '.groups[].name' "$CONFIG" | paste -sd, -))" >&2
  exit 2
fi

if [ -z "$NEW" ]; then
  [ -f "$REPO_ROOT/$version_file" ] || {
    echo "bump-version: $version_file not found for group '$GROUP'" >&2
    exit 1
  }
  NEW="$(tr -d '[:space:]' <"$REPO_ROOT/$version_file")"
fi

# semver (with optional pre-release / build metadata)
if ! [[ "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]]; then
  echo "bump-version: '$NEW' is not a valid semver" >&2
  exit 2
fi

# Convert a dotted field like "plugins.0.version" into a jq path ".plugins[0].version".
dotted_to_jq_path() { echo ".$1" | sed -E 's/\.([0-9]+)/[\1]/g'; }

written=0
missing=0
while IFS=$'\t' read -r relpath field; do
  abs="$REPO_ROOT/$relpath"
  if [ ! -f "$abs" ]; then
    echo "bump-version: skipping missing $relpath" >&2
    missing=$((missing + 1))
    continue
  fi
  if [ "$field" = "__raw__" ]; then
    printf '%s\n' "$NEW" >"$abs"
  else
    tmp="$(mktemp)"
    jq --arg v "$NEW" "$(dotted_to_jq_path "$field") = \$v" "$abs" >"$tmp"
    mv "$tmp" "$abs"
  fi
  written=$((written + 1))
done < <(jq -r --arg g "$GROUP" '.groups[] | select(.name == $g) | .files[] | [.path, .field] | @tsv' "$CONFIG")

echo "bump-version: group '$GROUP' -> $NEW (wrote $written files, $missing skipped)"
