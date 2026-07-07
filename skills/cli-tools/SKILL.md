---
name: cli-tools
description: "Use this skill for every task involving shell commands, terminal usage, CLI tools, command-line pipelines, scripts, automation, or debugging command output. Covers rg, fd, jq, yq, sed, awk, xargs, curl, openssl, coreutils, ffmpeg, exiftool, and other shell utilities, especially when composing commands, transforming files/data, searching text, handling JSON/YAML/CSV/HTML, batch-renaming, hashing, downloading, inspecting TLS certs, transcoding media, or avoiding macOS/BSD vs GNU CLI differences."
compatibility: opencode
metadata:
  domain: shell-data-wrangling
  platform: cross-platform
---

# CLI Data-Wrangling Toolkit

A field guide to **composing** small CLI tools into correct, portable pipelines.
Each tool has a deep cookbook in `references/`; this page is the index plus the
part that actually matters day to day — **how the tools pipe together** — and the
macOS/BSD-vs-GNU traps that make one-liners silently wrong.

## Working rules (read once)

- **Think in stages: producer → filter → transform → sink.** Build left to
  right, verifying each stage's output before adding the next `|`.
- **Test before you mutate.** Run the read-only version first (print matches,
  preview the transform) before adding `-i` / redirects / `xargs rm`.
- **Pass NUL between file-name stages.** When names may contain spaces/newlines,
  the producer emits `-0`/`--null`/`-print0` and the consumer reads `-0`.
- **Quote aggressively.** Single-quote any argument with `$ * ? [ ] { } ( ) | \`
  or spaces so the shell doesn't expand it before the tool sees it.
- **`set -o pipefail`** (bash/zsh) so a failure mid-pipe isn't swallowed by a
  successful last stage.
- **Know your platform.** This machine is macOS (BSD userland). `sed -i`,
  `xargs -r`, `awk`, and some coreutils differ from GNU/Linux — see
  [macOS/BSD vs GNU](#macosbsd-vs-gnu-the-traps-that-bite) before scripting.
- **In an editor agent with native Read / Grep / Glob tools, prefer those** for
  plain find-a-file / read-a-file / search-code tasks. Reach for these CLIs when
  you need *composition*, *transformation*, *HTTP*, *crypto*, or a pure-shell
  context (CI, remote box, Makefile).

## Pick the right tool

| Goal | Tool | Cookbook |
|------|------|----------|
| Search file contents (code/text) by regex | `rg` | `references/rg.md` |
| Find files/dirs by name, type, extension | `fd` | `references/fd.md` |
| Find files by metadata (size/date/perms/hash/content), SQL-style | `fselect` | `references/fselect.md` |
| Query / transform / reshape JSON | `jq` | `references/jq.md` |
| Query / edit / convert YAML, XML, TOML | `yq` | `references/yq.md` |
| Substitute / delete / slice lines in a stream | `sed` | `references/sed.md` |
| Column math, grouping, field logic on text | `awk` | `references/awk.md` |
| Run a command per input item (incl. parallel) | `xargs` (or `fd -x`) | `references/xargs.md` |
| Run many jobs in parallel (logs, resume, progress, remote) | `parallel` | `references/parallel.md` |
| HTTP request / hit an API / stream a body | `curl` | `references/curl.md` |
| Download large or many files fast (resumable, multi-source) | `aria2c` | `references/aria2c.md` |
| Hash, HMAC, random/base64, encrypt, TLS certs | `openssl` | `references/openssl.md` |
| Inspect media (codec/resolution/duration/fps) as JSON/CSV | `ffprobe` | `references/ffprobe.md` |
| Convert/resize/trim/transcode audio · video · images | `ffmpeg` | `references/ffmpeg.md` |
| Read/write/strip metadata; detect a file's true type | `exiftool` | `references/exiftool.md` |
| Sort, dedupe, count, cut, translate, join columns | `sort`/`uniq`/`cut`/`tr`/`join`… | `references/coreutils.md` |
| Slice / filter / stat / join CSV & TSV | `qsv` | `references/qsv.md` |
| Extract from HTML via CSS selectors | `htmlq` | `references/htmlq.md` |
| Find & replace (regex), `sed` alternative | `sd` | `references/sd.md` |
| Batch-rename files/dirs by regex | `rnr` | `references/rnr.md` |
| Fuzzy-find / interactively pick lines | `sk` (skim) | `references/skim.md` |

**Load the cookbook for a tool before using it in anger** — each has the full
flag tables, recipes, and per-tool gotchas. This page covers how to combine them.

---

## Composition — the payoff

Every tool reads stdin and writes stdout, so you assemble them like Lego blocks:

```
producer            →  filter             →  transform           →  sink
fd / rg / curl /        rg / awk / jq /        jq / yq / sed /        file, xargs,
qsv / fselect / git     qsv / grep             awk / sd / qsv         sk, openssl
```

The recipes below are grouped by shape. Each line is a real pipeline; the comment
says what it does.

### Find files, then act on them
```bash
fd -e py -0 | xargs -0 wc -l                          # count lines in all python files
fd -e jpg -x convert {} {.}.webp                       # transcode each (fd's built-in exec)
rg -l -0 'TODO' | xargs -0 sed -i '' 's/TODO/DONE/g'   # edit ONLY the files that match
fd service.yaml -0 | xargs -0 yq -i '.version = "2.0"' # bump a key in every service.yaml
fselect "abspath from . where size gt 50mb into lines" | xargs -I{} ls -lh {}  # act on big files
```

### Search → count → rank (the frequency idiom)
```bash
rg -o 'TODO\(([^)]+)\)' -r '$1' | sort | uniq -c | sort -rn          # TODOs per author
git log --name-only --pretty=format: | rg -v '^$' | sort | uniq -c | sort -rn | head  # hot files
rg -oP '"\w+"\s*:' f.json | sort | uniq -c | sort -rn                # most common JSON keys
awk -F',' 'NR>1{c[$3]++} END{for(k in c) print c[k], k}' d.csv | sort -rn   # group+count a column
```

### API → JSON → report
```bash
curl -fsSL "$API/users" | jq 'group_by(.team) | map({team:.[0].team, n:length})'
curl -fsSL "$API/jobs" \
  | jq -r '.[] | select(.status=="failed") | [.id,.name,.error] | @csv' > failures.csv
