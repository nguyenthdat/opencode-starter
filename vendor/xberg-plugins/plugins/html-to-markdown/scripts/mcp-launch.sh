#!/usr/bin/env bash
# html-to-markdown MCP launcher — ensures a working html-to-markdown binary is
# available, then exec's it with the forwarded arguments (the plugin passes
# `mcp`).
#
# Why this exists: the Claude Code plugin ships manifests + scripts, not a
# compiled binary. Rather than require users to install html-to-markdown first,
# this launcher locates or installs a binary on first run, preferring tools the
# user likely already has. Every step FALLS THROUGH to the next on any failure,
# so the launcher self-heals as more distribution channels come online.
#
# Resolution order (override with HTML_TO_MARKDOWN_LAUNCHER=auto|npx|uvx|brew|download):
#
#   a) An existing html-to-markdown on PATH, or cached at $PLUGIN_ROOT/bin — any
#      working binary is accepted (no version match: the CLI release line and the
#      plugin version line are independent).
#   b) npx: probe the published npm CLI package, and if it exposes the CLI, run it.
#   c) uvx: probe the published PyPI CLI package, and if it exposes the CLI, run it.
#   d) brew install xberg-io/tap/html-to-markdown, then exec the on-PATH binary.
#   e) Direct download of the prebuilt CLI archive from the GitHub LATEST release.
#   f) Fail with guidance (brew tap, or `cargo install html-to-markdown-cli` from crates.io).
#
# `auto` tries every step in order; an explicit value pins that single channel
# (each still first honors an already-present binary in step (a)).
#
# The html-to-markdown CLI crate is published to crates.io, so `cargo install
# html-to-markdown-cli` (registry form) works — see the final guidance below.
#
# Note on npx/uvx: the html-to-markdown-cli npm and PyPI proxy packages
# self-install/run the binary (basemind-style). Each is PROBED first and falls
# through cleanly if absent. The `@xberg-io/html-to-markdown` npm package and the importable
# `html-to-markdown` pip package are language SDKs/bindings, NOT the CLI — they
# are not used here.
#
# Note on the download channel: html-to-markdown publishes CLI assets named
# `html-to-markdown-<triple>.tar.gz` (`.zip` on Windows) with NO version in the
# asset name, so we fetch from `releases/latest/download/`. No checksums are
# published alongside the archives, so integrity is TLS-only — we WARN on every
# download and never silently trust. brew/cargo are verified by their own
# tooling and are the recommended install paths.
#
# Note on the MCP subcommand: the `html-to-markdown mcp` server ships in a recent
# release of the tool. An older binary on PATH may not expose it yet; if so,
# update the binary (brew upgrade / re-download) to pick up the `mcp` subcommand.
#
# CRITICAL: stdout is the MCP stdio protocol channel. Every diagnostic in this
# script MUST go to stderr (>&2). Only the exec'd binary may write to stdout.
set -euo pipefail

REPO="xberg-io/html-to-markdown"
NPM_PKG="@xberg-io/html-to-markdown-cli"
PYPI_PKG="html-to-markdown-cli"

log() { printf 'html-to-markdown-launch: %s\n' "$*" >&2; }
die() {
  log "error: $*"
  exit 1
}

LAUNCHER="${HTML_TO_MARKDOWN_LAUNCHER:-auto}"
case "$LAUNCHER" in
auto | npx | uvx | brew | download) ;;
*) die "invalid HTML_TO_MARKDOWN_LAUNCHER='$LAUNCHER' (expected auto|npx|uvx|brew|download)" ;;
esac

want() { [ "$LAUNCHER" = "auto" ] || [ "$LAUNCHER" = "$1" ]; }

# Resolve the plugin root: prefer the value Claude Code injects, else derive it
# from this script's location (scripts/ lives one level under the plugin root).
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$PLUGIN_ROOT" ]; then
  PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

BINARY_NAME="html-to-markdown"
case "$(uname -s)" in
MINGW* | MSYS* | CYGWIN* | Windows_NT) BINARY_NAME="html-to-markdown.exe" ;;
esac
BIN_DIR="$PLUGIN_ROOT/bin"
BIN="$BIN_DIR/$BINARY_NAME"

have() { command -v "$1" >/dev/null 2>&1; }

# ---- (a) Existing binary (cached in the plugin, or on PATH) ------------------
# Accept any binary that runs; the CLI and plugin version lines are independent.
runnable() { [ -x "$1" ] && "$1" --version >/dev/null 2>&1; }

if runnable "$BIN"; then
  log "using cached html-to-markdown at $BIN"
  exec "$BIN" "$@"
fi
if have "$BINARY_NAME"; then
  PATH_BIN="$(command -v "$BINARY_NAME")"
  if runnable "$PATH_BIN"; then
    log "using html-to-markdown on PATH ($PATH_BIN)"
    exec "$PATH_BIN" "$@"
  fi
fi

# ---- (b) npx (published npm CLI package self-installs/runs the CLI) ----------
# npx resolves a same-named local package.json before the registry, so probe and
# run from a scratch cwd to dodge a local package of the same name. The package
# may not be published yet, so PROBE `--version` first and only exec on success.
if want npx && have npx; then
  log "probing npx $NPM_PKG@latest ..."
  scratch="$(mktemp -d)"
  if (cd "$scratch" && npx -y "$NPM_PKG@latest" --version >/dev/null 2>&1); then
    log "launching via npx $NPM_PKG@latest"
    cd "$scratch"
    exec npx -y "$NPM_PKG@latest" "$@"
  fi
  rm -rf "$scratch"
  log "npx $NPM_PKG not available (no CLI bin yet); falling through"
