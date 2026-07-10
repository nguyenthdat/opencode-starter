#!/usr/bin/env bash
# crawlberg MCP launcher — locates or installs a working crawlberg binary,
# then exec's it with the forwarded arguments (the plugin passes `mcp`).
#
# Why this exists: the plugin ships manifests + scripts, not a compiled binary.
# Rather than require users to install crawlberg first, this launcher finds or
# installs one on first run, preferring tools the user likely already has. Every
# step FALLS THROUGH to the next on any failure, so the launcher self-heals as
# more distribution channels come online.
#
# Resolution order (override with CRAWLBERG_LAUNCHER=auto|npx|uvx|brew|download):
#
#   a) An existing crawlberg binary (cached in the plugin's bin/, or on PATH
#      from a prior brew install) — any working binary is accepted; there is no
#      strict version match, because the plugin version and the upstream CLI
#      version are decoupled.
#   b) npx: probe the published npm package, and if it exposes the CLI, run it.
#   c) uvx: probe the published PyPI package, and if it exposes the CLI, run it.
#   d) brew install xberg-io/tap/crawlberg, then exec the on-PATH binary.
#   e) Direct download of the prebuilt CLI archive from the GitHub *latest*
#      release. The current latest release ships NO CLI asset, so this 404s and
#      falls through; it self-heals once a CLI archive is attached.
#   f) Give up with guidance (brew tap, or `cargo install crawlberg-cli`
#      from crates.io with `--features all`).
#
# `auto` tries every step in order; an explicit value pins that single channel
# (each still first honors an already-present binary in step (a)).
#
# The crawlberg CLI crate is published to crates.io, so `cargo install
# crawlberg-cli` (registry form) works — see the final guidance below. The
# CLI's `mcp` subcommand lives behind a non-default feature, so the install
# command uses `--features all`.
#
# Note on npx/uvx: the crawlberg npm and PyPI CLI packages self-install/run the binary
# (basemind-style). Each is PROBED first and falls through cleanly if absent.
# The `@xberg-io/crawlberg` npm package and the importable pip package are
# language SDKs/bindings, NOT the CLI — they are not used here.
#
# CRITICAL: stdout is the MCP stdio protocol channel. Every diagnostic in this
# script MUST go to stderr (>&2). Only the exec'd binary may write to stdout.
set -euo pipefail

NPM_PKG="@xberg-io/crawlberg-cli"
PYPI_PKG="crawlberg-cli"

log() { printf 'crawlberg-launch: %s\n' "$*" >&2; }
die() {
  log "error: $*"
  exit 1
}

LAUNCHER="${CRAWLBERG_LAUNCHER:-auto}"
case "$LAUNCHER" in
auto | npx | uvx | brew | download) ;;
*) die "invalid CRAWLBERG_LAUNCHER='$LAUNCHER' (expected auto|npx|uvx|brew|download)" ;;
esac

want() { [ "$LAUNCHER" = "auto" ] || [ "$LAUNCHER" = "$1" ]; }

# Resolve the plugin root: prefer the value Claude Code injects, else derive it
# from this script's location (scripts/ lives one level under the plugin root).
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$PLUGIN_ROOT" ]; then
  PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

BINARY_NAME="crawlberg"
case "$(uname -s)" in
MINGW* | MSYS* | CYGWIN* | Windows_NT) BINARY_NAME="crawlberg.exe" ;;
esac
BIN_DIR="$PLUGIN_ROOT/bin"
BIN="$BIN_DIR/$BINARY_NAME"

have() { command -v "$1" >/dev/null 2>&1; }

# Confirm a candidate path is an executable crawlberg that actually runs.
runs_ok() { [ -x "$1" ] && "$1" --version >/dev/null 2>&1; }

# ---- (a) Existing binary (cached or on PATH) --------------------------------
if runs_ok "$BIN"; then
  log "using cached crawlberg at $BIN"
  exec "$BIN" "$@"
fi
if have "$BINARY_NAME"; then
  PATH_BIN="$(command -v "$BINARY_NAME")"
  if runs_ok "$PATH_BIN"; then
    log "using crawlberg on PATH ($PATH_BIN)"
    exec "$PATH_BIN" "$@"
  fi
fi

# ---- (b) npx (published npm package self-installs/runs the CLI) --------------
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

