# fd — find files (deep cookbook)

A friendlier, faster `find`. The search term is a **regex matched against the
file name** (smart-case), it **respects `.gitignore`**, and it **skips hidden
files** — both defaults are the opposite of `fselect` and the #1 "why didn't it
find it?" surprise. `fd 10.x` here.

## Contents
- [Mental model](#mental-model)
- [Flags](#flags)
- [Matching: name, glob, path](#matching-name-glob-path)
- [Filter by type / time / size / owner](#filter-by-type--time--size--owner)
- [Execute per result (`-x` / `-X`)](#execute-per-result--x---x)
- [Recipes](#recipes)
- [Gotchas](#gotchas)

---

## Mental model

`fd [OPTIONS] [PATTERN] [PATH...]` — pattern first, then where to look (defaults
to `.`). No pattern = list everything. Output is newline-delimited; switch to
NUL (`-0`) the moment a downstream tool will split on whitespace.

```bash
fd readme            # regex 'readme' (smart-case) anywhere under .
fd '\.rs$' src       # files ending .rs, under src/
fd                   # every non-ignored, non-hidden file & dir
```

---

## Flags

| Flag | Effect |
|------|--------|
| `-e EXT` | filter by extension, repeatable (`-e js -e ts`) |
| `-t f\|d\|l\|x\|e\|s\|p` | type: file / dir / symlink / executable / empty / socket / pipe |
| `-g, --glob` | glob mode instead of regex (`-g '*.min.js'`) |
| `-p, --full-path` | match the regex against the whole path, not just name |
| `-H, --hidden` | include hidden files/dirs |
| `-I, --no-ignore` | ignore `.gitignore`/`.fdignore`/`.ignore` |
| `-u, --unrestricted` | `-HI` together (also `-uu`) |
| `-s, --case-sensitive` / `-i, --ignore-case` | force case mode |
| `-d, --max-depth N` / `--min-depth N` / `--exact-depth N` | bound depth |
| `-E, --exclude GLOB` | prune paths (repeatable): `-E node_modules -E '*.tmp'` |
| `-a, --absolute-path` | print absolute paths |
| `-l, --list-details` | `ls -l`-style long output |
| `-0, --print0` | NUL-separated output (pair with `xargs -0`) |
| `-x, --exec` / `-X, --exec-batch` | run a command per result / once for all |
| `--changed-within DUR` / `--changed-before DUR` | mtime window (`2weeks`, `1d`, `2026-01-01`) |
| `-S, --size CONSTRAINT` | size filter: `+1M`, `-10k`, `+1G` |
| `-o, --owner USER[:GROUP]` | filter by owner |

---

## Matching: name, glob, path

```bash
fd '\.test\.(ts|js)$'          # regex (default), anchored to extension
fd -g '*.spec.ts'              # glob mode reads more naturally for simple cases
fd -p 'src/.*/index\.ts$'      # -p matches the full relative path
fd -e py -e pyi                # multiple extensions
fd -E '*.min.*' -E dist .      # search, excluding minified + dist
```

Regex is the Rust `regex` crate (no backreferences/lookaround). For literal dots
escape them (`\.`); smart-case = case-insensitive unless the pattern has an
uppercase letter.

---

## Filter by type / time / size / owner

```bash
fd -t d -H '^\.git$'            # locate .git directories (hidden)
fd -t f -e log --changed-before 30d        # log files older than 30 days
fd -t f --changed-within 1d                # touched in the last day
fd -t f -S +100M                # files larger than 100 MB
fd -t x -d 2                    # executables, max depth 2
fd -t e -t f                    # empty files
```

For richer metadata predicates (permissions, hashes, content, EXIF) reach for
`fselect` — see `references/fselect.md`.

---

## Execute per result (`-x` / `-X`)

`fd` has `xargs` built in, and it's usually the cleaner choice (no NUL dance).

- `-x CMD` runs **once per match**, in parallel (`-j N` caps jobs).
- `-X CMD` runs **once with all matches** as args (batched, like `xargs`).
- Placeholders: `{}` full path · `{/}` basename · `{//}` parent dir · `{.}` path
  without extension · `{/.}` basename without extension. Bare `{}` is appended if
  you give none.

```bash
fd -e jpg -x convert {} {.}.png        # per file: foo.jpg -> foo.png (parallel)
fd -g '*.min.js' -X rm                 # one batched delete of all matches
fd -e log -x gzip {}                   # gzip each log in parallel
fd -t f -e wav -x ffmpeg -i {} {.}.flac
fd -t d node_modules -X rm -rf         # nuke every node_modules in one exec
```

---

## Recipes

```bash
fd -H -I secret                        # search EVERYTHING incl. hidden + ignored
fd -t f -0 . src | xargs -0 wc -l      # NUL-safe handoff to a non-fd consumer
fd -e md -X wc -l                       # total line count across all markdown
fd -t f --changed-within 2h -x ls -la {}   # recently changed files, detailed
fd . -t f -e bak -X rm -i              # find backups, confirm-delete in one batch
fd -a -e pem                            # absolute paths (handy for config files)
```

---

## Gotchas

- **Defaults hide things:** add `-H` for hidden, `-I` for ignored, or `-u`/`-uu`
  for both. This trips people coming from `find`.
- **It's regex, not glob, by default** — `fd '*.js'` is wrong (that's a regex);
  use `fd -g '*.js'` or `fd '\.js$'`.
- **`-x` vs `-X`:** `-x` forks per file (slow for thousands of tiny ops but
  parallel); `-X` batches into one process (fast). Pick deliberately.
- **Deletes are real and parallel** — preview with a plain `fd …` first, then add
  `-X rm` / `-x rm`.
- Quote `-g` globs and regexes so the shell doesn't expand them first.
- Cross-platform: behaves identically on macOS and Linux (unlike `find`).
