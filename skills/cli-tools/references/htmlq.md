# htmlq — extract from HTML (deep cookbook)

`htmlq` is "`jq`, but for HTML": it runs **CSS selectors** over an HTML document
and prints the matching fragments. It reads stdin (or `-f FILE`) and writes to
stdout (or `-o FILE`), so it slots straight into a `curl | htmlq | …` pipe.

By default it prints the matched HTML. Use `-t` for text, `-a` for an attribute.

## Contents
- [Flags](#flags)
- [Selector syntax](#selector-syntax)
- [Recipes](#recipes)
- [Composition](#composition)
- [Gotchas](#gotchas)

---

## Flags

| Flag | Effect |
|------|--------|
| `-t, --text` | output only the text inside selected elements (strips tags) |
| `-a, --attribute <name>` | print just that attribute's value from each match |
| `-p, --pretty` | pretty-print the serialized HTML |
| `-w, --ignore-whitespace` | skip text nodes that are only whitespace |
| `-r, --remove-nodes <sel>` | delete matching nodes before output (repeatable) |
| `-b, --base <url>` | resolve relative links against this base URL |
| `-B, --detect-base` | read `<base>` from the document (falls back to `-b`) |
| `-f, --filename <file>` | input file (default: stdin) |
| `-o, --output <file>` | output file (default: stdout) |

The positional argument is the selector; it defaults to `html` (the whole doc).

---

## Selector syntax

Standard CSS selectors:

| Selector | Matches |
|----------|---------|
| `tag` | every `<tag>` |
| `#id` | element with that id |
| `.class` | elements with that class |
| `a[href]` | `<a>` that has an `href` |
| `a[href^="https"]` | href starts with `https` |
| `a[href$=".pdf"]` | href ends with `.pdf` |
| `nav a` | `<a>` anywhere inside `<nav>` (descendant) |
| `ul > li` | direct-child `<li>` of `<ul>` |
| `table tr td:first-child` | first cell of each row |

---

## Recipes

```bash
# Element by id (prints the HTML subtree)
curl -s "$URL" | htmlq '#get-help'

# Just the visible text of all <h1>
curl -s "$URL" | htmlq -t 'h1'

# Every link target on a page
curl -s "$URL" | htmlq -a href a

# Absolute links (resolve relative hrefs against the page URL)
curl -s "$URL" | htmlq -b "$URL" -a href a

# All <img> sources
curl -s "$URL" | htmlq -a src img

# Strip a noisy node, then pretty-print what's left
curl -s "$URL" | htmlq '.content' -r svg -r '.ads' -p

# Read from a local file instead of stdin
htmlq -f page.html -t 'title'

# Table column → one value per line
curl -s "$URL" | htmlq -t 'table tr td:nth-child(2)'
```

---

## Composition

```bash
# Scrape a price, strip non-numeric chars, done
curl -s "$URL" | htmlq -t '.price' | sd '[^0-9.]' ''

# Collect + dedupe outbound links
curl -s "$URL" | htmlq -a href 'a[href^="http"]' | sort -u

# Feed extracted rows into a CSV via qsv
curl -s "$URL" | htmlq -t 'table tr td' | paste -d, - - - | qsv table -

# Syntax-highlight a fragment with bat
curl -s "$URL" | htmlq 'body' | bat --language html
```

---

## Gotchas

- **It needs real HTML on stdin**, not a URL — pair it with `curl -s`/`curl -fsSL`.
- `-t` collapses to text but keeps the document's own whitespace/newlines; add
  `-w` to drop whitespace-only nodes, and post-process with `sd '\s+' ' '` if
  you want it on one line.
- Relative links stay relative unless you pass `-b <url>` (or `-B` when the page
  has a `<base>` tag).
- A selector that matches nothing prints nothing and still exits 0 — check for
  empty output rather than relying on the exit code.
- It parses HTML leniently (like a browser); malformed markup usually still
  yields sensible matches.
- Cross-platform: identical behavior on macOS and Linux.