curl -fsSL "$API/items" | jq -r '.[].url' | xargs -P8 -n1 curl -fsSLO   # fan-out (small files)
```

### Download in bulk (aria2c) & run jobs in parallel (parallel)
```bash
aria2c -x16 -s16 -k1M -c -d ~/iso -o ubuntu.iso "$URL"     # one big file: fast + resumable
curl -fsSL "$API/releases/latest" | jq -r '.assets[].browser_download_url' \
  | aria2c -j6 -x8 -i -                                     # every release asset, in parallel
fd -e jpg | parallel -j8 convert {} {.}.webp               # parallel transcode (xargs -P, but nicer)
parallel --bar -j16 'curl -fsSLO {}' :::: urls.txt         # parallel fetch with a progress bar
cat huge.log | parallel --pipe --block 10M rg ERROR        # parallelize a filter over a huge file
```

### Scrape HTML → clean data
```bash
curl -fsSL "$URL" | htmlq -a href 'table a' | sd '\?.*$' '' | sort -u      # unique link targets
curl -fsSL "$URL" | htmlq -t '.price' | tr -d '$,' | awk '{s+=$1} END{print s}'  # sum prices
```

### CSV crunching (qsv) — with an interactive twist
```bash
qsv select '!ssn' data.csv | qsv search -s state '^CA$' | qsv stats         # drop, filter, stat
qsv frequency -s state data.csv | qsv sort -s count -N --reverse | qsv slice -e 5  # top 5 states
col=$(qsv headers data.csv | sk) && qsv select "$col" data.csv | qsv stats   # pick a column, stat it
```

### Integrity & crypto (openssl)
```bash
curl -fsSL "$URL" -o pkg.tgz && openssl dgst -sha256 pkg.tgz       # download, then checksum
fd -e iso -X openssl dgst -sha256                                   # hash every .iso in one call
openssl rand -hex 32                                                # generate a 256-bit token
echo | openssl s_client -connect "$H:443" -servername "$H" 2>/dev/null \
  | openssl x509 -noout -subject -dates                             # inspect a live TLS cert
