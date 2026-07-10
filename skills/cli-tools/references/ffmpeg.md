# ffmpeg — convert & process audio/video/images (deep cookbook)

The universal media transcoder: re-encode, resize, trim, extract frames/audio,
convert images, make GIFs, concat, overlay, burn subtitles. It's enormous; this
covers the correct, common invocations and the argument-ordering rules that trip
everyone up. (FFmpeg 8.x here.) Inspect first with `ffprobe`
(`references/ffprobe.md`).

## Contents
- [Invocation shape (read this)](#invocation-shape-read-this)
- [Transcode & resize video](#transcode--resize-video)
- [Trim / cut](#trim--cut)
- [Frames & thumbnails](#frames--thumbnails)
- [Audio](#audio)
- [Images](#images)
- [Animated GIF](#animated-gif)
- [Concatenate, overlay, subtitles](#concatenate-overlay-subtitles)
- [Recipes (with fd/parallel)](#recipes-with-fdparallel)
- [Gotchas](#gotchas)

---

## Invocation shape (read this)

```
ffmpeg [global opts] [input opts] -i INPUT [more -i ...] [output opts] OUTPUT
```

- **Output file is LAST.** Per-stream output options (`-c:v`, `-b:a`, `-vf`)
  attach to the output that follows them.
- `-y` overwrite without asking · `-n` skip if exists.
- Quiet for scripts: `-hide_banner -loglevel error -stats`. Add **`-nostdin`**
  when running inside `while read`/`xargs`/loops so ffmpeg doesn't swallow stdin.
- **Seek placement matters:** `-ss` *before* `-i` = fast (jumps by keyframe);
  `-ss` *after* `-i` = frame-accurate (decodes from start, slower).

---

## Transcode & resize video

```bash
ffmpeg -i in.mov -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k out.mp4
ffmpeg -i in.mp4 -c:v libx265 -crf 28 -c:a copy out.mkv          # H.265: smaller files
ffmpeg -i in.mp4 -vf "scale=1280:-2" out.mp4                      # width 1280, keep aspect (even h)
ffmpeg -i in.mp4 -vf "scale=-2:720" out.mp4                       # 720p
ffmpeg -i in.mp4 -r 30 out.mp4                                    # force 30 fps
ffmpeg -i in.mp4 -an out.mp4                                      # drop audio (-vn drops video)
```

`-crf` = quality (lower is better/bigger; ~18–28 for x264, ~24–30 for x265).
`-preset` trades encode speed for size (`ultrafast`…`veryslow`). macOS hardware
encode: `-c:v h264_videotoolbox` / `hevc_videotoolbox` (fast, less precise rate
control).

---

## Trim / cut

```bash
# FAST, lossless — copies streams, cuts on the nearest keyframe
ffmpeg -ss 00:01:00 -to 00:02:00 -i in.mp4 -c copy clip.mp4
ffmpeg -ss 60 -t 30 -i in.mp4 -c copy clip.mp4                   # start 60s, length 30s

# Frame-ACCURATE — re-encodes (use when keyframe cut is too coarse)
ffmpeg -ss 00:01:00 -i in.mp4 -t 30 -c:v libx264 -crf 20 clip.mp4
```

`-t` = duration, `-to` = end timestamp. With `-c copy` the cut snaps to
keyframes; re-encode for exact boundaries.

---

## Frames & thumbnails

```bash
ffmpeg -ss 5 -i in.mp4 -frames:v 1 -q:v 2 thumb.jpg              # single frame at 5s
ffmpeg -i in.mp4 -vf fps=1 frame_%04d.png                        # one frame per second
ffmpeg -i in.mp4 -vf "fps=1/10" shot_%03d.jpg                    # one every 10s
ffmpeg -i in.mp4 -vf "select=eq(pict_type\,I)" -vsync vfr key_%03d.png  # keyframes only
ffmpeg -i in.mp4 -vf "thumbnail" -frames:v 1 best.png            # representative thumb
```

---

## Audio

```bash
ffmpeg -i in.mp4 -vn -c:a libmp3lame -q:a 2 out.mp3             # extract → MP3 (VBR ~190k)
ffmpeg -i in.mp4 -vn -c:a copy out.m4a                          # extract AAC without re-encode
ffmpeg -i in.wav -c:a aac -b:a 192k out.m4a                     # WAV → AAC
ffmpeg -i in.mp3 -ac 1 -ar 16000 out.wav                        # mono 16 kHz (speech/ASR)
ffmpeg -i in.flac -af "loudnorm" out.flac                       # loudness-normalize
```

---

## Images

```bash
ffmpeg -i in.png out.jpg                                         # convert format
ffmpeg -i in.heic out.jpg                                       # HEIC → JPG
ffmpeg -i in.jpg -vf "scale=800:-1" small.jpg                   # resize to width 800
ffmpeg -i in.png -vf "scale=-1:512" out.webp                    # → WebP, height 512
ffmpeg -i in.jpg -q:v 2 out.jpg                                 # re-encode JPEG quality (2=high)
```

For bulk image work `ffmpeg` is fine, but dedicated tools (ImageMagick `magick`)
have richer image ops; `ffmpeg` shines when frames come from video.

---

## Animated GIF

A two-pass palette gives far better quality than a naive GIF:

```bash
ffmpeg -i in.mp4 -vf "fps=12,scale=480:-1:flags=lanczos,palettegen" palette.png
ffmpeg -i in.mp4 -i palette.png \
  -lavfi "fps=12,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse" out.gif
# quick & dirty (lower quality, one pass):
ffmpeg -ss 3 -t 4 -i in.mp4 -vf "fps=12,scale=480:-1:flags=lanczos" out.gif
```

---

## Concatenate, overlay, subtitles

```bash
# Concat files with the SAME codec/params (no re-encode) via the concat demuxer
printf "file '%s'\n" clip1.mp4 clip2.mp4 > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy joined.mp4

# Overlay a logo top-left
ffmpeg -i in.mp4 -i logo.png -filter_complex "overlay=10:10" out.mp4

# Burn subtitles into the picture / add soft subs
ffmpeg -i in.mp4 -vf "subtitles=subs.srt" burned.mp4
ffmpeg -i in.mp4 -i subs.srt -c copy -c:s mov_text soft.mp4
```

---

## Recipes (with fd/parallel)

```bash
fd -e mov | parallel -j4 ffmpeg -nostdin -i {} -c:v libx264 -crf 23 {.}.mp4   # batch transcode
fd -e wav | parallel ffmpeg -nostdin -i {} -c:a libmp3lame -q:a 2 {.}.mp3      # batch to MP3
fd -e png | parallel ffmpeg -nostdin -i {} {.}.webp                            # batch image convert
fd -e mp4 -x ffmpeg -nostdin -ss 2 -i {} -frames:v 1 {.}.jpg                    # thumbnail each video
```

`-nostdin` is important in these loops so ffmpeg doesn't consume the list feeding
`parallel`/`xargs`.

---

## Gotchas

- **`-ss` before vs after `-i`:** before = fast keyframe seek; after = accurate
  but decodes from the start. Put it before for thumbnails, after (or re-encode)
  for exact cuts.
- **`-c copy` cuts only on keyframes** — fast and lossless but boundaries may be
  off by a fraction of a second; re-encode for frame accuracy.
- **`scale=…:-2` keeps aspect AND even dimensions** (H.264/`yuv420p` require even
  width/height); `-1` can yield an odd number and fail. Prefer `-2`.
- **Output last; options bind to the next output.** `-c:v libx264` placed after
  `-i` but before the filename applies to that output.
- **Use `-nostdin` in loops/pipelines**, or ffmpeg eats the stdin that feeds
  `while read`/`xargs`/`parallel` and the loop ends early.
- **Scripts: `-y` + `-loglevel error`** to avoid the interactive overwrite prompt
  and the verbose banner.
- **This machine:** the `ffmpeg` first on `PATH` is a zerobrew build with a broken
  link (`dyld: Library not loaded: …libvmaf…`). Use the Homebrew binary
  (`/opt/homebrew/bin/ffmpeg`) or fix/reinstall; same applies to `ffprobe`.
