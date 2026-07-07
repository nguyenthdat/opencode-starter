# skim (`sk`) — fuzzy finder (deep cookbook)

`skim` is a fast, general-purpose **fuzzy finder** in Rust (a `fzf` cousin). The
binary is `sk`. It reads lines on stdin, lets you fuzzy-filter them
interactively, and prints your selection to stdout — so it drops into pipes and
command substitutions. With no input it runs `find .` (override via
`SKIM_DEFAULT_COMMAND`).

Two modes:
- **Filter** — pipe a list in, pick from it (`fd | sk`).
- **Interactive** (`-i -c '<cmd> {q}'`) — skim reruns a command as you type.

## Contents
- [Core options](#core-options)
- [Search syntax](#search-syntax)
- [Filter-mode recipes](#filter-mode-recipes)
- [Preview window](#preview-window)
- [Fields & delimiters](#fields--delimiters)
- [Interactive mode](#interactive-mode)
- [Key bindings & actions](#key-bindings--actions)
- [Scripting](#scripting)
- [Shell integration](#shell-integration)
- [Gotchas](#gotchas)

---

## Core options

| Need | Flag |
|------|------|
| Multiple selection (TAB to mark) | `-m` / `--multi` |
| Exact match (not fuzzy) | `-e` / `--exact` |
| Regex mode | `--regex` |
| Case | `--case respect\|ignore\|smart` (default smart) |
| Window height / layout | `--height 40%` · `--layout reverse` (or `--reverse`) |
| Prompt / header | `-p '> '` · `--header 'pick one'` |
| Preview pane | `--preview 'cmd {}'` · `--preview-window up:30%` |
| Initial query | `-q 'text'` |
| Reverse input order | `--tac` (often with `--no-sort`) |
| Parse ANSI colors in input | `--ansi` |
| Typo tolerance | `--typos[=N]` |

`{}` in `--preview`/`execute` actions expands to the current line (quoted);
`{1}`, `{2..}`, `{q}` (query) are also available — see [Fields](#fields--delimiters).

---

## Search syntax

skim borrows `fzf`'s query grammar:

| Token | Match |
|-------|-------|
| `text` | fuzzy |
| `^pre` | starts with `pre` |
| `suf$` | ends with `suf` |
| `'exact` | contains `exact` (exact substring) |
| `!fire` | does NOT contain `fire` |
| `!.mp3$` | does NOT end with `.mp3` |

Space = AND (`src main` → both), ` | ` = OR (`.md$ | .markdown$`), and OR binds
tighter than AND.

---

## Filter-mode recipes

```bash
vim "$(fd -e rs | sk)"                       # pick one file, open it
fd -t f | sk -m | xargs -I{} cp {} /backup/  # multi-select, act on each
git branch --format='%(refname:short)' | sk | xargs git checkout
git log --oneline | sk | cut -d' ' -f1       # pick a commit, grab its hash
history | sk --tac --no-sort                 # newest-first shell history
ps aux | sk --header-lines=1 | awk '{print $2}'   # pick a process, keep header
kubectl get pods | sk --header-lines=1 | awk '{print $1}'
```

---

## Preview window

```bash
fd -t f | sk --preview 'bat --color=always {}'              # file preview
fd -t f | sk --preview 'bat --color=always {}' --preview-window right:60%
# grep results "file:line:col" → preview the file at that line
rg --line-number '' | sk --delimiter : \
  --preview 'bat --color=always --highlight-line {2} {1}' --preview-window +{2}-/2
```

`--preview-window` accepts `up|down|left|right[:SIZE][:wrap][:hidden]` and a
scroll offset like `+{2}-5` (line from field 2, minus 5). Toggle it at runtime
with the `toggle-preview` action.

---

## Fields & delimiters

For structured input like `file:line:col`, restrict what is *matched* and
*displayed*:

```bash
sk --delimiter : --nth 1          # only fuzzy-match the filename field
sk --delimiter : --with-nth 1,3   # only display fields 1 and 3
```

Field ranges: `1` (first), `-1` (last), `3..5`, `2..`, `..-3`, `..` (all).

---

## Interactive mode

skim reruns a command on each keystroke; `{q}` is the live query (quoted):

```bash
# Interactive ripgrep — content search that updates as you type
sk --ansi -i -c 'rg --color=always --line-number "{q}"'
# Interactive grep / ag / ack
sk --ansi -i -c 'grep -rIn --color=always "{q}" .'
```

`-i` opens the command prompt (`c>`); `-c` is the command template
(defaults to `$SKIM_DEFAULT_COMMAND`). Inside interactive mode, `Ctrl-Q`
toggles back to fuzzy-filtering the current results. Because `{q}` is wrapped in
quotes, interactive mode searches the **literal** query; for fuzzy search, pipe
a command's output into `sk` instead.

---

## Key bindings & actions

Defaults: `Enter` accept · `ESC`/`Ctrl-G` abort · `Ctrl-P`/`↑`, `Ctrl-N`/`↓`
move · `TAB`/`Shift-TAB` toggle+move (with `-m`).

Customize with `--bind '<key>:<action>[+<action>…]'` (comma-separated pairs):

```bash
sk --bind 'alt-a:select-all,alt-d:deselect-all'
sk --bind 'ctrl-y:execute-silent(echo {} | pbcopy)+abort'   # copy line, quit
sk --bind 'f1:execute(less -f {})'                          # open pager, return
sk --bind 'ctrl-/:toggle-preview'
```

`execute(...)` runs a program with the current line; `execute-silent(...)` runs
it without leaving skim. Same `{}`/`{1}`/`{q}` placeholders as previews.

---

## Scripting

```bash
sk -q 'init' --print-query           # print the typed query as line 1
sk -f 'query' < items.txt            # FILTER mode: non-interactive, just print matches
fd -t f -0 | sk --read0 -m --print0 | xargs -0 rm   # NUL-safe end to end
sk --expect=ctrl-e,ctrl-v            # line 1 = which key accepted (route actions)
```

Exit codes: `0` selected, `1` no match, `130` aborted (Ctrl-C/Esc).

---

## Shell integration

Enable completions and the `Ctrl-T` (pick file), `Ctrl-R` (history), `Alt-C`
(cd into dir) widgets:

```bash
# zsh — add to ~/.zshrc
source <(sk --shell zsh --shell-bindings)
# bash — add to ~/.bashrc
source <(sk --shell bash --shell-bindings)
# fish — ~/.config/fish/config.fish
sk --shell fish --shell-bindings | source
```

Choose what feeds those widgets and a bare `sk`:

```bash
export SKIM_DEFAULT_COMMAND='fd --type f --hidden --exclude .git || rg --files || find .'
```

---

## Gotchas

- **Output is the selection on stdout** — capture it with `$(…)` or a pipe;
  with `-m` you get one line per marked item.
- **Interactive `{q}` is literal** (quoted), so `-i -c 'rg {q}'` is a *literal*
  search; pipe into `sk` for fuzzy matching instead.
- Check the **exit code**: `1` means the user matched nothing, `130` means they
  aborted — don't treat either as a real selection.
- For paths with spaces/newlines, go NUL-safe: producer `-0` / `--print0`,
  skim `--read0`/`--print0`, consumer `xargs -0`.
- `--height` only shrinks the UI in a real TTY; in pipes skim still works but
  uses the full screen / alternate buffer.
- Cross-platform: identical on macOS and Linux (binary is `sk`).
