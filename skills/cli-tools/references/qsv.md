# qsv — CSV/TSV data toolkit (deep cookbook)

`qsv` ("Quicksilver") is a fast, streaming, memory-efficient CSV swiss-army
knife — a maintained, feature-rich fork of `xsv`. It ships 60+ subcommands that
you pipe together (`qsv a … | qsv b …`). Every command reads a file argument or
stdin, and writes CSV to stdout.

Check what you have: `qsv --version` (lists enabled features) and
`qsv --list` (all installed subcommands). Per-command options:
`qsv <command> --help`.

## Contents
- [Mental model](#mental-model)
- [Inspect](#inspect)
- [Select & reshape columns](#select--reshape-columns)
- [Filter & slice rows](#filter--slice-rows)
- [Sort, dedupe, sample](#sort-dedupe-sample)
- [Aggregate & analyze](#aggregate--analyze)
- [SQL & joins (Polars engine)](#sql--joins-polars-engine)
- [Convert formats](#convert-formats)
- [Indexing & huge files](#indexing--huge-files)
- [Gotchas](#gotchas)

---

## Mental model

- **Column selection syntax** (used by `select`, and `-s/--select` on many
  commands) accepts: names (`Name`), 1-based indexes (`1`), ranges (`1-4`,
  `Header1-Header4`, open-ended `3-`), exclusion (`'!1-2'`), duplicate-name
  disambiguation (`'Foo[2]'`), and regex. Quote anything with `!`, spaces, etc.
- **Streaming vs in-memory.** Many commands stream in constant memory. A few
  (`sort`, `stats` extended metrics, `frequency`, `dedup`) buffer; for files
  bigger than RAM use `extsort`, `extdedup`, an `index`, or the Polars
  commands (`sqlp`, `joinp`, `pivotp`) which spill to disk.
- **Headers.** Most commands assume a header row. Use `--no-headers` when there
  isn't one; `behead` drops it; `headers` lists it.
- **Delimiter.** Auto-detected for `.tsv`/`.tab`; force with `-d '\t'`. `fmt`
  changes the output delimiter.

---

## Inspect

```bash
qsv headers data.csv                 # numbered list of column names
qsv count data.csv                   # row count (uses .idx instantly if present)
qsv sniff data.csv                   # detect delimiter, types, row count, quoting
qsv table data.csv | less -S         # human-readable aligned columns
qsv flatten data.csv | head -40      # one "field: value" per line (wide rows)
qsv slice -s 0 -e 5 data.csv         # peek at the first 5 records
```

---

## Select & reshape columns

```bash
qsv select Name,Email data.csv          # keep + re-order by name
qsv select 1-4 data.csv                 # first four columns by index
qsv select '!ssn,dob' data.csv          # drop sensitive columns
qsv select 'Foo[2]' data.csv            # the 2nd column literally named Foo
qsv select /regex/ data.csv             # columns whose names match a regex
qsv rename 'id,full_name,email' data.csv   # set new header names
qsv cat columns a.csv b.csv             # glue files side-by-side (by column)
qsv cat rows a.csv b.csv                # stack files (by row)
qsv transpose data.csv                  # swap rows <-> columns
qsv explode tags ';' data.csv           # one row per ';'-separated tag value
```

---

## Filter & slice rows

```bash
qsv search -s Email '@acme\.com' data.csv     # rows where Email matches regex
qsv search -v '^$' data.csv                    # drop blank matches (-v = invert)
qsv searchset patterns.txt data.csv            # match ANY of many regexes (one/line)
qsv slice -s 10 -e 20 data.csv                 # records 10..20 (0-based, end-exclusive)
qsv slice -i 0 data.csv                        # a single record by index
qsv behead data.csv                            # strip the header row
qsv reverse data.csv                           # last row first
```
`search` returns exit 0 with a match count on stderr, exit 1 when nothing
matches (handy in `if` guards). `--quick` stops at the first match.

---

## Sort, dedupe, sample

```bash
qsv sort -s age -N data.csv             # numeric sort (-N); default is lexicographic
qsv sort -s name --natural data.csv     # natural order (file2 before file10)
qsv sort -s id -R data.csv              # random shuffle (-R)
qsv sortcheck data.csv                  # is it already sorted?
qsv dedup -s email data.csv             # remove rows duplicated on a column (sorts)
qsv extdedup huge.csv                   # dedupe a larger-than-memory file
qsv sample 100 data.csv                 # random sample of 100 rows
qsv sample 0.1 data.csv                 # 10% sample
```

---

## Aggregate & analyze

```bash
qsv stats data.csv                      # type + sum/min/max/mean/stddev… per column
qsv stats --everything data.csv         # add quartiles, median, mode, cardinality…
qsv stats -s amount data.csv            # restrict to selected columns
qsv frequency -s status data.csv        # field,value,count,percentage table
qsv frequency -s status --limit 10 data.csv
qsv pivotp region -v sales --agg sum data.csv   # Polars pivot
```
`stats` is heavily optimized and assumes well-formed UTF-8 CSV — run
`qsv validate data.csv` first if a file might be malformed.

---

## SQL & joins (Polars engine)

```bash
# The file stem becomes the table name (data.csv -> table `data`)
qsv sqlp data.csv 'select status, count(*) as n from data group by status order by n desc'
qsv sqlp sales.csv 'select region, sum(amount) from sales group by region' \
  --format parquet --output region.parquet

# Multiple inputs are data, _t_1, _t_2, …
qsv sqlp orders.csv customers.csv \
  'select o.id, c.name from orders o join customers c on o.cust_id = c.id'

qsv join id left.csv id right.csv       # classic index-based join
qsv joinp id left.csv id right.csv      # Polars join (faster, larger-than-memory)
```

---

## Convert formats

```bash
qsv excel book.xlsx --sheet 1 > sheet1.csv     # Excel sheet -> CSV
qsv to xlsx out.xlsx data.csv                  # CSV -> Excel
qsv to sqlite db.sqlite data.csv               # CSV -> SQLite table
qsv to postgres 'postgres://…' data.csv        # CSV -> Postgres
qsv json api.json > api.csv                    # JSON array -> CSV
qsv jsonl events.jsonl > events.csv            # NDJSON -> CSV
qsv tojsonl data.csv > data.jsonl              # CSV -> NDJSON
qsv fmt -t '\t' data.csv > data.tsv            # change delimiter to tab
qsv snappy compress data.csv                   # fast (de)compression
```

---

## Indexing & huge files

```bash
qsv index data.csv         # writes data.csv.idx → O(1) count, random slice, parallelism
qsv extsort huge.csv out.csv     # external merge sort, constant memory
qsv extdedup huge.csv            # dedupe without loading into RAM
qsv split --size 100000 outdir/ data.csv   # chunk into 100k-row files
qsv partition region outdir/ data.csv       # one file per distinct value
```
Re-index after the file changes; a stale `.idx` is ignored once mtime differs.

---

## Gotchas

- **Quote selection expressions** containing `!`, spaces, `[`, or `/` so the
  shell doesn't mangle them: `qsv select '!1-2'`.
- **`--no-headers`** must be passed to *every* command in a pipe that needs it;
  it isn't inherited.
- **In-memory commands** (`sort`, `frequency`, `stats --everything`, `dedup`)
  can OOM on giant files — reach for `extsort`/`extdedup`/`sqlp` instead.
- **`stats` trusts the CSV.** It skips validation for speed; `qsv validate`
  first if the data may be non-RFC4180 or non-UTF-8.
- Cross-platform: behaves identically on macOS and Linux (no BSD/GNU split).
- When unsure of a flag, `qsv <command> --help` is authoritative for your build.
