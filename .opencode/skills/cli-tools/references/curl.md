# curl — HTTP from the shell (deep cookbook)

The universal HTTP client: fetch, download, hit APIs, debug TLS. The single most
important habit is the **scripting quartet** `-fsSL`.

```bash
curl -fsSL "$URL"     # -f fail on HTTP≥400, -s silent, -S still show errors, -L follow redirects
```

## Contents
- [Core flags](#core-flags)
- [GET, query strings, downloads](#get-query-strings-downloads)
- [Headers & auth](#headers--auth)
- [POST / PUT bodies & forms](#post--put-bodies--forms)
- [Inspect, time, debug](#inspect-time-debug)
- [Reliability](#reliability)
- [Gotchas](#gotchas)

---

## Core flags

| Flag | Meaning |
|------|---------|
| `-f` | fail (non-zero exit) on HTTP errors — **use in every script** |
| `-s` / `-S` | silent / but still print errors |
| `-L` | follow redirects (`--max-redirs N` to cap) |
| `-o FILE` / `-O` | write to FILE / to the remote filename |
| `-H 'H: v'` | add a request header (repeatable) |
| `-X METHOD` | set the HTTP method |
| `-d` / `--data-urlencode` | request body / URL-encoded field |
| `-G` | send `-d` data as a GET query string |
| `-w FMT` | print selected metrics after transfer |
| `-I` | HEAD request (headers only) |
| `-k` | **insecure** — skip TLS verification (avoid; debug only) |

---

## GET, query strings, downloads

```bash
curl -fsSL "$API/users" | jq .                       # JSON → jq
curl -fsSL -o data.tgz "$URL"                         # save to a name
curl -fsSLO "$URL"                                    # save as remote filename
curl -fsSL -G "$API/search" \
  --data-urlencode "q=hello world" \
  --data-urlencode "limit=10"                         # safe query encoding
curl -fsSL --compressed "$URL"                        # ask for gzip, auto-decode
curl -fsSL -Z -O "$U1" -O "$U2"                       # -Z = parallel downloads
```

`--data-urlencode` is the right way to build query params — it escapes spaces,
`&`, `=` for you instead of you hand-encoding.

---

## Headers & auth

```bash
curl -fsSL -H "Authorization: Bearer $TOK" "$API/me"
curl -fsSL -u "user:$PASS" "$API"                     # HTTP basic auth
curl -fsSL -H "Accept: application/json" "$API"
curl -fsSL -A 'my-agent/1.0' -e 'https://ref' "$URL"  # User-Agent + Referer
curl -fsSL -b cookies.txt -c cookies.txt "$URL"       # read & save cookies
```

> Pull tokens at runtime (env var or the Bitwarden CLI — see that skill), never
> hardcode them in a script. A header with a secret can leak via `ps`, shell
> history, and `-v` output.

---

## POST / PUT bodies & forms

```bash
# JSON body (classic)
curl -fsSL -X POST "$API/items" \
  -H 'Content-Type: application/json' \
  -d '{"name":"x","qty":2}'

# JSON shorthand (curl ≥7.82): sets method+content-type+accept
curl -fsSL --json '{"name":"x"}' "$API/items"

# Body from a file or stdin (@- = stdin)
curl -fsSL -X POST "$API" -H 'Content-Type: application/json' -d @payload.json
jq -n '{ts:now}' | curl -fsSL --json @- "$API/events"

# Form-encoded vs multipart upload
curl -fsSL -d 'a=1&b=2' "$API/form"                   # application/x-www-form-urlencoded
curl -fsSL -F file=@photo.jpg -F 'caption=hi' "$API/upload"   # multipart/form-data
```

---

## Inspect, time, debug

```bash
curl -fsSLI "$URL"                                    # headers only (HEAD)
curl -fsSL -D - -o /dev/null "$URL"                   # dump response headers, drop body
curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' "$URL"   # status + timing
curl -fsSL -w '%{url_effective}\n' -o /dev/null "$URL"           # final URL after redirects
curl -v "$URL" 2>&1 | rg '^[<>]'                      # request/response lines
```

Useful `-w` variables: `%{http_code}`, `%{time_total}`, `%{time_namelookup}`,
`%{time_connect}`, `%{time_starttransfer}`, `%{size_download}`,
`%{num_redirects}`, `%{url_effective}`.

---

## Reliability

```bash
curl -fsSL --retry 3 --retry-delay 2 --retry-all-errors "$URL"
curl -fsSL --connect-timeout 5 --max-time 30 "$URL"
curl -fsSL --resolve api.local:443:127.0.0.1 "https://api.local/health"  # fake DNS
```

`curl -fsSL URL | sh` is the canonical installer pattern — `-f` is what stops a
404 error page from being piped into your shell.

---

## Gotchas

- **`-f` hides the body on error.** Great for scripts (you get a non-zero exit),
  but when debugging an API error you want the body — drop `-f` and read it, or
  add `-w '%{http_code}'`.
- **Quote the URL** if it contains `&`, `?`, `*` — otherwise the shell mangles it.
- **`-d` implies POST** and `Content-Type: application/x-www-form-urlencoded`;
  override with `-H` or use `--json` for JSON.
- **`-d` strips newlines**; use `--data-binary @file` to send a file verbatim.
- **`-k` disables TLS verification** — never in production; for a self-signed dev
  cert prefer `--cacert ca.pem`.
- macOS curl is full-featured (built against LibreSSL/Secure Transport); the
  flags above are portable to Linux curl.
