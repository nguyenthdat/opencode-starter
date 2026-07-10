# ffprobe — inspect media files (deep cookbook)

`ffprobe` (ships with FFmpeg) reads a media file's container and streams and
reports codec, resolution, duration, bitrate, frame rate, channels, etc. — in
JSON/CSV/flat so you can script it. It's the "what is this video?" tool and the
natural partner to `jq`. (FFmpeg 8.x here.)

> **Always pass `-v error` (or `-hide_banner -loglevel error`) in scripts** —
> ffprobe prints a banner + info to stderr by default that pollutes output.

## Contents
- [Clean, scriptable output](#clean-scriptable-output)
- [JSON for jq](#json-for-jq)
- [Single-value queries](#single-value-queries)
- [Useful fields](#useful-fields)
- [Recipes](#recipes)
- [Gotchas](#gotchas)

---

## Clean, scriptable output

```bash
ffprobe -v error -show_format -show_streams f.mp4            # default key=value blocks
ffprobe -v error -of json -show_format -show_streams f.mp4   # JSON
ffprobe -v error -of csv -show_entries stream=...            # CSV row
ffprobe -v error -of flat -show_format f.mp4                 # dotted flat keys
```

Output format is `-of` / `-print_format`: `default`, `json`, `csv`, `flat`,
`xml`, `ini`. Trim wrappers:
- `-of csv=p=0` — drop the leading section name.
- `-of default=nw=1:nk=1` — no wrappers, no keys (bare value).

---

## JSON for jq

```bash
ffprobe -v error -of json -show_format -show_streams f.mp4 | jq '.streams[].codec_name'
ffprobe -v error -of json -show_streams f.mp4 \
  | jq -r '.streams[] | select(.codec_type=="video") | "\(.width)x\(.height) \(.r_frame_rate)"'
ffprobe -v error -of json -show_format f.mkv | jq -r '.format.duration, .format.bit_rate'
```

JSON + jq is the robust path — you get **named** access regardless of field
order (see Gotchas).

---

## Single-value queries

Pinpoint one value for a shell variable:

```bash
# WxH of the first video stream
ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 f.mp4
# duration in seconds (bare number)
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 f.mp4
# codec of the first audio stream
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=nw=1:nk=1 f.mp4
# frame rate as a fraction (e.g. 30000/1001) — divide for real fps
ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 f.mp4
```

`-select_streams v:0` (first video), `a:0` (first audio), `v`/`a` (all of a kind).

---

## Useful fields

| Section / entry | Meaning |
|-----------------|---------|
| `format=duration` | length in seconds |
| `format=bit_rate` / `size` | overall bitrate / file size |
| `format=format_name` | container (mp4, matroska,webm…) |
| `stream=codec_name` / `codec_type` | codec / video\|audio\|subtitle |
| `stream=width,height` | video resolution |
| `stream=r_frame_rate` / `avg_frame_rate` | fps (fraction) |
| `stream=pix_fmt` / `profile` / `level` | pixel format / H.264-5 profile |
| `stream=channels` / `sample_rate` | audio channels / Hz |
| `stream=bit_rate` | per-stream bitrate |
| `stream_tags=language` | track language |

Add `-count_frames -show_entries stream=nb_read_frames` to actually count frames
(decodes — slower but exact for VFR).

---

## Recipes

```bash
# Duration of every video in a tree, "seconds  path"
fd -e mp4 -e mkv -x sh -c 'echo "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$1")  $1"' _ {}

# Tally resolutions across a library
fd -e mp4 -x ffprobe -v error -select_streams v:0 \
   -show_entries stream=width,height -of csv=p=0 {} | sort | uniq -c | sort -rn

# Total seconds of a folder of clips (probe → awk sum)
fd -e mp4 -x ffprobe -v error -show_entries format=duration -of csv=p=0 {} \
  | awk '{s+=$1} END{printf "%.1f min\n", s/60}'

# Flag files missing an audio stream
fd -e mp4 -x sh -c 'ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$1" | grep -q . || echo "NO AUDIO: $1"' _ {}
```

---

## Gotchas

- **Field order in `csv`/`flat` is ffprobe's internal order, NOT the order you
  list in `-show_entries`.** Don't positionally parse csv assuming your order;
  use `-of json | jq` for named access when it matters.
- **`-v error` is mandatory for scripts** — otherwise the banner/info on stderr
  (and sometimes stdout) corrupts parsing.
- **`r_frame_rate` is a rational** like `30000/1001`; compute fps with
  `awk -F/ '{print $1/$2}'`.
- **Duration can be absent** in some containers/streams (live, fragmented). Fall
  back to `format=duration`, another stream, or `-count_frames`.
- ffprobe only **reads**; to change anything use `ffmpeg` (`references/ffmpeg.md`).
- Same binary family as ffmpeg — if `ffmpeg` is broken on this machine (dyld
  "Library not loaded"), so is the same-prefix `ffprobe`; use the Homebrew one.
