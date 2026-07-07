# jq — deep cookbook

jq is a small functional language. Data enters on stdin, flows through a
pipeline of filters joined by `|`, and each filter can emit zero, one, or many
values. Understanding "a filter is a function from one input to a stream of
outputs" explains almost everything.

## Contents
- [Invocation flags](#invocation-flags)
- [Accessing data](#accessing-data)
- [Constructing output](#constructing-output)
- [Filtering & transforming](#filtering--transforming)
- [Aggregation](#aggregation)
- [Strings](#strings)
- [Variables & arguments](#variables--arguments)
- [Control flow & errors](#control-flow--errors)
- [Recursion & paths](#recursion--paths)
- [Multiple/large inputs](#multiple--large-inputs)
- [Recipes](#recipes)

## Invocation flags

| Flag | Meaning |
|------|---------|
| `-r` | raw output — strings printed without quotes (use when piping to the shell) |
| `-c` | compact — one JSON value per line (great for `jq \| while read`) |
| `-j` | join output with no newlines |
| `-n` | null input — start from `null`, build data yourself or via `inputs` |
| `-s` | slurp — read the whole input stream into one array |
| `-R` | raw input — each line is a string (combine with `-s` to get all lines) |
| `-e` | set exit code from the last output (false/null → 1); good for `if` in scripts |
| `--arg n v` / `--argjson n v` | pass a shell string / JSON as `$n` |
| `--slurpfile n f` / `--rawfile n f` | load a file as `$n` |
| `-f file.jq` | read the program from a file |

## Accessing data

```bash
.a.b.c                 # nested fields
.a?                    # optional — no error if .a is missing/null
.["weird key"]         # bracket form for non-identifier keys
.[]                    # values of an array OR object (a stream)
.[0]  .[-1]  .[2:5]    # index, last, slice
.a.b // "default"      # alternative: value of left unless null/false
getpath(["a","b"])     # programmatic path
```

`.[]` is the workhorse: `.users[]` turns an array into a stream of elements that
the next `|` stage processes one at a time.

## Constructing output

```bash
{id, name}                       # shorthand: {id: .id, name: .name}
{id: .id, tag: .meta.tag}        # explicit
[.a, .b]                         # array
[.[] | .name]                    # collect a stream back into an array
{(.key): .value}                 # computed key (parentheses required)
.user + {active: true}           # merge objects (right wins)
```

Wrapping a stream in `[ ... ]` collects it; this is how you go from "many
values" back to "one array".

## Filtering & transforming

```bash
.[] | select(.age > 30)              # keep matching elements
map(.price * 1.1)                    # transform each element of an array
map(select(.active))                 # filter an array (map+select)
map_values(. // 0)                   # transform each value of an object
del(.password, .token)               # remove keys
.items |= map(.id)                   # update-in-place with |=
to_entries | map(.value) | add       # sum object values
paths                                 # every path in the structure
walk(if type=="string" then ascii_downcase else . end)  # deep transform
```

## Aggregation

```bash
length                                   # array length / string length / object size
add                                       # sum numbers, concat arrays/strings
group_by(.team)                           # → array of arrays (input must be sorted by key; group_by sorts for you)
unique  / unique_by(.id)
sort_by(.created) | reverse
min_by(.cost)  max_by(.score)
[ .[] | .amount ] | add                   # total a field
group_by(.team) | map({team: .[0].team, count: length, total: (map(.amt)|add)})
reduce .[] as $x (0; . + $x.n)            # explicit fold
```

## Strings

```bash
"\(.first) \(.last)"           # interpolation
ascii_downcase  ascii_upcase
ltrimstr("v")  rtrimstr(".0")  # strip known prefix/suffix
split(",")   join("|")
test("^v\\d+")                  # regex boolean
match("(\\d+)").captures        # regex captures
gsub("\\s+"; "_")               # regex replace-all
capture("(?<y>\\d{4})-(?<m>\\d{2})")   # named groups → object
@csv  @tsv  @json  @base64  @uri  @sh   # format/encode a value
```

`gsub`/`test`/`match`/`capture` use Oniguruma regex; double-escape backslashes
inside the jq string (`"\\d"`).

## Variables & arguments

```bash
jq --arg env "prod" '.[] | select(.env == $env)'        # string from shell
jq --argjson min 100 '.[] | select(.cost >= $min)'      # number/JSON from shell
jq '.items[] as $it | $it.tags[] | {tag: ., id: $it.id}' # bind then iterate
jq -n --slurpfile a a.json --slurpfile b b.json '$a[0] * $b[0]'  # merge two files
env.HOME, $ENV.PATH                                       # environment
```

Always pass shell values via `--arg`/`--argjson`, never by string-interpolating
into the program — that avoids quoting bugs and injection.

## Control flow & errors

```bash
if .x > 0 then "pos" elif .x < 0 then "neg" else "zero" end
.x // empty                      # drop nulls from the stream (empty = no output)
try .a.b.c catch "n/a"           # swallow errors with a fallback
.[]? // empty                    # iterate only if iterable, else nothing
select(.score? // 0 > 50)
```

`empty` produces no output — use it to filter a stream (`map(select(...))` or
`.[] | select(...) // empty`). `?` after a filter suppresses its errors.

## Recursion & paths

```bash
..                                # recursive descent: every value at every depth
.. | .image? // empty             # every "image" field anywhere, nulls dropped
.. | numbers                      # every number in the document
paths(scalars)                    # paths to every leaf
leaf_paths
getpath(p) / setpath(p; v) / delpaths(ps)
```

`..` is invaluable for "find this key wherever it is" without knowing the shape.

## Multiple / large inputs

```bash
jq -s 'add' a.json b.json                  # slurp many files into one array, sum
jq -n '[inputs] | length' *.json           # -n + inputs: count records across files
jq -c '.[]' big.json | while read -r row; do …; done   # stream rows to a shell loop
jq --stream '…' huge.json                   # event stream for files too big for RAM
```

For very large arrays, `jq -c '.[]'` emits one compact object per line so you can
process them incrementally instead of holding the whole structure in memory.

## Recipes

```bash
# package.json → list of dependency names
jq -r '.dependencies | keys[]' package.json

# Flatten nested config to dotted-key=value lines
jq -r 'paths(scalars) as $p | "\($p|join("."))=\(getpath($p))"' config.json

# Pretty-print + sort keys for a stable diff
jq -S . a.json > a.norm.json

# Turn an array of objects into a CSV with a header row
jq -r '(.[0]|keys_unsorted) as $k | $k, (.[]|[.[ $k[] ]]) | @csv' rows.json

# Merge an override file onto a base (deep-ish, right wins at top level)
jq -s '.[0] * .[1]' base.json override.json

# Count occurrences of a field value
jq -r '.[].status' events.json | sort | uniq -c | sort -rn
```
