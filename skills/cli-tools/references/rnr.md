# rnr — batch rename files & directories (deep cookbook)

`rnr` (RnR) safely renames many files/directories at once using **regular
expressions** with capture groups. Two safety nets define how it's used:

> **1. Dry-run by default.** `rnr` only *previews* until you add `-f`/`--force`.
> **2. Undo dumps.** When it applies changes it writes an `rnr-<timestamp>.json`
> operations file you can replay in reverse with `rnr from-file`.

Subcommands: `regex` (the workhorse), `from-file` (replay/undo), `to-ascii`
(transliterate names). Run `rnr <sub> --help` for the authoritative flag list.

## Contents
- [regex: usage & flags](#regex-usage--flags)
- [Recipes](#recipes)
- [Recursion & directories](#recursion--directories)
- [Undo & dump files](#undo--dump-files)
- [to-ascii](#to-ascii)
- [Gotchas](#gotchas)

---

## regex: usage & flags

```
rnr regex [OPTIONS] <EXPRESSION> <REPLACEMENT> <PATH(S)>...
```

| Flag | Effect |
|------|--------|
| `-n, --dry-run` | preview only (**default**) |
| `-f, --force` | actually perform the renames |
| `-b, --backup` | copy each file to a backup before renaming |
| `-r, --recursive` | descend into directories |
| `-d, --max-depth <N>` | cap recursion depth |
| `-D, --include-dirs` | also rename matching directories |
| `-x, --hidden` | include hidden files/dirs |
| `-l, --replace-limit <N>` | max replacements per name (0 = all) |
| `-t, --replace-transform <T>` | transform replacement: `upper`/`lower`/`ascii` |
| `-s, --silent` | print nothing |
| `--no-dump` / `--dump` | disable / force the undo dump |

- `<EXPRESSION>` is a regex; `<REPLACEMENT>` uses `$1`/`${name}` capture refs —
  **wrap it in single quotes** so the shell doesn't expand `$1`.
- Only the **file name** is matched/rewritten, not the directory path.

---

## Recipes

```bash
rnr regex '\.jpeg$' '.jpg' *.jpeg            # PREVIEW (dry-run by default)
rnr regex -f '\.jpeg$' '.jpg' *.jpeg         # apply: rename .jpeg → .jpg

rnr regex -f ' ' '_' *.txt                   # spaces → underscores
rnr regex -f '(\d{4})-(\d{2})-(\d{2})' '$3.$2.$1' *.log   # reorder a date
rnr regex -f '^IMG_' 'photo_' *.jpg          # change a prefix
rnr regex -f -l 1 'a' 'X' *.txt              # replace only the first 'a' per name
rnr regex -f -t lower '.*' '$0' *            # lowercase every name (whole match $0)
rnr regex -f -b 'draft' 'final' *.md         # rename, keeping .bak backups
```

---

## Recursion & directories

```bash
# Recurse, rename files only
rnr regex -f -r 'foo' 'bar' ./src

# Recurse AND rename matching directories too, including hidden, depth-limited
rnr regex -f -r -D -x -d 3 'old' 'new' .
```

By default directories themselves are left alone (only files are renamed);
`-D` opts them in. Combine `-r` with `-d` to bound how deep it walks.

---

## Undo & dump files

When `rnr` applies changes it drops an operations file (default prefix `rnr-`)
in the working directory. To revert the last batch:

```bash
rnr from-file -f rnr-2026-06-26-... .json    # replay in reverse = undo
```

Control dumping: `--no-dump` to skip it, `--dump` to force one even during a
dry run, `--dump-prefix <p>` to rename the file.

---

## to-ascii

Transliterate non-ASCII characters in file names to an ASCII approximation
(e.g. `café.txt` → `cafe.txt`):

```bash
rnr to-ascii *               # preview
rnr to-ascii -f *            # apply
rnr to-ascii -f -r .         # recurse
```

---

## Gotchas

- **Nothing happens without `-f`.** If a rename "didn't work," you were in the
  default dry-run; re-run with `-f`.
- **Single-quote the replacement** so `$1`, `$2`, `$0` reach `rnr` instead of
  being expanded by the shell.
- Only the **name** is rewritten, not the path — to move files between dirs use
  `mv`/`fd -x mv`, not `rnr`.
- Beware **collisions**: a pattern that maps two different files to the same
  name is unsafe; the dry-run preview is where you catch it.
- Capture refs follow Rust regex rules (`$1`, `${name}`, `$0` = whole match).
- Cross-platform: identical on macOS and Linux.
