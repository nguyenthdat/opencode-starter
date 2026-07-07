# coreutils text tools — deep cookbook

The small, composable line/column tools: `sort`, `uniq`, `cut`, `tr`, `wc`,
`head`, `tail`, `paste`, `comm`, `join`, `tee`, `column`, and friends. Each does
one thing; value comes from piping them (see the Composition section in
`SKILL.md`).

> macOS userland is BSD-flavored but its `sort` does support `-h`/`-V`. The
> traps that remain are noted per tool and in the BSD-vs-GNU table in `SKILL.md`.

## Contents
- [sort](#sort)
- [uniq](#uniq)
- [cut](#cut)
- [tr](#tr)
- [wc / head / tail](#wc--head--tail)
- [paste / comm / join](#paste--comm--join)
- [tee and the rest](#tee-and-the-rest)
- [Gotchas](#gotchas)

---

## sort

```bash
sort f                       # lexical (byte order)
sort -n f                    # numeric
sort -rn f                   # numeric, descending
sort -h f                    # human sizes: 2K < 3M < 1G  (works on macOS)
sort -V f                    # version sort: 1.9 < 1.10   (works on macOS)
sort -u f                    # sort + dedupe in one pass
sort -t',' -k2,2n data.csv   # by column 2 numeric, comma-delimited
sort -k3,3 -k1,1 f           # multi-key: col 3 then col 1
sort -s -k1,1 f              # stable sort (preserve input order within ties)
sort -R f                    # random shuffle
sort -c f                    # just check whether already sorted
```

Key spec: `-k F1[.C1][opts],F2[.C2][opts]`. **Always give the end field**
(`-k2,2`) — bare `-k2` sorts from field 2 to end of line, a common surprise.
Per-key type flags: `-k2,2n` makes only that key numeric.

---

## uniq

> **Operates on ADJACENT lines only — `sort` first** (or `sort -u`).

```bash
sort f | uniq                # collapse duplicate lines
sort f | uniq -c             # prefix each with its count
sort f | uniq -d             # only lines that ARE duplicated
sort f | uniq -u             # only lines that are NEVER repeated
sort f | uniq -c | sort -rn  # frequency ranking — the classic idiom
sort f | uniq -i             # case-insensitive
uniq -f1 f                    # skip the 1st field when comparing
```

To dedupe **without sorting** (preserve first-seen order): `awk '!seen[$0]++' f`.

---

## cut

```bash
cut -d',' -f2,4 data.csv     # fields 2 and 4 (delimiter ,)
cut -f1 data.tsv             # default delimiter is TAB
cut -d':' -f1 /etc/passwd    # usernames
cut -c1-10 f                 # character columns 1-10
cut -d',' -f2- data.csv      # field 2 to the end
```

`cut` **can't reorder** (`-f2,1` still prints field 1 then 2) and takes a single
char delimiter. For reordering or multi-char/regex delimiters use `awk`.

---

## tr

```bash
tr 'a-z' 'A-Z' < f           # uppercase (operates on stdin only — no file arg)
tr -d '\r' < dos.txt         # delete carriage returns (CRLF → LF)
tr -s ' ' < f                # squeeze runs of spaces to one
tr ',' '\n' < f              # commas → newlines (split a CSV row)
tr -cd '[:print:]\n' < f     # delete everything non-printable
tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 16   # random token
```

`tr` reads **stdin only** (use `< file`), works on single characters/sets, not
strings — to replace a string use `sed`/`sd`.

---

## wc / head / tail

```bash
wc -l f                      # line count  (-w words, -c bytes, -m chars)
fd -e go -X wc -l            # total lines across many files
head -n 20 f                 # first 20 lines  (-c 100 = first 100 bytes)
tail -n 20 f                 # last 20 lines
tail -n +2 data.csv          # everything from line 2 (skip a header)
tail -f app.log              # follow appended output (live)
tail -F app.log              # follow + reopen on rotate
```

---

## paste / comm / join

```bash
paste -d',' a b              # glue files side-by-side, comma between
paste -s -d',' f             # collapse all lines of f into one comma-joined line

# comm needs SORTED inputs; prints 3 cols: only-A | only-B | both
comm -12 <(sort a) <(sort b) # lines common to both (intersection)
comm -23 <(sort a) <(sort b) # lines only in A (difference A−B)
comm -3  <(sort a) <(sort b) # lines NOT shared

# join = relational join on a common key field (sorted on that key)
join -t',' -1 1 -2 1 <(sort -t',' -k1 a.csv) <(sort -t',' -k1 b.csv)
join -t',' -a1 -e NULL -o auto a.csv b.csv    # left outer join, fill blanks
```

`comm` for set algebra on whole lines; `join` for SQL-style joins on a key. Both
demand sorted input — sort on the exact key/delimiter you'll join on.

---

## tee and the rest

```bash
cmd | tee out.txt            # pass through stdout AND save a copy
cmd | tee -a log.txt         # append copy
cmd | tee f1 f2 >/dev/null   # fan out to several files
echo "$PW" | sudo tee /etc/secret >/dev/null   # write to a root-owned file

nl f                         # number non-blank lines
rev f                        # reverse each line's characters
fold -w 72 -s f              # wrap to 72 cols at word boundaries
column -t -s',' data.csv     # align into a readable table
seq 1 5                      # 1 2 3 4 5  (seq -w zero-pads)
shuf -n 3 f                  # 3 random lines (GNU; macOS: `gshuf` or `sort -R`)
split -l 1000 big.txt part_  # chunk into 1000-line files
```

---

## Gotchas

- **`uniq` needs sorted input** — the single most common wrong result. `sort |
  uniq` or `sort -u`; or `awk '!seen[$0]++'` to keep order.
- **`sort -k2` ≠ `-k2,2`** — without the end field it sorts to end of line.
- **`cut` can't reorder or use multi-char delimiters** — switch to `awk`.
- **`tr` is stdin-only and character-based** — no filename arg, no string
  replace.
- **`comm`/`join` require pre-sorted input** on the comparison key, with matching
  delimiter; unsorted input silently yields wrong rows.
- **`shuf` is GNU** — on macOS use `gshuf` (coreutils) or `sort -R`.
- macOS `sort` handles `-h`/`-V`/`-R`; for any other GNU-only behavior,
  `brew install coreutils` gives `g`-prefixed tools (`gsort`, `gsplit`, …).
