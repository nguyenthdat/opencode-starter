/**
 * Fish Shell Bash Tool Override
 *
 * This file provides Fish shell support for the OpenCode bash tool.
 * The primary Fish shell integration is handled by the fish-shell plugin
 * (plugins/fish-shell.ts), which uses hooks to wrap commands through Fish.
 *
 * This tool override serves as a complementary layer that can be used
 * standalone or alongside the plugin for additional Fish-specific features.
 *
 * Usage:
 *   The plugin handles command wrapping automatically via tool.execute.before
 *   and updates the LLM-facing description via tool.definition hooks.
 *   Set "shell" in opencode.jsonc to the fish binary path for native execution.
 *
 * Fish detection paths (searched in order):
 *   /opt/homebrew/bin/fish  (macOS Homebrew on Apple Silicon)
 *   /usr/local/bin/fish     (macOS Homebrew on Intel / Linux manual)
 *   /usr/bin/fish           (Linux package manager)
 *   /home/linuxbrew/.linuxbrew/bin/fish (Linux Homebrew)
 *
 * Installed via the plugin system in opencode.jsonc:
 *   "plugin": ["./plugins/fish-shell.ts"]
 */

export const FISH_SEARCH_PATHS = [
  "/opt/homebrew/bin/fish",
  "/usr/local/bin/fish",
  "/usr/bin/fish",
  "/home/linuxbrew/.linuxbrew/bin/fish",
];

export { default as fishShellPlugin } from "../plugins/fish-shell";