# ---- (c) uvx (published PyPI package self-installs/runs the CLI) -------------
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
  log "installing via 'brew install xberg-io/tap/crawlberg' ..."
  if brew install xberg-io/tap/crawlberg >&2; then
    if have "$BINARY_NAME"; then
      BREW_BIN="$(command -v "$BINARY_NAME")"
      runs_ok "$BREW_BIN" && exec "$BREW_BIN" "$@"
    fi
    log "brew install reported success but crawlberg is not on PATH; falling through"
  else
    log "brew install failed; falling through"
  fi
fi

# ---- (e) Direct prebuilt download (GitHub latest release) -------------------
# Asset names carry NO version (crawlberg-cli-<triple>.{tar.gz,zip}); the
# release pipeline builds the CLI with `--features all`, so the downloaded
# binary includes the `mcp` and `api` subcommands. Use the `latest` redirect so
# the plugin never hard-codes an upstream version. The current latest release
# ships no CLI asset, so this 404s and falls through (self-heals once attached).
download_install() {
  local arch triple ext base_url asset asset_url tmp ex src_bin src_dir
  arch="$(uname -m)"
  case "$(uname -s)" in
  Darwin)
    case "$arch" in
    arm64 | aarch64) triple="aarch64-apple-darwin" ;;
    x86_64) triple="x86_64-apple-darwin" ;;
    *)
      log "download: unsupported macOS architecture: $arch; falling through"
      return 1
      ;;
    esac
    ;;
  Linux)
    case "$arch" in
    aarch64 | arm64) triple="aarch64-unknown-linux-gnu" ;;
    x86_64) triple="x86_64-unknown-linux-gnu" ;;
    *)
      log "download: unsupported Linux architecture: $arch; falling through"
      return 1
      ;;
    esac
    ;;
  MINGW* | MSYS* | CYGWIN* | Windows_NT) triple="x86_64-pc-windows-msvc" ;;
  *)
    log "download: unsupported platform: $(uname -s) $arch; falling through"
    return 1
    ;;
  esac
  case "$triple" in
  *windows*) ext="zip" ;;
  *) ext="tar.gz" ;;
  esac

  base_url="https://github.com/xberg-io/crawlberg/releases/latest/download"
  asset="crawlberg-cli-${triple}.${ext}"
  asset_url="${base_url}/${asset}"

  if have curl; then
    fetch() { curl -fsSL --retry 3 -o "$2" "$1"; }
  elif have wget; then
    fetch() { wget -q -O "$2" "$1"; }
  else
    log "download: need curl or wget; falling through"
    return 1
  fi

  tmp="$(mktemp -d)"
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" RETURN

  # SECURITY: crawlberg's release pipeline publishes no checksums manifest for
  # the CLI archives, so this download's integrity rests solely on GitHub's TLS.
  # There is no out-of-band sha256 to verify against. If the publish workflow
  # starts emitting a checksums file, add fail-closed verification here.
  log "warning: no published checksum for $asset; integrity relies on TLS only."
  log "downloading $asset from latest release ..."
  if ! fetch "$asset_url" "$tmp/$asset"; then
    log "download: fetch failed (asset missing or network error): $asset_url; falling through"
    return 1
  fi

  log "extracting ..."
  ex="$tmp/extracted"
  mkdir -p "$ex"
  case "$ext" in
  tar.gz) tar -xzf "$tmp/$asset" -C "$ex" || return 1 ;;
  zip)
    if have unzip; then
      unzip -qo "$tmp/$asset" -d "$ex" || return 1
    else
      log "download: need unzip to extract $asset; falling through"
      return 1
    fi
    ;;
  esac

  src_bin="$(find "$ex" -type f -name "$BINARY_NAME" -print -quit)"
  if [ -z "$src_bin" ]; then
    log "download: binary $BINARY_NAME not found in $asset; falling through"
    return 1
  fi
  src_dir="$(dirname "$src_bin")"

  rm -rf "$BIN_DIR"
  mkdir -p "$BIN_DIR"
  # Move binary plus any sibling lib/ tree (musl builds) into BIN_DIR.
  mv "$src_dir"/* "$BIN_DIR"/
  chmod +x "$BIN"
  log "installed crawlberg to $BIN"
  return 0
}

if want download; then
  if download_install; then
    runs_ok "$BIN" && exec "$BIN" "$@"
    log "downloaded binary at $BIN did not run; falling through"
  fi
fi

# ---- (f) Give up ------------------------------------------------------------
die "could not locate or install a crawlberg binary. Install one manually:
  brew install xberg-io/tap/crawlberg
  cargo install crawlberg-cli --features all
or download a release from https://github.com/xberg-io/crawlberg/releases/latest
then ensure 'crawlberg' is on PATH (or place it at $BIN)."
