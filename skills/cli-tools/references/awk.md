# awk — field & record processor (deep cookbook)

`awk` reads input record by record (a line by default), splits each into fields
`$1..$NF`, and runs `pattern { action }` blocks against it. It's the right tool
for columnar math, grouping, and per-field logic on whitespace/simple-delimited
text. macOS ships **BWK awk** ("one true awk"); `gawk` adds extras (flagged
below).

## Contents
- [Program structure](#program-structure)
- [Built-in variables](#built-in-variables)
- [Selecting & filtering](#selecting--filtering)
- [Math, sums, grouping](#math-sums-grouping)
- [Strings & functions](#strings--functions)
- [Two-file join trick](#two-file-join-trick)
- [Gotchas](#gotchas)

---

## Program structure

```
awk 'BEGIN{ run once before input }
     /pattern/ { run for matching records }
     condition { run when condition is true }
     END{ run once after all input }'
```

- A block with no pattern runs for every record; a pattern with no `{…}` defaults
  to `{print}`.
- `-F SEP` sets the input field separator; `-v var=val` injects a shell value
  *before* processing (the safe way to pass data in).

```bash
awk '{print $1, $NF}' f               # first and last field
awk -F',' '{print $2}' data.csv       # comma-delimited 2nd field
awk 'NR==1{print; next} $3>100' f      # always keep header, then filter
awk -v t="$THRESH" '$2 > t' f          # inject a shell value safely
```

---

## Built-in variables

| Var | Meaning |
|-----|---------|
| `$0` | the whole record |
| `$1…$NF` | fields; `NF` = number of fields |
| `NR` | record number (cumulative across files) |
| `FNR` | record number within the current file |
| `FS` / `OFS` | input / output field separator |
| `RS` / `ORS` | input / output record separator |
| `FILENAME` | current input file name |

```bash
awk 'BEGIN{OFS="\t"} {print $1,$3}' f      # tab-separated output
awk 'BEGIN{RS=""} {print NR": "$1}' f       # paragraph mode (blank-line records)
awk -F'\t' 'NR>1' data.tsv                  # drop header row
```

---

## Selecting & filtering

```bash
awk '$3 > 100 {print $1}' f             # numeric comparison on a field
awk '$0 ~ /error/' log                  # regex match on whole line (like grep)
awk '$2 !~ /^#/' f                       # field 2 does NOT match
awk 'NF' f                               # keep non-empty lines (NF>0 is truthy)
awk 'length > 80' f                      # lines longer than 80 chars
awk 'NR>=10 && NR<=20' f                  # a line range
awk '!seen[$0]++' f                      # dedupe, preserving first-seen order
awk -F',' '$3=="CA" && $4+0 > 1000' d.csv # combine string + numeric tests
```

`$4+0` forces numeric context; awk compares as strings unless a value looks
numeric or you coerce it.

---

## Math, sums, grouping

```bash
awk '{s+=$2} END{print s}' f                       # sum a column
awk '{s+=$2} END{print s/NR}' f                     # mean
awk 'NR==1||$2<min{min=$2} END{print min}' f        # min of a column
awk '{a[$1]+=$2} END{for(k in a) print k, a[k]}' f  # group + sum by key
awk -F'\t' '{c[$1]++} END{for(k in c) print c[k], k}' d.tsv  # group + count
awk '{sum[$1]+=$2; n[$1]++} END{for(k in sum) print k, sum[k]/n[k]}' f  # avg/key
```

This `a[key]+=val` / `for(k in a)` pattern is awk's superpower — a one-line
GROUP BY. Pipe the result to `sort` for ranking.

---

## Strings & functions

| Function | Does |
|----------|------|
| `length(s)` | length of string (or `$0`) |
| `substr(s,i,n)` | substring from position `i` (1-based), length `n` |
| `index(s,t)` | position of `t` in `s`, else 0 |
| `split(s,arr,sep)` | split `s` into `arr`, returns count |
| `sub(re,rep[,tgt])` / `gsub(...)` | replace first / all (modifies target) |
| `match(s,re)` | sets `RSTART`/`RLENGTH` |
| `toupper(s)` / `tolower(s)` | case |
| `sprintf(fmt,…)` / `printf fmt,…` | formatted output |

```bash
awk '{print toupper($1)}' f
awk '{gsub(/[0-9]/,"#"); print}' f          # mask all digits
awk '{n=split($0,a,"/"); print a[n]}' f      # basename via split
awk '{printf "%-20s %6.2f\n", $1, $2}' f      # aligned columns
awk 'match($0,/v[0-9.]+/){print substr($0,RSTART,RLENGTH)}' f  # extract a version
```

---

## Two-file join trick

`FNR==NR` is true only while reading the *first* file — the idiom for "load file
A into a map, then process file B against it":

```bash
# Print lines of b.txt whose key (field 1) appears in a.txt
awk 'FNR==NR{keys[$1]; next} $1 in keys' a.txt b.txt

# Add a column to data.csv by looking up id->name from names.csv
awk -F',' 'FNR==NR{name[$1]=$2; next} {print $0","name[$1]}' names.csv data.csv
```

---

## Gotchas

- **CSV with quoted commas breaks `-F','`** — `"a,b",c` splits wrong. Use a real
  CSV tool (`qsv`, see `references/qsv.md`) for quoted/embedded delimiters; awk is
  for whitespace/clean-delimited data.
- **String vs number comparisons:** `$1=="10"` vs `$1==10` differ; coerce with
  `$1+0` when you need numeric.
- **`FS` is a regex** (except a single space, which is magic: splits on runs of
  whitespace and trims leading/trailing). `-F'\t'` for literal tab.
- **BWK awk (macOS) lacks gawk extras:** `gensub()`, `asort()`,
  `length(array)`, `PROCINFO`, true multibyte handling. `brew install gawk` if
  you need them; call it `gawk`.
- **`print` vs `printf`:** `print` adds `ORS` (newline); `printf` does not — you
  add `\n` yourself.