fi

# ---- (c) uvx (published PyPI CLI package self-installs/runs the CLI) ---------
if want uvx && have uvx; then
  log "probing uvx --from $PYPI_PKG $BINARY_NAME ..."
  if uvx --from "$PYPI_PKG" "$BINARY_NAME" --version >/dev/null 2>&1; then
    log "launching via uvx --from $PYPI_PKG $BINARY_NAME"
    exec uvx --from "$PYPI_PKG" "$BINARY_NAME" "$@"
  fi
  log "uvx $PYPI_PKG not available (no CLI entry point yet); falling through"
fi

# ---- (d) Homebrew -----------------------------------------------------------
if want brew && have brew; then
  log "installing via 'brew install xberg-io/tap/html-to-markdown' ..."
  if brew install xberg-io/tap/html-to-markdown >&2; then
    if have "$BINARY_NAME"; then
      BREW_BIN="$(command -v "$BINARY_NAME")"
      runnable "$BREW_BIN" && exec "$BREW_BIN" "$@"
    fi
    log "brew install reported success but html-to-markdown is not on PATH; falling through"
  else
    log "brew install failed; falling through"
  fi
fi

# ---- (e) Prebuilt download from the GitHub LATEST release --------------------
# Falls through (does not die) on unsupported platform or 404 so the final
# guidance can still help the user.
try_download() {
  local arch triple ext base_url asset asset_url tmp ex src_dir
  arch="$(uname -m)"
  case "$(uname -s)" in
  Darwin)
    # Only Apple Silicon (arm64) macOS CLI archives are published.
    case "$arch" in
    arm64 | aarch64) triple="aarch64-apple-darwin" ;;
    *)
      log "no prebuilt macOS archive for $arch (only Apple Silicon is published); falling through"
      return 1
      ;;
    esac
    ;;
  Linux)
    # Prefer gnu; musl is not reliably detectable here and gnu covers the common
    # case. musl-only hosts should build from source.
    case "$arch" in
    aarch64 | arm64) triple="aarch64-unknown-linux-gnu" ;;
    x86_64) triple="x86_64-unknown-linux-gnu" ;;
    *)
      log "no prebuilt Linux archive for $arch; falling through"
      return 1
      ;;
    esac
    ;;
  MINGW* | MSYS* | CYGWIN* | Windows_NT) triple="x86_64-pc-windows-msvc" ;;
  *)
    log "no prebuilt archive for $(uname -s)/$arch; falling through"
    return 1
    ;;
  esac
  case "$triple" in
  *windows*) ext="zip" ;;
  *) ext="tar.gz" ;;
  esac

  # No version in the asset name; pull from the latest release directly.
  base_url="https://github.com/${REPO}/releases/latest/download"
  asset="html-to-markdown-${triple}.${ext}"
  asset_url="${base_url}/${asset}"

  if have curl; then
    fetch() { curl -fsSL --retry 3 -o "$2" "$1"; }
  elif have wget; then
    fetch() { wget -q -O "$2" "$1"; }
  else
    log "no curl or wget available for download; falling through"
    return 1
  fi

  tmp="$(mktemp -d)"
  # shellcheck disable=SC2064  # expand $tmp now so the trap removes this exact dir
  trap "rm -rf '$tmp'" RETURN

  log "downloading $asset from latest release ..."
  if ! fetch "$asset_url" "$tmp/$asset"; then
    log "download failed or asset not found: $asset_url; falling through"
    return 1
  fi

  # No checksums are published with the CLI archives — integrity is TLS-only.
  log "warning: no published checksum for $asset; integrity is verified by HTTPS/TLS only, not a content hash"

  ex="$tmp/extracted"
  mkdir -p "$ex"
  case "$ext" in
  tar.gz) tar -xzf "$tmp/$asset" -C "$ex" || {
    log "extraction failed; falling through"
    return 1
  } ;;
  zip)
    if have unzip; then
      unzip -qo "$tmp/$asset" -d "$ex" || {
        log "extraction failed; falling through"
        return 1
      }
    else
      log "need unzip to extract $asset; falling through"
      return 1
    fi
    ;;
  esac

  # CLI archives may wrap their contents in an "html-to-markdown-<triple>/"
  # directory holding the binary; otherwise the binary sits at the archive root.
  src_dir="$ex/html-to-markdown-${triple}"
  [ -d "$src_dir" ] || src_dir="$ex"
  if [ ! -f "$src_dir/$BINARY_NAME" ]; then
    log "binary $BINARY_NAME not found inside $asset; falling through"
    return 1
  fi

  rm -rf "$BIN_DIR"
  mkdir -p "$BIN_DIR"
  # Move every extracted entry (binary + any bundled lib/) into BIN_DIR.
  mv "$src_dir"/* "$BIN_DIR"/
  chmod +x "$BIN"
  log "installed html-to-markdown to $BIN"
  return 0
}

if want download; then
  if try_download; then
    exec "$BIN" "$@"
  fi
fi

# ---- (f) Give up ------------------------------------------------------------
die "could not locate or install html-to-markdown. Install it manually with one of:
  brew install xberg-io/tap/html-to-markdown
  cargo install html-to-markdown-cli
  or download a prebuilt archive from https://github.com/${REPO}/releases/latest
then ensure 'html-to-markdown' is on PATH and retry."
