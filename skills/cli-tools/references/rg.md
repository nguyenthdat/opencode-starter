# ripgrep (`rg`) — deep cookbook

Beyond the essentials in `SKILL.md`. ripgrep is regex search that respects
`.gitignore`, skips hidden and binary files, and parallelizes across files.

## Output control

| Flag | Effect |
|------|--------|
| `-n` / `-N` | force / suppress line numbers |
| `--column` | also print column of first match |
| `-o` | print only the matched text, not the whole line |
| `-r '$1'` | with `-o`, print a *replacement* (capture refs `$1`, `$name`) — prints only, never edits files |
| `-A/-B/-C n` | after / before / both context lines |
| `--context-separator ''` | change/remove the `--` between context blocks |
| `-c` | count matching lines per file |
| `--count-matches` | count individual matches (multiple per line) |
| `--passthru` | print every line, highlighting matches (sed-like preview) |
| `-l` / `--files-without-match` | only names of files with / without a match |
| `-0` | NUL-terminate file names for `xargs -0` |
| `--heading` / `--no-heading` | group matches under a file heading or not |
| `--sort path` | deterministic order (disables some parallelism) |

## Selecting what gets searched

```bash
rg foo -g '*.{ts,tsx}'          # only TS/TSX
rg foo -g '!**/dist/**'         # exclude a dir (note the leading !)
rg foo -t py -t js             # multiple built-in types (see --type-list)
rg foo -T test                  # exclude the 'test' type
rg --type-add 'web:*.{html,css,js}' -t web foo   # define a custom type
rg foo --hidden                 # include dotfiles
rg foo --no-ignore              # ignore .gitignore/.ignore/.rgignore
rg foo -uu                      # = --hidden --no-ignore
rg foo -uuu                     # also search binary files
rg foo -. path/                 # search a specific path
rg foo --iglob '*.MD'           # case-insensitive glob
```

ripgrep reads ignore rules from `.gitignore`, `.ignore`, and `.rgignore`
(nearest wins). Create a `.rgignore` to exclude paths from search without
touching git.

## Regex engine

- Default engine is Rust `regex` (linear time, no backreferences/lookaround).
- `-F` treats the pattern as a literal string — use it whenever the "pattern"
  is real text with `.`, `(`, `*`, etc.
- `-w` word boundaries, `-x` whole-line match.
- `-P` switches to PCRE2: enables lookaround and backreferences.
- `-U` enables multiline (`\n` can match); add `--multiline-dotall` so `.`
  crosses lines.
- `-S` smart-case (case-insensitive unless the pattern has an uppercase letter)
  is the sane default for interactive search.

```bash
rg -P '(?<=password=)\S+'             # lookbehind (PCRE2)
rg -U 'BEGIN.*?END' --multiline-dotall
rg -F 'arr[0].len()'                  # literal brackets/parens
rg '\bTODO\b'                          # explicit word boundary
```

## Structured output & scripting

```bash
rg --json foo | jq 'select(.type=="match") | .data.path.text' | sort -u
rg -l -0 foo | xargs -0 wc -l         # line counts of matching files, NUL-safe
rg -c foo | sort -t: -k2 -rn          # files ranked by match count
```

`--json` emits one JSON object per event (`begin`/`match`/`end`/`summary`) —
ideal for feeding jq. Use `-0` with `-l` to hand file lists to `xargs -0`
safely.

## Replace-preview workflow

ripgrep never edits files. To preview a substitution across the repo, then apply
it with sed:

```bash
rg 'oldName' -l                                  # 1. which files?
rg 'oldName' -o -r 'newName' --passthru | less   # 2. preview in context
rg -l -0 'oldName' | xargs -0 sed -i '' 's/oldName/newName/g'   # 3. apply (macOS)
```

## Performance & misc

- `--max-columns 200 --max-columns-preview` keeps minified-file matches readable.
- `-z` searches inside gzip/bzip2/xz/zstd files.
- `--pre <cmd>` runs a preprocessor (e.g. `pdftotext`) per file.
- `-j N` caps threads; ripgrep is already parallel by default.
- `--stats` prints match/file/time totals at the end.

## Common recipes

```bash
rg -n --no-heading -S "$q" | fzf            # search → fuzzy-pick a line
rg -l 'import React' | xargs -I{} dirname {} | sort -u   # dirs using React
rg '^\s*def (\w+)' -or '$1' -t py | sort   # all Python function names
rg -U 'fn \w+\([^)]*\)\s*\{' -t rust       # multiline Rust fn signatures
rg --files | rg -i 'config'                 # list tracked files, filter by name
```
