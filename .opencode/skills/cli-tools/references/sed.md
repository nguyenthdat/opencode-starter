# sed — stream editor (deep cookbook)

Line-oriented edit/print/delete on a stream. Prints every line to stdout by
default; `-n` silences that so *you* decide what prints (usually with `p`).

> **macOS is BSD sed, not GNU sed.** The differences below are not cosmetic —
> the `-i` flag in particular will silently corrupt arguments if you use the GNU
> form on macOS. This guide gives the portable form first.

## Contents
- [Anatomy & addressing](#anatomy--addressing)
- [Substitute (`s`)](#substitute-s)
- [Print / delete / extract](#print--delete--extract)
- [In-place editing (the macOS trap)](#in-place-editing-the-macos-trap)
- [Multiple commands & scripts](#multiple-commands--scripts)
- [BSD vs GNU](#bsd-vs-gnu)
- [Gotchas](#gotchas)

---

## Anatomy & addressing

`sed [FLAGS] 'ADDRESS COMMAND' file…`. An address selects which lines a command
acts on; omit it to act on all lines.

| Address | Selects |
|---------|---------|
| `5` | line 5 |
| `5,10` | lines 5–10 |
| `/regex/` | lines matching regex |
| `/start/,/end/` | from first `start` match to next `end` match |
| `$` | last line |
| `5,$` | line 5 to end |
| `0~3` (GNU) | every 3rd line |
| `ADDR!` | negate — lines *not* matching |

```bash
sed -n '5,10p' f             # print lines 5-10
sed -n '/BEGIN/,/END/p' f    # print an inclusive block between two markers
sed '$d' f                   # delete the last line
sed '/^\s*$/d' f             # delete blank lines
sed '2,5!d' f                # keep only lines 2-5 (delete the negation)
```

---

## Substitute (`s`)

`s/PATTERN/REPLACEMENT/FLAGS`. The delimiter need not be `/` — use any char to
avoid escaping paths.

| Flag | Effect |
|------|--------|
| `g` | replace **all** occurrences on the line, not just the first |
| `N` | replace only the Nth occurrence (`s/x/y/2`) |
| `Ng` | the Nth and all after it |
| `p` | print the line if a substitution happened (pair with `-n`) |
| `I` | case-insensitive match |

```bash
sed 's/foo/bar/'  f          # first match per line
sed 's/foo/bar/g' f          # all matches
sed 's/foo/bar/2' f          # only the 2nd match per line
sed -E 's/v[0-9]+/vX/g' f    # extended regex (use -E, see below)
sed 's#/usr/local#/opt#g' f  # '#' delimiter avoids escaping the slashes
sed -E 's/([a-z]+)=([0-9]+)/\2=\1/' f   # backrefs \1 \2; & = whole match
sed -n 's/^Version: //p' f   # EXTRACT: print only the captured tail
```

`&` in the replacement is the whole match: `sed 's/[0-9]\+/<&>/g'` wraps numbers.

---

## Print / delete / extract

```bash
sed -n '10p' f               # just line 10
sed -n '$=' f                # line count (print line number of last line)
sed '3d' f                   # delete line 3
sed '/^#/d' f                # delete comment lines
sed '/^$/d' f                # delete empty lines
sed 'y/abc/ABC/' f           # transliterate a->A b->B c->C (like tr)
sed '1!G;h;$!d' f            # reverse the file (tac) — portable hold-space trick
sed -n '/pattern/,+2p' f     # (GNU) match line plus next 2
```

---

## In-place editing (the macOS trap)

```bash
sed -i '' 's/a/b/g' f        # macOS/BSD: empty suffix = no backup (REQUIRED)
sed -i.bak 's/a/b/g' f       # keep f.bak — works on BOTH BSD and GNU (portable)
# GNU only:   sed -i 's/a/b/g' f      # <-- DO NOT use on macOS
```

> The single most common macOS scripting bug: the GNU form `sed -i 's/…/…/' f`
> makes BSD sed read `s/…/…/` as the **backup suffix** and `f` as the script.
> Always `sed -i '' …` on macOS, or `sed -i.bak …` for cross-platform safety.
> In pipelines that touch many files, prefer `sd` (`references/sd.md`) which has
> one consistent in-place behavior across platforms.

---

## Multiple commands & scripts

```bash
sed -e 's/a/b/' -e 's/c/d/' f          # chain commands with -e
sed 's/a/b/; s/c/d/' f                  # or separate with ;
sed -E '/^#/d; s/\s+$//' f              # drop comments AND trim trailing ws
sed -f script.sed f                     # commands from a file
printf 'a\nb\n' | sed 'N;s/\n/,/'       # join pairs of lines (N pulls next line)
```

---

## BSD vs GNU

| Feature | BSD / macOS | GNU / Linux |
|---------|-------------|-------------|
| In-place | `-i ''` (suffix mandatory) | `-i` (suffix optional) |
| ERE flag | `-E` | `-E` or `-r` |
| `\d \w \s` shorthands | **unsupported** → use `[0-9]`, `[[:alpha:]]`, `[[:space:]]` | partial |
| `\U \L \E` case-convert in replacement | unsupported | supported |
| `0~N` step addresses, `addr,+N` | unsupported | supported |
| `-z` NUL-separated lines | unsupported | supported |

For GNU behavior on macOS: `brew install gnu-sed` → `gsed`.

---

## Gotchas

- **BSD `-i` needs the suffix arg.** Burned into muscle memory: `-i ''`.
- **No PCRE shorthands in BSD** — `\d`, `\w` are literal `d`, `w`. Use POSIX
  classes `[[:digit:]]`, `[[:alnum:]]`.
- **Greedy by default**, no non-greedy `*?`. For complex regex prefer `perl -pe`,
  `rg`, or `sd`.
- **`s` only replaces the *first* match per line** unless you add `g` — a classic
  silent bug.
- For find-and-replace across a tree, don't hand-roll `sed -i` loops; use
  `fd … -x sd …` or `rg -l … | xargs sd …` (see `references/sd.md`).
