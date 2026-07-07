# openssl — crypto, hashing & TLS from the shell (deep cookbook)

A swiss-army knife for digests, HMACs, random bytes, base64, symmetric
encryption, key/cert generation, and inspecting/​debugging TLS. Recipes assume
**OpenSSL 3.x** (Homebrew `openssl`); macOS `/usr/bin/openssl` is **LibreSSL** and
differs — see [Gotchas](#gotchas).

> **Secrets discipline:** keys, passphrases, and tokens must not be hardcoded or
> echoed into shell history / `ps`. Pass passphrases via `-pass pass:"$VAR"` /
> `-passin env:VAR` (not a literal), pull secrets at runtime (Bitwarden CLI), and
> never commit generated `*.key`/`*.pem` private keys.

## Contents
- [Digests & checksums](#digests--checksums)
- [HMAC](#hmac)
- [Random & base64/hex](#random--base64hex)
- [Symmetric encryption (`enc`)](#symmetric-encryption-enc)
- [Password hashing](#password-hashing)
- [Keys & public keys](#keys--public-keys)
- [CSRs & self-signed certs](#csrs--self-signed-certs)
- [Inspecting certs](#inspecting-certs)
- [Debugging live TLS](#debugging-live-tls)
- [Converting formats](#converting-formats)
- [Gotchas](#gotchas)

---

## Digests & checksums

```bash
openssl dgst -sha256 file                     # SHA-256 of a file
openssl sha256 file                            # shorthand
echo -n "hello" | openssl dgst -sha256         # hash a string (note -n: no newline)
openssl dgst -sha1 -r file                     # -r = coreutils-style "HASH  name"
openssl dgst -sha512 *.tar.gz                  # many files at once
```

`-r` makes output look like `sha256sum`. To *verify* a published checksum,
compute and compare (e.g. `[ "$(openssl dgst -sha256 -r f | cut -d' ' -f1)" = "$EXPECTED" ]`).

---

## HMAC

```bash
echo -n "msg" | openssl dgst -sha256 -hmac "secretkey"      # HMAC-SHA256
echo -n "msg" | openssl dgst -sha256 -mac HMAC -macopt key:secretkey  # explicit
# Webhook-style signature, hex, no prefix:
printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2
```

---

## Random & base64/hex

```bash
openssl rand -hex 32           # 32 random bytes as hex (64 chars) — great for tokens
openssl rand -base64 24        # 24 random bytes, base64
openssl rand 16 | xxd -p       # raw bytes → hex via xxd

printf 'hello' | openssl base64                 # encode → aGVsbG8=
echo 'aGVsbG8=' | openssl base64 -d             # decode
openssl base64 -A -in big.bin                    # -A = one line (no 64-col wrap)
```

`openssl rand -hex N` is the cleanest portable secret/token generator on a box
without `uuidgen`/`/dev/urandom` plumbing.

---

## Symmetric encryption (`enc`)

```bash
# Encrypt (AES-256, key derived from passphrase with PBKDF2 — REQUIRED for safety)
openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
  -in secret.txt -out secret.enc -pass pass:"$PASS"

# Decrypt
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in secret.enc -out secret.txt -pass pass:"$PASS"

# ASCII-armored (base64) output, passphrase from an env var
openssl enc -aes-256-cbc -pbkdf2 -a -in f -pass env:PASS
```

> Always pass `-pbkdf2 -iter <high>` (and `-salt`, the default). Legacy
> `openssl enc` without `-pbkdf2` uses a weak MD5-based KDF and is **not** secure
> or interoperable across versions. For file encryption you often want `age` or
> `gpg` instead; use `enc` for quick interop with existing OpenSSL blobs.

---

## Password hashing

```bash
openssl passwd -6 'plaintext'        # SHA-512 crypt ($6$…) for /etc/shadow style
openssl passwd -5 'plaintext'        # SHA-256 crypt ($5$…)
openssl passwd -apr1 'plaintext'     # Apache htpasswd (MD5) format
openssl passwd -6 -salt "$(openssl rand -hex 6)" 'pw'   # explicit salt
```

---

## Keys & public keys

```bash
# Modern keygen via genpkey (preferred)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -out key.pem
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out ec.pem
openssl genpkey -algorithm ED25519 -out ed.pem               # tiny, fast, modern

# Derive the public key
openssl pkey -in key.pem -pubout -out key.pub
openssl pkey -in key.pem -noout -text        # inspect a private key

# Encrypt a private key with a passphrase at rest
openssl genpkey -algorithm RSA -aes-256-cbc -pass pass:"$PASS" -out key.enc.pem
```

---

## CSRs & self-signed certs

```bash
# CSR from an existing key (non-interactive subject)
openssl req -new -key key.pem -out req.csr -subj "/CN=example.com/O=Acme"

# One-shot self-signed cert + key (dev/localhost), with SAN (OpenSSL 3)
openssl req -x509 -newkey rsa:4096 -nodes -days 365 \
  -keyout localhost.key -out localhost.crt \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# Self-signed from an existing key
openssl req -x509 -key key.pem -days 365 -out cert.pem -subj "/CN=localhost"
```

`-nodes` = "no DES" = don't encrypt the private key (fine for throwaway dev
keys; never for production). `-addext subjectAltName=…` is required — modern
clients ignore CN-only certs.

---

## Inspecting certs

```bash
openssl x509 -in cert.pem -noout -text                 # full human-readable dump
openssl x509 -in cert.pem -noout -subject -issuer -dates
openssl x509 -in cert.pem -noout -fingerprint -sha256
openssl x509 -in cert.pem -noout -ext subjectAltName   # just the SANs
openssl req  -in req.csr  -noout -text                 # inspect a CSR
openssl crl  -in list.crl -noout -text                 # inspect a CRL
```

---

## Debugging live TLS

```bash
# Fetch a server's cert and show its validity window + subject/issuer
echo | openssl s_client -connect github.com:443 -servername github.com 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates

# Full chain the server sends
openssl s_client -connect host:443 -servername host -showcerts </dev/null

# Pin/force a protocol or check SNI vhosts
openssl s_client -connect host:443 -tls1_2 </dev/null
openssl s_client -connect 1.2.3.4:443 -servername virtualhost.example </dev/null

# Days until expiry (combine with date math)
echo | openssl s_client -connect host:443 -servername host 2>/dev/null \
  | openssl x509 -noout -enddate
```

`</dev/null` (or `echo |`) closes stdin so `s_client` doesn't hang waiting for
input. `-servername` sets SNI — essential on shared hosts.

---

## Converting formats

```bash
openssl x509 -in cert.pem -outform der -out cert.der          # PEM → DER
openssl x509 -inform der -in cert.der -out cert.pem            # DER → PEM
openssl pkcs12 -export -inkey key.pem -in cert.pem -out bundle.p12   # → PKCS#12
openssl pkcs12 -in bundle.p12 -nodes -out all.pem              # PKCS#12 → PEM

# Confirm a key and cert match (same modulus → same hash)
diff <(openssl x509 -noout -modulus -in cert.pem | openssl md5) \
     <(openssl rsa  -noout -modulus -in key.pem  | openssl md5)
```

---

## Gotchas

- **LibreSSL vs OpenSSL 3:** `/usr/bin/openssl` on macOS is LibreSSL and lacks or
  changes some flags (`-addext`, `enc -pbkdf2 -iter`, `genpkey` options). Prefer
  the Homebrew binary — `/opt/homebrew/bin/openssl` — or call it explicitly. Check
  with `openssl version`.
- **`echo` adds a newline** that changes the hash — use `echo -n` or `printf` when
  hashing/HMACing a string.
- **`enc` needs `-pbkdf2`** to be secure and version-portable; the legacy default
  KDF is broken. Consider `age`/`gpg` for real file encryption.
- **Passphrases on the command line leak** via `ps` and history — prefer
  `-pass env:VAR` / `-passin file:…` over `-pass pass:literal`.
- **`-nodes` leaves keys unencrypted** — acceptable only for disposable dev keys.
- **`s_client` hangs** without `</dev/null`; always close stdin in scripts.
- These are security-critical tools: when in doubt about an algorithm or KDF,
  pick the modern default (AES-256, SHA-256+, Ed25519, PBKDF2 ≥600k iters).
