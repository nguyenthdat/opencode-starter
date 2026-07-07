# sd — find & replace (deep cookbook)

`sd` is an intuitive find-&-replace CLI and a friendlier `sed` for the common
case. It uses the **Rust/PCRE-ish regex** flavor you know from JavaScript and
Python, splits find and replace into separate arguments (no `s/…/…/g` slashes),
and uses `$1` / `${name}` for captures.

> **Biggest gotcha:** `sd` **modifies files in place by default** (v1.0+). Pass
> `-p`/`--preview` to see the diff without writing, or feed input on **stdin**
> to print the result to stdout instead.

## Contents
- [Flags](#flags)
- [stdin vs in-place](#stdin-vs-in-place)
- [Regex & captures](#regex--captures)
- [Line-by-line vs across](#line-by-line-vs-across)
- [Project-wide edits](#project-wide-edits)
- [Gotchas](#gotchas)

---

## Flags

| Flag | Effect |
|------|--------|
| `-p, --preview` | show changes, **do not write** |
| `-F, --fixed-strings` | literal strings, no regex |
| `-n, --max-replacements <N>` | cap replacements per input (0 = unlimited) |
| `-f, --flags <chars>` | regex flags, combinable (e.g. `-f im`) |
| `-A, --across` | match across line boundaries (buffers whole input) |

Regex flag letters for `-f`: `c` case-sensitive, `i` case-insensitive,
`m` multi-line (`^`/`$` per line), `s` dotall (`.` matches `\n`), `w` whole
words, `e` disable multi-line matching.

---

## stdin vs in-place

```bash
# stdin → stdout (file-safe; nothing is modified)
echo 'lorem ipsum 23   ' | sd '\s+$' ''        # → "lorem ipsum 23"
cat config.toml | sd 'true' 'false' > new.toml

# file argument → edited IN PLACE
sd 'window.fetch' 'fetch' http.js              # http.js is rewritten

# preview first (recommended before touching files)
sd -p 'window.fetch' 'fetch' http.js
```

`sd` accepts multiple file args and edits each in place:
`sd 'foo' 'bar' a.txt b.txt c.txt`.

---

## Regex & captures

```bash
sd '\s+$' '' file                              # trim trailing whitespace
sd '(\w+)\.(\w+)' '$2.$1' file                 # indexed capture groups
echo '123.45' | sd '(?P<d>\d+)\.(?P<c>\d+)' '${d} dollars ${c} cents'  # named
sd -F '((([])))' '' file                       # literal mode (no escaping hell)
sd -f i 'error' 'ERROR' log.txt                # case-insensitive
echo 'price: $5' | sd '\$(\d+)' 'USD $1'       # match a literal $ in the pattern
echo 'x' | sd 'x' '$$y'                        # emit a literal $ → "$y"
```

- Use `${name}` / `${1}` when the next character would otherwise glue onto the
  group name: `'${dollars}_dollars'`, not `'$dollars_dollars'`.
- Arguments starting with `-` are treated as flags; end options with `--`:
  `sd -- '--foo' '-w' file`.

---

## Line-by-line vs across

`sd` processes input **line by line by default** — low memory, streaming, and
`^`/`$` anchor per line so `\s+$` won't eat newlines. To match patterns that
span lines (e.g. replacing `\n`), use `-A`/`--across`:

```bash
printf 'hello\nworld\n' | sd -A '\n' ','       # → "hello,world"
sd -A '(?s)<!--.*?-->' '' file.html            # strip multi-line HTML comments
```

`-A` is also faster on big single-shot replacements, at the cost of buffering
the whole input in memory; the default line mode keeps RSS tiny.

---

## Project-wide edits

Combine with `fd` (NUL-safe, parallel):

```bash
fd -t f -e js -x sd 'from "react"' 'from "preact"'      # per-file, in place
fd -t f --exec sd 'v1/api' 'v2/api'                      # same, fd's own exec
rg -l 'deprecatedFn' | xargs sd 'deprecatedFn' 'newFn'   # only files that match

# Safety: snapshot first, or preview across the repo before committing
fd -t f -e ts -x sd -p 'oldName' 'newName' | less
```

> On macOS this is the painless replacement for the `sed -i ''` backup-suffix
> trap — `sd` has no platform-specific in-place quirks.

---

## Gotchas

- **In-place by default** — always `-p` first on anything you can't recover.
  Prefer running edits inside version control so a bad replace is `git restore`.
- **Line mode by default** — reach for `-A` when the pattern must cross `\n`.
- `$` in the replacement is a capture sigil; double it (`$$`) for a literal `$`.
- It's regex by default — switch to `-F` whenever the needle contains regex
  metacharacters you mean literally.
- No recursion of its own: combine with `fd`/`rg` to walk a tree.
- Cross-platform: identical on macOS and Linux.
