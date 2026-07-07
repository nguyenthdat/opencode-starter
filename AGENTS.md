Instructions are in @instructions/

## Shell

This project uses Fish shell (via plugins/fish-shell.ts) as the default execution shell.
The bash tool wraps commands through `fish -lc` for Fish-compatible execution.

To revert to bash, set `"shell": "/bin/bash"` in opencode.jsonc and remove the fish-shell plugin.

