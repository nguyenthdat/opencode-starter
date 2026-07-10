#!/usr/bin/env bash
# Verify every manifest in .version-bump.json matches its group's version file
# (marketplace -> VERSION, opencode -> OPENCODE_VERSION). Exits non-zero on drift.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$REPO_ROOT/.version-bump.json"

dotted_to_jq_path() { echo ".$1" | sed -E 's/\.([0-9]+)/[\1]/g'; }

fail=0
while IFS= read -r group; do
  version_file="$(jq -r --arg g "$group" '.groups[] | select(.name == $g) | .version_file' "$CONFIG")"
  expected="$(tr -d '[:space:]' <"$REPO_ROOT/$version_file")"
  group_fail=0

  while IFS=$'\t' read -r relpath field; do
    abs="$REPO_ROOT/$relpath"
    if [ ! -f "$abs" ]; then
      echo "validate-manifests: missing $relpath [$group]" >&2
      group_fail=1
      continue
    fi
    if [ "$field" = "__raw__" ]; then
      actual="$(tr -d '[:space:]' <"$abs")"
    else
      actual="$(jq -r "$(dotted_to_jq_path "$field")" "$abs")"
    fi
    if [ "$actual" != "$expected" ]; then
      echo "validate-manifests: $relpath ($field) = '$actual', expected '$expected' [$group]" >&2
      group_fail=1
    fi
  done < <(jq -r --arg g "$group" '.groups[] | select(.name == $g) | .files[] | [.path, .field] | @tsv' "$CONFIG")

  if [ "$group_fail" -eq 0 ]; then
    echo "validate-manifests: group '$group' all match $expected"
  else
    fail=1
  fi
done < <(jq -r '.groups[].name' "$CONFIG")

exit "$fail"
