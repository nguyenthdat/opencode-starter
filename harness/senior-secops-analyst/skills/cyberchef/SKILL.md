---
name: cyberchef
description: "Decode and deobfuscate security artifacts with a verified CyberChef installation or equivalent local decoder. Use for URL/Base64/hex/XOR/PowerShell/JavaScript/macro decoding, IOC cleanup, rerun with a saved recipe, or compare decoded layers. Never execute decoded content; keep indicators defanged by default."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# CyberChef Decoding Workflow

Decode hostile content as data. Never execute decoded scripts, macros, commands, documents, or binaries.

## Preflight

1. Verify the installed CyberChef package, CLI, or API from its actual help/version output before writing commands. Package interfaces vary; do not assume `npx cyberchef` or `require('cyberchef')` exists.
2. Hash the input and assign an evidence ID.
3. Set size and recursion limits to avoid decompression or decoding loops.

## Workflow

1. Start with the minimum likely operation, such as URL Decode, From Base64, From Hex, or Decode Text UTF-16LE.
2. Save every exact recipe and tool version.
3. Inspect each layer before applying another transform.
4. Extract IOCs, file paths, registry keys, and commands as inert text.
5. Keep indicators defanged in human-readable output. Refang only into an approved machine-action artifact.
6. Save output under `_workspace/derived/`, compute its hash, and register parent evidence IDs with `evidence-collection`.

## Common Recipes

```text
URL Decode
From Base64 -> Decode text (UTF-16LE)
URL Decode -> From Base64 -> From Hex
Extract strings -> From Charcode
```

`Magic` may suggest transforms, but validate suggestions before accepting them as analysis.

## Output

Include input evidence ID/hash, exact recipe, tool/version, output hash/path, extracted indicators, decoding confidence, failed transforms, and safety limits used.
