# exiftool — metadata & true file-type detection (deep cookbook)

`exiftool` reads, writes, and strips metadata (EXIF, IPTC, XMP, GPS, maker
notes, PDF/Office/audio/video tags) across thousands of formats, and — because
it reads **magic bytes, not the extension** — it's the most reliable "what is
this file *really*?" tool. (ExifTool 13.x here.)

## Contents
- [Reading metadata](#reading-metadata)
- [True file-type detection](#true-file-type-detection)
- [Output formats (json/csv/tab/value)](#output-formats-jsoncsvtabvalue)
- [Selecting & filtering with `-if`](#selecting--filtering-with--if)
- [Writing & editing tags](#writing--editing-tags)
- [Stripping metadata (privacy)](#stripping-metadata-privacy)
- [Batch, rename, sort by date](#batch-rename-sort-by-date)
- [Recipes](#recipes)
- [Gotchas](#gotchas)

---

## Reading metadata

```bash
exiftool photo.jpg                 # every tag, friendly names
exiftool -s -G photo.jpg           # show tag IDs (-s), grouped by family (-G)
exiftool -a -u -g1 photo.jpg       # all dupes (-a), unknown (-u), grouped by g1
exiftool -Make -Model -LensModel -FNumber -ISO photo.jpg   # specific tags
exiftool -common photo.jpg         # a curated "common" subset
exiftool -G -time:all photo.jpg    # just the date/time tags
```

Group families: `0` = source (EXIF/IPTC/XMP/File), `1` = specific (IFD0, GPS…),
`2` = category (Time, GPS, Author, Image). `-G1`, `-G2` pick which to show.

---

## True file-type detection

exiftool identifies content regardless of a wrong/missing extension:

```bash
exiftool -FileType -FileTypeExtension -MIMEType file        # what it actually is
exiftool -FileType -MIMEType mystery.bin
# A PNG renamed to .txt still reports FileType: PNG, MIMEType: image/png
```

Find mislabeled or specific files by real type:

```bash
exiftool -r -if '$MIMEType =~ /^video/' -FileName -MIMEType dir/    # real videos, any ext
exiftool -r -if '$FileType eq "PNG"' -FileName dir/                  # actual PNGs
```

---

## Output formats (json/csv/tab/value)

```bash
exiftool -json photo.jpg                       # JSON array → pipe to jq
exiftool -json -r dir | jq -r '.[].MIMEType' | sort | uniq -c    # type histogram
exiftool -csv -Make -Model -ISO *.jpg          # CSV table (header row)
exiftool -T -FileName -ImageSize -MIMEType *.jpg   # tab-separated, no labels
exiftool -s3 -GPSPosition photo.jpg            # -s3 = value only (no tag name)
exiftool -p '$FileName: $ImageSize' *.jpg      # custom template line
```

---

## Selecting & filtering with `-if`

`-if 'COND'` uses Perl with `$TagName`; combine multiple `-if` (AND) and `-r` to
recurse:

```bash
exiftool -r -if '$ImageWidth > 4000' -FileName -ImageSize ~/Pictures   # big photos
exiftool -r -if '$ISO > 1600' -FileName -ISO ~/Pictures                # high-ISO shots
exiftool -if '$GPSLatitude' -FileName -GPSPosition *.jpg                # only geotagged
exiftool -r -ext jpg -ext heic -Model dir/                             # restrict by ext (-ext)
```

---

## Writing & editing tags

```bash
exiftool -Artist="Jane Doe" -Copyright="(c) 2026" photo.jpg
exiftool -Keywords+=sunset -Keywords+=beach photo.jpg     # += append to a list (-= removes)
exiftool -XMP:Title="Cover" -IPTC:By-line="Jane" photo.jpg # target a specific group
exiftool "-AllDates+=0:0:0 1:0:0" *.jpg                    # shift all dates +1 hour (Y:M:D H:M:S)
exiftool "-AllDates-=0:0:1 0:0:0" *.jpg                    # subtract 1 day
exiftool -tagsFromFile src.jpg -all:all dst.jpg            # copy all metadata between files
```

> **Writing creates a `*_original` backup by default.** Add
> `-overwrite_original` to edit in place (or `-overwrite_original_in_place` to
> preserve timestamps). Clean up stray backups with `exiftool -delete_original`
> (or restore with `-restore_original`).

---

## Stripping metadata (privacy)

```bash
exiftool -all= photo.jpg                                  # remove ALL metadata
exiftool -all= -overwrite_original -r dir/                # recursive strip, no backups
exiftool -gps:all= photo.jpg                              # remove only GPS
exiftool -overwrite_original -CommonIFD0= -Photoshop:all= photo.jpg
exiftool -all= -tagsfromfile @ -Orientation photo.jpg     # strip but KEEP orientation
```

---

## Batch, rename, sort by date

```bash
# Rename by capture date (%%e = original extension)
exiftool '-FileName<DateTimeOriginal' -d '%Y%m%d_%H%M%S.%%e' *.jpg
# File into Year/Month folders by date taken
exiftool '-Directory<DateTimeOriginal' -d '%Y/%m' ~/Pictures
# Use FileModifyDate as fallback when no EXIF date
exiftool '-FileName<FileModifyDate' '-FileName<DateTimeOriginal' -d '%Y%m%d_%H%M%S.%%e' .
# Batch-edit from a CSV (first column = SourceFile)
exiftool -csv=edits.csv dir/
```

Later `<` assignments win when present, so list the preferred source last.

---

## Recipes

```bash
# MIME-type inventory of a tree, as a table
exiftool -json -r ~/Downloads | jq -r '.[] | [.MIMEType // "?", .SourceFile] | @tsv' | sort

# Parallel-strip metadata from every JPEG (privacy scrub)
fd -e jpg | parallel exiftool -overwrite_original -all= {}

# Cross-check: files whose extension lies about their type
fd -e txt -x sh -c 'echo "$(exiftool -s3 -FileType "$1")  $1"' _ {} | rg -v '^TXT'

# Pull GPS from photos into CSV
exiftool -n -csv -GPSLatitude -GPSLongitude -DateTimeOriginal -r ~/Pictures > geo.csv
```

---

## Gotchas

- **Backups by default.** Every write leaves `file_original`; use
  `-overwrite_original` unless you want them. They pile up fast in batch runs.
- **Detection is content-based** (magic bytes) — more trustworthy than the
  extension or `file(1)` for many formats; ideal for spotting mislabeled files.
- **Tag names are exact** (case-insensitive but must exist). Discover them with
  `-s`/`-G`; the same logical date may be `DateTimeOriginal`, `CreateDate`, or
  `FileModifyDate` depending on the file.
- **`-d` is the date format** (strftime); in `<`-renames `%%e` is the original
  extension and later `<` rules override earlier ones.
- **`-n`** disables "print conversion" → raw numeric values (e.g. GPS as decimals,
  good for CSV/jq).
- **Some formats can't hold all tags** (e.g. writing EXIF into PNG differs); add
  `-m` to ignore minor warnings.
- **Quote arguments with spaces/`+`/`<`** (`"-AllDates+=0:0:0 1:0:0"`,
  `'-FileName<CreateDate'`) so the shell doesn't mangle them.
- Cross-platform (Perl) — identical behavior on macOS and Linux.
