# Fish Shell Tool Instructions

The shell tool runs commands in Fish, not Bash. Write shell commands using Fish syntax unless a command explicitly invokes another shell.

## Required Patterns

- Set exported environment variables with `set -gx NAME value`, not `export NAME=value`.
- Set local variables with `set -l name value`, not `local name=value`.
- Use one-command environment overrides as `env NAME=value command`, not `NAME=value command`.
- Remove variables with `set -e NAME`, not `unset NAME`.
- Use command substitution as `(command)`, not `$(command)`.
- Write loops as `for item in list; command; end`.
- Write functions as `function name; commands; end`.
- Use `begin; command1; command2; end` for grouped multi-line command blocks.
- Use `source file` to load a script.

## Control Flow

- Prefer Fish-native chaining: `cmd1; and cmd2` and `cmd1; or cmd2`.
- `&&` and `||` are accepted by modern Fish, but do not rely on other Bash-only syntax.
- Avoid Bash arrays, brace expansion, `[[ ... ]]`, process substitution, here-strings, and `${VAR}` parameter expansion.

## Quoting

- Use single quotes for literal strings.
- Use double quotes when `$variable` or `(command)` expansion is required.
- Escape a single quote inside a single-quoted string as `\'`.
- Quote paths containing spaces, for example `/path/to/'My Documents'/file`.

## Tool Usage

- Use the tool `workdir` parameter instead of `cd` when running commands in another directory.
- Do not wrap normal commands in `bash -lc` just to use Bash syntax. Translate the command to Fish instead.
- If Bash is genuinely required, invoke it explicitly and keep the Bash-specific section isolated, for example `bash -lc 'set -euo pipefail; ...'`.