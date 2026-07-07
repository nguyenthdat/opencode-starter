# yq — deep cookbook

## Which yq? (check first — they are different programs)

```bash
yq --version
```

- **mikefarah/yq (Go)** — the widely-installed one (Homebrew `yq`, most CI
  images). jq-*like* expression syntax, edits files in place, **preserves
  comments and key order**, converts between YAML/JSON/XML/TOML/CSV/properties.
  Everything below assumes this version.
- **kislyuk/yq (Python)** — a wrapper that shells out to real `jq`. Use jq
  syntax (see `references/jq.md`) and add `-y` to emit YAML. Installed via
  `pip install yq` and depends on `jq` being present.

If a "yq" command from the internet errors with surprising syntax complaints,
you probably have the other implementation.

## mikefarah core model

- Default operation is **eval** (`yq e`, or just `yq`), running the expression
  per document.
- **eval-all** (`yq ea`) loads *all* documents/files together so you can merge
  or compare them; the document index is the variable `di`.
- Output is YAML unless you pick another with `-o` (alias `--output-format`).
- Input format is inferred from the file extension; override with `-p`
  (`--input-format`).

| Need | Command |
|------|---------|
| Read a path | `yq '.a.b' f.yaml` |
| Read with default | `yq '.a.b // "x"' f.yaml` |
| Set / edit in place | `yq -i '.a.b = "x"' f.yaml` |
| Add to an array | `yq -i '.list += ["x"]' f.yaml` |
| Delete a key | `yq -i 'del(.a.b)' f.yaml` |
| Rename a key | `yq -i '.new = .old \| del(.old)' f.yaml` |
| Keys / length | `yq '.a \| keys' f.yaml` · `yq '.a \| length'` |
| Select across array | `yq '.items[] \| select(.on == true)' f.yaml` |
| Env var into doc | `yq -i '.tag = strenv(TAG)' f.yaml` |

## Format conversion

```bash
yq -o=json '.' f.yaml                 # YAML → JSON
yq -p=json -o=yaml '.' f.json         # JSON → YAML
yq -p=xml  -o=yaml '.' f.xml          # XML  → YAML
yq -o=props '.' f.yaml                # → java .properties
yq -o=csv '.rows' f.yaml              # → CSV (array of arrays/objects)
yq -p=csv -o=json '.' f.csv           # CSV → JSON
yq -o=json '.' f.toml                 # TOML in (auto by .toml) → JSON
```

`-p` = input format, `-o` = output format. Valid values: `yaml`, `json`, `xml`,
`props`, `csv`, `tsv`, `toml` (toml is input-only).

## Multi-document files (`---`)

```bash
yq '.metadata.name' k8s.yaml                 # runs on EACH document
yq 'select(.kind == "Service")' k8s.yaml     # keep only matching docs
yq ea '[.[] | .kind]' k8s.yaml               # collect across all docs (eval-all)
yq ea 'select(di == 0)' k8s.yaml             # only the first document
yq -s '.kind + "_" + .metadata.name' k8s.yaml  # SPLIT into one file per doc
```

`-s`/`--split-exp` writes each document to its own file named by the expression.

## Merging

```bash
# Shallow merge b onto a (b wins), preserving comments:
yq ea '. as $item ireduce ({}; . * $item)' a.yaml b.yaml

# Merge a file into the current doc in place:
yq -i '. *= load("override.yaml")' base.yaml

# Deep merge with array-append semantics:
yq ea '. as $i ireduce ({}; . *+ $i)' a.yaml b.yaml
```

`*` merges objects (right wins on conflict); `*+` also appends arrays; `*?`
only sets keys that don't already exist.

## Scripting patterns

```bash
# Bump image tag in every k8s Deployment across a dir, in place
fd -e yaml -0 | xargs -0 yq -i '(.spec.template.spec.containers[].image) |= sub(":.*", ":v2")'

# Extract all images referenced anywhere, deduped
yq '.. | select(has("image")) | .image' k8s.yaml | sort -u

# Read a value into a shell variable
VERSION=$(yq -r '.version' chart.yaml)        # -r/-e: raw scalar (no quotes)

# Validate that a key exists, exit non-zero if not
yq -e '.required.key' config.yaml >/dev/null || echo "missing key"
```

> Use `yq` (not `sed`) to edit YAML: it understands structure and indentation,
> and it keeps your comments. Hand-editing YAML with `sed` reliably corrupts
> indentation-sensitive files.

## Comments & styling

```bash
yq '.a line_comment="set in CI"' f.yaml      # attach a comment
yq '... comments=""' f.yaml                   # strip all comments
yq -P '.' f.yaml                              # pretty / normalize formatting
yq '.a style="double"' f.yaml                 # force quoting style on a node
```

## kislyuk/yq (Python) quick note

```bash
yq '.a.b' f.yaml         # jq syntax, prints JSON by default
yq -y '.a.b' f.yaml      # -y → emit YAML instead of JSON
xq '.root.child' f.xml   # bundled XML variant
tomlq '.tool.poetry' pyproject.toml
```

If you're on this version, the full filter language is jq — read
`references/jq.md`.