```

### Media & metadata (ffprobe / ffmpeg / exiftool)
```bash
fd -e mp4 -x ffprobe -v error -select_streams v:0 \
   -show_entries stream=width,height -of csv=p=0 {} | sort | uniq -c | sort -rn  # resolution tally
fd -e mp4 -x ffprobe -v error -show_entries format=duration -of csv=p=0 {} \
  | awk '{s+=$1} END{printf "%.1f min total\n", s/60}'                # total runtime of a folder
fd -e mov | parallel -j4 ffmpeg -nostdin -i {} -c:v libx264 -crf 23 {.}.mp4      # batch transcode
fd -e png | parallel ffmpeg -nostdin -i {} {.}.webp                              # batch image convert
exiftool -json -r ~/Pictures | jq -r '.[].MIMEType' | sort | uniq -c             # true file-type histogram
fd -e jpg | parallel exiftool -overwrite_original -all= {}                        # strip metadata (privacy)
```

### Interactive selection mid-pipe (skim)
```bash
git branch --format='%(refname:short)' | sk | xargs git checkout    # pick a branch, switch to it
file=$(fd -t f | sk --preview 'bat --color=always {}') && "${EDITOR:-nvim}" "$file"  # preview & open
history | sk --tac --no-sort                                         # fuzzy shell history
```

### Debugging a pipeline
When it misbehaves, isolate it: run the first stage alone, then add one `|` at a
time and eyeball the intermediate output. Add `| head` while exploring so a huge
stage doesn't flood the terminal. Use `xargs -t` to see the exact commands xargs
runs. In scripts, `set -o pipefail` turns a mid-pipe failure into a real error.

---

## macOS/BSD vs GNU — the traps that bite

This machine is macOS, so these defaults differ from most Linux examples online:

| Tool | BSD / macOS | GNU / Linux |
|------|-------------|-------------|
| `sed -i` | needs suffix arg: `sed -i '' 's/…/…/'` | `sed -i 's/…/…/'` |
| `sed` PCRE shorthands | no `\d \w \s` → use `[0-9]`, `[[:alpha:]]` | partial |
| `awk` | BWK awk (no `gensub`, `asort`, `length(array)`) | `gawk` has them |
| `xargs -r` (skip on empty) | unsupported (runs once on empty) | supported |
| `grep -P` (PCRE) | unsupported → use `rg -P` | supported |
| `date -d` parsing | different syntax | GNU `-d` |
| `readlink -f` | unsupported → `realpath` / `grealpath` | supported |
| `shuf` | absent → `gshuf` or `sort -R` | present |
| `openssl` | `/usr/bin/openssl` is LibreSSL (older flags) | OpenSSL 3.x |

Escape hatch: `brew install coreutils gnu-sed grep findutils gawk` gives the GNU
versions prefixed with `g` (`gsed`, `ggrep`, `gdate`, `grealpath`, `gawk`,
`gshuf`); for crypto prefer Homebrew's `openssl` (3.x) over `/usr/bin/openssl`.
`parallel` and `aria2c` aren't preinstalled — `brew install parallel aria2`; with
GNU parallel run `parallel --citation` once to silence its startup notice, and
confirm it's **GNU** parallel (`parallel --version`), not the unrelated
`moreutils` program of the same name. `ffmpeg`/`ffprobe` and `exiftool` come from
`brew install ffmpeg exiftool`; on this machine the `ffmpeg`/`ffprobe` first on
`PATH` is a broken zerobrew build (`dyld: Library not loaded … libvmaf …`) — use
`/opt/homebrew/bin/ffmpeg` or reinstall. Note that `rg`, `fd`, `jq`, `yq`, and the
Rust tools (`qsv`, `htmlq`, `sd`, `rnr`, `sk`, `fselect`) behave **the same**
across platforms — another reason to prefer them over `grep`/`find`/`sed` in
portable scripts.
