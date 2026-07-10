# GNU parallel — run jobs in parallel (deep cookbook)

`parallel` builds and runs shell commands from a list of inputs, many at once —
think `xargs -P` with sane quoting, rich `{}` replacements, multiple/linked input
sources, a job log you can resume, a progress bar, and even remote execution.
Reach for it when `xargs -P` / `fd -x` stop being expressive enough.

> **Two different programs are named `parallel`.** This guide is **GNU parallel**
> (`parallel --version` prints "GNU parallel YYYYMMDD"). The `moreutils` package
> ships an unrelated, much simpler `parallel` — they conflict. Install GNU with
> `brew install parallel`. Not preinstalled on macOS.

## Contents
- [Input sources](#input-sources)
- [Replacement strings](#replacement-strings)
- [Controlling parallelism & output](#controlling-parallelism--output)
- [Job logs, retries, resume](#job-logs-retries-resume)
- [Splitting a stream (`--pipe`)](#splitting-a-stream---pipe)
- [Recipes](#recipes)
- [parallel vs xargs](#parallel-vs-xargs)
- [Gotchas](#gotchas)

---

## Input sources

```bash
parallel echo ::: a b c                 # inline args after :::
parallel echo :::: list.txt             # args from a file (:::: )
cat list.txt | parallel echo            # args from stdin (one per line)
parallel -a list.txt echo               # -a == ::::
parallel echo ::: a b ::: 1 2           # TWO sources => cartesian: a 1 / a 2 / b 1 / b 2
parallel echo {1} {2} ::: a b :::+ 1 2  # :::+ LINKS sources pairwise: a 1 / b 2
parallel --colsep ',' echo {1}-{2} :::: pairs.csv   # split each input line on ','
```

`:::` = inline list, `::::` = file(s), `:::+`/`::::+` = link instead of multiply.

---

## Replacement strings

For a single input source `{}` is the value; with multiple sources use `{1}`,
`{2}`, … Each has path-trimming variants:

| Token | Expands to |
|-------|-----------|
| `{}` | the whole input item |
| `{.}` | item without extension (`a/b.txt` → `a/b`) |
| `{/}` | basename (`a/b.txt` → `b.txt`) |
| `{//}` | dirname (`a/b.txt` → `a`) |
| `{/.}` | basename without extension (`b`) |
| `{#}` | sequential job number |
| `{%}` | job slot (1..jobs) |
| `{1} {2} …` / `{1.}` etc. | the Nth input source, with the same modifiers |

```bash
parallel convert {} {.}.png ::: *.jpg          # foo.jpg -> foo.png
parallel mkdir -p out/{//} ';' cp {} out/{} ::: src/**/*.txt
```

---

## Controlling parallelism & output

```bash
parallel -j8 ...        # 8 jobs at once
parallel -j200% ...     # 2× CPU cores
parallel -j0 ...        # as many as possible
parallel -k ...         # KEEP output in input order (default order = completion)
parallel --bar ...      # progress bar (also --eta)
parallel --dry-run ...  # print the commands instead of running them
parallel --line-buffer ...   # stream each job's lines as they appear
```

Output is **grouped per job by default** (no interleaving) — a big win over
`xargs -P`, whose parallel output interleaves. Use `-k` to also order jobs by
input, `-u` to ungroup (raw, fastest, may interleave).

---

## Job logs, retries, resume

```bash
parallel --joblog jl.txt -j8 mycmd {} ::: *.in     # record every job's status/time
parallel --retries 3 flaky-cmd {} ::: list         # retry failures up to 3×
parallel --halt now,fail=1 ...                      # stop all on first failure
# Re-run only the jobs that hadn't completed:
parallel --resume --joblog jl.txt -j8 mycmd {} ::: *.in
parallel --resume-failed --joblog jl.txt ...        # re-run only failures
```

`--joblog` + `--resume` is the killer feature for long batch jobs that get
interrupted — you don't redo finished work.

---

## Splitting a stream (`--pipe`)

`--pipe` feeds *chunks of stdin* to each job instead of arguments — parallelize a
filter over a huge file:

```bash
cat huge.log | parallel --pipe --block 10M grep ERROR        # grep in 10MB chunks
cat big.csv  | parallel --pipe --header : --block 5M wc -l    # keep CSV header per chunk
```

---

## Recipes

```bash
fd -e jpg | parallel -j8 convert {} {.}.webp            # transcode images
fd -e log | parallel -j4 gzip                            # compress each log
parallel --bar -j16 'curl -fsSLO {}' :::: urls.txt       # parallel downloads w/ progress
parallel -j4 'ffmpeg -i {} -vn {.}.mp3' ::: *.mp4         # extract audio
parallel -k 'echo "== {} =="; rg -c TODO {}' ::: src/*.go # ordered per-file report
git ls-files '*.py' | parallel -j8 black --check         # lint in parallel
parallel ssh {} 'uptime' ::: host1 host2 host3           # run on remote hosts (-S also)
```

---

## parallel vs xargs

| Want | Use |
|------|-----|
| Always available, lightweight, NUL-safe streaming | `xargs -0 -P` |
| Safe quoting without `-0`, `{.}`/`{/}` path edits | `parallel` |
| Grouped (non-interleaved) parallel output | `parallel` (default) |
| Cartesian / linked multiple input lists | `parallel` ::: / :::+ |
| Job log + resume after interruption | `parallel --joblog --resume` |
| Progress bar / ETA | `parallel --bar` |
| Split a big stream into parallel filter chunks | `parallel --pipe` |

If `xargs -P4 -I{} cmd {}` already does the job, keep it — it's everywhere. Move
to `parallel` for the features above.

---

## Gotchas

- **It's not the moreutils `parallel`.** Verify with `parallel --version`
  ("GNU parallel"). `brew install parallel`; if `moreutils` is also installed,
  one shadows the other on `PATH`.
- **Citation notice on first run.** GNU parallel prints an academic citation
  request once; silence it permanently with `parallel --citation` (writes
  `~/.parallel/will-cite`). Harmless, but it pollutes stderr in scripts until you
  do this.
- **Quoting:** parallel quotes `{}` for you, so `parallel cmd {} ::: *.txt` is
  safe. When your command itself contains a pipe/redirect, wrap it in quotes:
  `parallel 'a {} | b' ::: …`.
- **Default order is completion order** — add `-k` if downstream cares about input
  order.
- **`:::` multiplies, `:::+` links** — two `:::` give a cartesian product, a
  frequent surprise.
- Not portable-by-default: a script using `parallel` must ensure it's installed
  (and is the GNU one). For maximum portability, `xargs -P` is the safer bet.
