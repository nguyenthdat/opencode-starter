# aria2c — fast, resumable, multi-source downloads (deep cookbook)

`aria2c` (aria2) is a download utility that opens **multiple connections per
file**, can pull one file from **several mirrors at once**, **resumes** broken
transfers, reads a **list of URLs**, and speaks HTTP(S)/FTP/SFTP/BitTorrent/
Metalink. For large or flaky files and bulk fetches it is much faster and more
robust than `curl`/`wget`. (aria2 1.37 here.)

> **Use `aria2c` for downloading bytes to disk; keep `curl` for APIs/JSON and
> streaming to a pipe.** aria2c is file-oriented — it doesn't pipe a response
> body to stdout the way `curl` does.

## Contents
- [The invocation to memorize](#the-invocation-to-memorize)
- [Multi-connection options](#multi-connection-options)
- [Batch downloads & input files](#batch-downloads--input-files)
- [Resume, overwrite, integrity](#resume-overwrite-integrity)
- [Auth, headers, throttling, quiet](#auth-headers-throttling-quiet)
- [Mirrors & Metalink / BitTorrent](#mirrors--metalink--bittorrent)
- [Recipes](#recipes)
- [vs curl / wget](#vs-curl--wget)
- [Gotchas](#gotchas)

---

## The invocation to memorize

```bash
aria2c -x16 -s16 -k1M -c "$URL"            # 16 conns, 16 splits, 1MB pieces, resumable
aria2c -x16 -s16 -k1M -c -d ~/Downloads -o file.iso "$URL"   # choose dir + filename
aria2c -c "$URL"                            # just resume an interrupted download
```

- `-x16` connections **per server** (max 16), `-s16` total **splits** of the
  file, `-k1M` minimum piece size, `-c` continue/resume. This trio saturates
  bandwidth on a big file.

---

## Multi-connection options

| Flag | Meaning |
|------|---------|
| `-x, --max-connection-per-server=N` | connections to one server (≤16) |
| `-s, --split=N` | split the file into N segments |
| `-k, --min-split-size=SIZE` | don't split below 2×SIZE (e.g. `1M`) |
| `-j, --max-concurrent-downloads=N` | how many *files* at once (batch mode) |
| `-Z, --force-sequential` | treat several URL args as separate downloads |
| `-d, --dir=DIR` / `-o, --out=FILE` | output directory / filename |

`-x`/`-s` speed up **one** file; `-j` controls how many **different** files
download concurrently. Combine them for bulk: `-j8 -x16`.

---

## Batch downloads & input files

```bash
aria2c -i urls.txt                          # one URL per line
aria2c -j8 -x16 -i urls.txt                 # 8 files at a time, 16 conns each
jq -r '.[].url' api.json | aria2c -i -       # URL list piped from jq (-i - = stdin)
aria2c -Z "$U1" "$U2" "$U3"                  # 3 URLs as 3 separate downloads
```

**Input-file format** (`-i`): each URL on its own line; per-download options go on
**indented** following lines:

```
https://example.com/big.iso
  out=ubuntu.iso
  dir=/data/isos
https://example.com/other.zip
  out=other.zip
```

---

## Resume, overwrite, integrity

```bash
aria2c -c "$URL"                             # resume (uses the .aria2 control file)
aria2c --allow-overwrite=true "$URL"         # redownload over an existing file
aria2c --auto-file-renaming=false "$URL"     # don't save as file.1 on conflict
aria2c --conditional-get=true -o page.html "$URL"   # only if newer (HTTP)
aria2c --checksum=sha-256=<HEX> "$URL"       # verify hash after download
aria2c -V --checksum=sha-256=<HEX> "$URL"    # also validate piece-by-piece
aria2c --max-tries=5 --retry-wait=3 "$URL"   # retry policy
```

aria2 does **not** verify integrity unless you pass `--checksum` (or use
Metalink). For a one-off, verify afterward with `openssl dgst -sha256` (see
`references/openssl.md`).

---

## Auth, headers, throttling, quiet

```bash
aria2c --http-user=u --http-passwd="$PW" "$URL"
aria2c --header="Authorization: Bearer $TOK" "$URL"
aria2c --load-cookies=cookies.txt "$URL"
aria2c --max-download-limit=2M "$URL"            # cap this download to 2 MB/s
aria2c --max-overall-download-limit=10M -i urls.txt   # cap the whole run
aria2c --console-log-level=warn --summary-interval=0 "$URL"   # quieter output
aria2c -q "$URL"                                  # fully quiet
```

> Pass tokens/passwords via env vars, not literals, and avoid putting secrets in
> an `-i` input file that might get committed.

---

## Mirrors & Metalink / BitTorrent

```bash
aria2c -x4 -o out.iso "$M1" "$M2" "$M3"      # same file from 3 mirrors, combined
aria2c file.metalink                          # Metalink: mirrors + checksums built in
aria2c file.torrent                           # download a torrent
aria2c "magnet:?xt=urn:btih:..."              # magnet link
aria2c --seed-time=0 file.torrent             # download but don't seed afterward
aria2c -S file.torrent                        # list files inside a torrent
aria2c --bt-metadata-only=true --bt-save-metadata=true "magnet:?..."  # fetch .torrent only
```

Metalink is the nicest case: it carries mirror lists *and* checksums, so aria2
parallelizes across mirrors and verifies automatically.

---

## Recipes

```bash
# Fast single big file, resumable, into a chosen folder
aria2c -x16 -s16 -k1M -c -d ~/iso -o ubuntu.iso "$URL"

# Grab every asset URL from a GitHub release JSON, 6 at a time
curl -fsSL "$API/releases/latest" | jq -r '.assets[].browser_download_url' \
  | aria2c -j6 -x8 -i -

# Mirror a list of dataset files, capped to 20 MB/s overall, quiet
aria2c -i datasets.txt -j4 -x16 --max-overall-download-limit=20M --console-log-level=warn

# Download then verify against a known checksum
aria2c -x16 -c -o app.dmg "$URL" && openssl dgst -sha256 app.dmg
```

---

## vs curl / wget

| Job | Best tool |
|-----|-----------|
| Large / flaky / resumable file, max throughput | **aria2c** (`-x16 -s16 -c`) |
| Many files / URL list in parallel | **aria2c** (`-j -i`) |
| Multiple mirrors or Metalink/torrent | **aria2c** |
| Hitting an API, headers, JSON, pipe to `jq` | **curl** |
| Stream a body straight into another command | **curl** (`curl -fsSL | …`) |
| Recursive site mirror (`--mirror`, follow links) | **wget** |

---

## Gotchas

- **`-x` vs `-s`:** `-x` = connections per *server* (hard cap 16), `-s` = total
  segments. Use both (`-x16 -s16 -k1M`). More isn't always faster and some
  servers throttle or ban many connections.
- **Saves to the current directory by default** — set `-d`. On a name clash it
  auto-renames to `file.1`; disable with `--auto-file-renaming=false` or force
  with `--allow-overwrite=true`.
- **Resume needs the `.aria2` control file** kept next to the partial download;
  delete it and `-c` can't resume cleanly.
- **No integrity check unless you ask** (`--checksum`/Metalink) — verify big
  downloads with `openssl dgst`.
- **Not a pipe source** — to feed a download into another command, use `curl`.
- **Noisy by default**; in scripts add `--console-log-level=warn
  --summary-interval=0` or `-q`.
- Not preinstalled on macOS — `brew install aria2`.
