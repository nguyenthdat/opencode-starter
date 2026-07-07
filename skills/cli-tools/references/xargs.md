# xargs — build argument lists (deep cookbook)

Reads stdin, splits it into tokens, and appends them as **arguments** to a
command (default `echo`). The bridge between tools that *produce names* (`fd`,
`rg -l`, `git`) and tools that *take names as args* (`rm`, `cp`, `sed`, `wc`).

> **Default splitting is dangerous:** plain `xargs` splits on whitespace AND
> newlines, so filenames with spaces explode into multiple args. Always pair a
> `-0`/`-print0` producer with `xargs -0`.

## Contents
- [Flags](#flags)
- [The NUL-safe pattern](#the-nul-safe-pattern)
- [Placement, batching, parallelism](#placement-batching-parallelism)
- [Recipes](#recipes)
- [The macOS empty-input trap](#the-macos-empty-input-trap)
- [Gotchas](#gotchas)

---

## Flags

| Flag | Effect |
|------|--------|
| `-0` | input is NUL-separated (pair with `-0`/`-print0`/`--null` producers) |
| `-n N` | at most N arguments per command invocation |
| `-I {}` | replace `{}` with each input item (implies `-n 1`, splits on newlines) |
| `-P N` | run up to N invocations in parallel |
| `-L N` | use N input *lines* per invocation |
| `-t` | print each command to stderr before running (debug) |
| `-p` | prompt before each command (interactive) |
| `-r` | **GNU only** — don't run at all if input is empty |
| `-J {}` | **BSD only** — single-placeholder insert (BSD's `-I` alternative) |

---

## The NUL-safe pattern

```bash
rg -l -0 TODO        | xargs -0 sed -i '' 's/TODO/DONE/g'
fd -e png -0         | xargs -0 -P4 -I{} optipng {}
git diff --name-only -z | xargs -0 eslint
find . -name '*.tmp' -print0 | xargs -0 rm
```

Every producer here emits NUL (`-0` / `-print0` / `-z`) and `xargs -0` consumes
it, so spaces and newlines in names are safe. Make this your default shape.

---

## Placement, batching, parallelism

- **Default (no `-I`)**: xargs packs *many* args into *few* invocations — fast,
  the command runs a handful of times. Best for `rm`, `wc`, `grep`.
- **`-I {}`**: forks once per item and lets you put the arg anywhere (even twice).
  Convenient but slow for huge inputs; implies `-n 1`.
- **`-P N`**: parallelism. Combine with `-n 1` or `-I{}` so there's real work per
  job. `-P0` (GNU) = as many as possible.

```bash
printf '%s\n' a b c | xargs echo          # one call:  echo a b c
printf '%s\n' a b c | xargs -n1 echo       # three calls: echo a / echo b / echo c
fd -e jpg -0 | xargs -0 -I{} convert {} {.}.png   # {} placeholder, per item
ls *.log | xargs -P8 -n1 gzip              # 8 gzips at a time
```

---

## Recipes

```bash
rg -l -0 "deprecated" | xargs -0 -P4 -n1 prettier --write   # parallel format
fd -e mp4 -0 | xargs -0 -I{} ffmpeg -i {} {.}.gif            # transcode each
cat urls.txt | xargs -P10 -n1 curl -fsSLO                    # parallel download
printf '%s\n' *.bak | xargs -t rm                            # show then delete
echo "a b c" | xargs -n1 | sort                              # split into lines
```

Often `fd -x/-X` is cleaner than `fd … | xargs` (no NUL plumbing) — reach for
xargs when the producer isn't fd (`rg -l`, `git`, a plain file list).

---

## The macOS empty-input trap

> BSD `xargs` (macOS) has **no `-r`** and will run the command **once even with
> empty input** — sometimes with no arguments, which can be destructive
> (`xargs rm` with nothing → `rm` waits on stdin or errors; worse with defaults).

Guards:

```bash
# Only run if the producer found something
files=$(fd -e tmp); [ -n "$files" ] && printf '%s\n' "$files" | xargs rm

# Or sidestep xargs entirely — these no-op on empty input:
fd -e tmp -X rm
fd -e tmp -x rm {}
```

---

## Gotchas

- **Always `-0` with file lists.** Whitespace in names is the classic data-loss
  bug. Producer emits NUL, consumer reads `-0`.
- **`-I{}` implies `-n 1`** and splits on newlines only — fine, but slow at scale
  because it forks per item.
- **BSD has no `-r`**, runs once on empty input; GNU `-r` skips. Guard on macOS.
- **BSD uses `-J` not `-I`** for some positional cases, and behaves differently;
  for portability prefer NUL + a command that handles empty input, or `fd -X`.
- **Exit status:** xargs returns 123 if any invocation exits 1-125 — check it in
  scripts (`set -o pipefail` doesn't capture xargs' children directly).
