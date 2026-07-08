---
name: cyberchef
description: "Decode, deobfuscate, and analyze security artifacts using CyberChef via Node.js. URL decoding, Base64, XOR, PowerShell obfuscation analysis, JavaScript deobfuscation, macro deobfuscation, and IOC cleanup recipes."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# CyberChef JS/Node Workflow

Decode, deobfuscate, and analyze security artifacts using CyberChef through Node.js.

## Common Operations

### URL Decoding
```
Recipe: URL Decode
Input: %68%74%74%70%73%3A%2F%2F
Output: https://
```

### Base64 Decoding
```
Recipe: From Base64
Input: aHR0cHM6Ly9ldmlsLmV4YW1wbGUuY29tL21hbHdhcmU=
```

### Multi-Layer Decoding
```
Recipe: URL Decode -> From Base64 -> From Hex
```

## Analysis Patterns

### Pattern 1: Phishing URL Decoding
```
Recipe: URL Decode -> From Base64 -> Find/Replace (%20->space) -> Extract URLs
```

### Pattern 2: Malicious PowerShell
```
Recipe: From Base64 -> Decode text (UTF-16LE) -> Find/Replace (Remove null bytes)
```
Note: PowerShell Base64 is typically UTF-16LE, not UTF-8.

### Pattern 3: IOC Cleanup
```
Recipe: Find/Replace (hxxp->http, [.]->., hxxps->https)
```

### Pattern 4: Macro Deobfuscation
```
Recipe: Extract strings -> Find/Replace (Chr(->, )->, &->) -> From Charcode
```

## CyberChef CLI Usage
```bash
npx cyberchef --input "base64_string" --recipe "From Base64"
echo "encoded_data" | npx cyberchef --recipe "From Base64,URL Decode"
```

## Node.js Usage
```js
const chef = require('cyberchef');
const result = chef.bake('encoded_input', [
  {op: 'From Base64', args: ['A-Za-z0-9+/=']},
  {op: 'URL Decode', args: []}
]);
```

## Tips
- Use `Magic` operation for auto-detection of unknown encoding.
- Try multiple layers — attackers often nest 3-5 layers.
- After decoding, search output for: IPs, domains, URLs, file paths, registry keys, commands.
