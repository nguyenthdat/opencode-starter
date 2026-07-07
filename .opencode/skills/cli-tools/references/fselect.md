# fselect — find files with SQL-like queries (deep cookbook)

`fselect` searches the filesystem with an **SQL-ish query** instead of flags:
you `SELECT` columns (name, size, modified, sha256, exif…), `FROM` one or more
roots, filter with `WHERE`, and optionally `GROUP BY` / `ORDER BY` / `LIMIT` /
`INTO <format>`. It shines when the predicate is *metadata* — size ranges,
dates, permissions, image dimensions, audio tags, content type, hashes — i.e.
exactly the things `fd` can't express.

> **Two defaults that bite (opposite of `fd`/`rg`):**
> 1. **`.gitignore` is NOT respected by default** — it walks `.git/`,
>    `node_modules/`, build dirs and everything else. Opt in with the `gitignore`
>    path keyword.
> 2. **Hidden files ARE included by default** (dotfiles, `.DS_Store`…).
>
> On this dotfiles repo: `count(*)` → 4379 vs `gitignore` → 330. Always add
> `gitignore` when you mean "what git sees."

Authoritative reference for your build: `fselect --help` (lists every column,
function, operator, and output format).

## Contents
- [Query anatomy](#query-anatomy)
- [Columns (what to SELECT)](#columns-what-to-select)
- [Path options (the FROM modifiers)](#path-options-the-from-modifiers)
- [WHERE: operators](#where-operators)
- [Size & date recipes](#size--date-recipes)
- [Content & type filters](#content--type-filters)
- [Hashes, perms, media metadata](#hashes-perms-media-metadata)
- [Aggregate & group](#aggregate--group)
- [Functions](#functions)
- [Output formats & piping](#output-formats--piping)
- [Gotchas](#gotchas)

---

## Query anatomy

```
fselect [COLUMNS] from [PATHS] [path-options] where [EXPR] \
        [group by …] [order by … asc|desc] [limit N] [offset N] [into FORMAT]
```

- The query may be **one quoted string** or **bare tokens** — both parse:
  `fselect name from . where ext = md` ≡ `fselect "name from . where ext = 'md'"`.
  Quote the whole thing once you use `*`, `%`, `()`, spaces, or `;` so the shell
  keeps its hands off.
- `from .` defaults to the current dir; multiple roots: `from ~/a, ~/b`.
- Almost everything after `COLUMNS` is optional — `fselect size, path from .`
  just lists.

```bash
fselect name from . where ext = md                       # bare tokens
fselect "size, path from . where ext = 'md'"             # quoted equivalent
fselect "name from /etc, /usr/local/etc where size gt 0" # two roots
```

---

## Columns (what to SELECT)

Common ones (run `--help` for the full ~150):

| Column | Meaning |
|--------|---------|
| `name` / `filename` / `ext` | name+ext / stem / extension |
| `path` / `abspath` / `dir` / `absdir` | relative / absolute path & dir |
| `size` / `fsize` (`hsize`) | bytes / human-readable (`4.50KiB`) |
| `modified` / `created` / `accessed` | `YYYY-MM-DD HH:MM:SS` |
| `mtime` / `ctime` / `atime` | Unix-epoch versions |
| `is_dir` / `is_file` / `is_symlink` / `is_empty` | booleans |
| `is_hidden` / `mode` / `user` / `group` | hidden flag, perms, owner |
| `line_count` / `mime` / `is_binary` / `is_text` | text metadata |
| `is_source` / `is_image` / `is_video` / `is_audio` / `is_doc` / `is_archive` | category flags |

```bash
fselect "name, fsize, modified from . where ext = 'log'"
fselect "abspath from ~/src where is_source = true"
fselect "ext, mime from . maxdepth 1 where is_file = true"
```

---

## Path options (the FROM modifiers)

These go **after the path(s), before `where`**:

| Keyword | Effect |
|---------|--------|
| `gitignore` / `git` | **respect** `.gitignore` (off by default) |
| `nogitignore` / `nogit` | force-disable it |
| `hgignore` / `dockerignore` | respect `.hgignore` / `.dockerignore` |
| `maxdepth N` (`depth N`) / `mindepth N` | bound recursion depth |
| `archives` / `arc` | descend into `.zip`, `.tar`, `.gz`… |
| `symlinks` / `sym` | follow symlinks |
| `dfs` / `bfs` | depth- vs breadth-first (bfs default) |
| `regexp` / `rx` | treat the path argument as a regex |

```bash
fselect "path from . gitignore where ext = 'rs'"      # only what git tracks
fselect "name from . maxdepth 1 where is_file = true"  # this dir only, no recursion
fselect "name from . archives where ext = 'txt'"       # peek inside archives too
```

---

## WHERE: operators

| Want | Operators |
|------|-----------|
| Equality / strict (ignore regex meta) | `=` `==` `eq` · strict `===` `eeq` |
| Inequality | `!=` `<>` `ne` |
| Ordering | `<` `<=` `>` `>=` (`lt` `lte` `gt` `gte`) |
| Regex match / not | `~=` (`regexp`/`rx`) · `!=~` (`notrx`) |
| SQL `LIKE` (`%`, `_`) / not | `like` / `notlike` |
| Range (inclusive) | `between A and B` |
| Set membership | `in (a, b, c)` |
| Combine | `and` · `or` (group with `()` ) |

```bash
fselect "name from . where name like '%.test.ts'"        # SQL wildcard
fselect "path from . where name ~= '\.(jpe?g|png)$'"     # regex, anchored
fselect "name from . where ext in ('md','txt','rst')"    # any of a set
fselect "name from . where (ext = 'js' or ext = 'ts') and size gt 10kb"
```

> `=` / `like` patterns are matched **case-insensitively against the file name**
> for the bare `name`/`ext` shorthand; use `~=` when you need full regex control,
> and `===` to match literally when the value contains regex metacharacters.

---

## Size & date recipes

Size accepts unit suffixes: `kb mb gb tb` (also `kib mib…`). Dates are
`'YYYY-MM-DD'` or `'YYYY-MM-DD HH:MM:SS'` strings.

```bash
# Big files, largest first, human sizes
fselect "fsize, abspath from ~ where size gt 100mb order by size desc limit 20"

# Empty files / empty dirs
fselect "path from . where is_empty = true"

# Changed since a date (use the date columns, string-compared)
fselect "name, modified from . where modified gt '2026-06-01'"

# Last 7 days via the epoch column + CURRENT_TIMESTAMP/NOW math
fselect "path from . where modified gt CURRENT_TIMESTAMP() - 7"   # see Functions

# Size band
fselect "name, size from . where size between 1mb and 10mb order by size"
```

---

## Content & type filters

`fselect` can read file *contents* and sniff type — powerful, but these read
each candidate file, so scope with depth/ext first.

```bash
fselect "path from . where contains('TODO')"             # files containing a substring
fselect "path, line_count from . where ext = 'py' and line_count gt 500"
fselect "name from . where is_binary = true"             # binary vs text
fselect "abspath from . where is_source = true and is_text = true"
fselect "name, mime from . maxdepth 2 where mime ~= '^image/'"
fselect "path from . where is_shebang = true"            # starts with #!
```

`is_archive/is_audio/is_book/is_doc/is_font/is_image/is_source/is_video` classify
by extension; `contains(...)`, `line_count`, `is_binary/is_text`, `mime`, and
`is_shebang` actually inspect bytes.

---

## Hashes, perms, media metadata

```bash
# Find duplicate candidates by hash (group on the digest)
fselect "sha256, count(*), path from . where is_file = true group by sha256"

# World-writable or SUID files (security sweep)
fselect "mode, path from / where other_write = true and is_file = true"
fselect "path from /usr where suid = true"

# Images by dimension / EXIF camera
fselect "width, height, path from ~/Pictures where width gte 3840"
fselect "exif_model, path from ~/Pictures where exif_make = 'Apple'"

# Audio by tag / duration
fselect "mp3_artist, mp3_title, path from ~/Music where duration gt 300"
```

Hash columns (`sha1`, `sha256`, `sha512`, `sha3`), media/EXIF columns, and
`line_count`/`contains` all open & read files — combine with `maxdepth`,
`ext`, or a category flag to avoid hashing the whole disk.

---

## Aggregate & group

SQL aggregates work, with or without `group by`:

```bash
fselect "count(*) from . gitignore where is_file = true"
fselect "ext, count(*) from . group by ext order by count(*) desc"
fselect "ext, count(*), format_size(sum(size)) from . group by ext"
fselect "max(size), min(size), avg(size) from . where ext = 'log'"
```

Aggregates: `MIN MAX AVG SUM COUNT STDDEV VAR_POP VAR_SAMP …`.

---

## Functions

Wrap columns in functions in either the SELECT list or the WHERE clause.

| Family | Examples |
|--------|----------|
| String | `LOWER UPPER INITCAP LENGTH SUBSTR REPLACE TRIM CONCAT` |
| Numeric | `ABS ROUND FLOOR CEIL SQRT POWER LEAST GREATEST` |
| Size/time | `FORMAT_SIZE(bytes)` · `FORMAT_TIME(seconds)` |
| Datetime | `CURRENT_DATE() NOW() YEAR() MONTH() DAY() DATE_DIFF() FROM_UNIXTIME()` |
| User/group | `CURRENT_USER() CURRENT_UID()` |
| Content | `CONTAINS('str')` · `COALESCE(a,b,…)` |

```bash
fselect "upper(ext), count(*) from . group by upper(ext)"
fselect "name from . where lower(name) like '%readme%'"
fselect "format_size(sum(size)) from ~/Downloads"
fselect "name, format_time(duration) from ~/Music where is_audio = true"
```

---

## Output formats & piping

Append `into FORMAT`: `tabs` (default), `lines`, `list`, `csv`, `json`, `html`.

```bash
fselect "path from . where ext = 'md' into csv"          # CSV for a spreadsheet
fselect "name, size from . where is_file=true into json"  # JSON → jq
fselect "abspath from . where ext = 'png' into list"      # one space-joined line

# Feed results to another command. `lines` + xargs is the safe-ish combo:
fselect "abspath from . where ext = 'tmp' into lines" | xargs -I{} rm -v {}

# JSON pipeline into jq
fselect "name, size from . where is_file=true into json" | jq 'sort_by(.Size)'
```

> There is **no built-in delete/exec** and no NUL output, so paths with spaces or
> newlines are unsafe through a naive `xargs`. Prefer letting `fselect` filter,
> then act with `fd`'s `-X`/`-x` or a guarded `xargs`. For destructive ops,
> dry-run by printing first.

---

## Gotchas

- **Defaults differ from `fd`/`rg`:** add `gitignore` to honor `.gitignore`;
  hidden files are already included (no `--hidden` needed).
- **Quote the whole query** when it contains `*`, `%`, `()`, `;`, or spaces, so
  the shell doesn't expand/split it. Inside the query, **string literals use
  single quotes** (`ext = 'md'`).
- **Regex vs LIKE vs `=`:** `like` uses SQL `%`/`_`; `~=` is a real regex
  (anchor with `$`); bare `=` on `name`/`ext` is a convenient case-insensitive
  match. Use `===` to match literally when the value has regex metacharacters.
- **Content/hash/media columns read files** — they're slow on large trees.
  Narrow with `maxdepth`, an `ext` test, or a category flag first.
- **No mutation built in:** `fselect` only *finds*. Pipe to `xargs`/`fd -X` to
  act, and beware unsafe filenames (no `-0`).
- **Depth keyword placement:** `maxdepth`/`gitignore`/`archives` go *after* the
  path and *before* `where`; putting them elsewhere errors with "could not parse
  tokens."
- Cross-platform: query syntax is identical on macOS and Linux. Some columns are
  OS-specific (Linux `capabilities`/`extattrs`, Windows ADS); EXIF/audio/hash
  columns work everywhere.
