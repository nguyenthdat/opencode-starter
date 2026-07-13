---
name: ssh-socks-proxy
description: "Establish and safely tear down an authorized SSH SOCKS proxy for investigative access through a jump host. Use when an approved internal tool requires proxy routing, or to verify/reconnect a prior tunnel. Uses a dedicated control socket; never tears down tunnels with broad process matching."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# SSH SOCKS Proxy Workflow

Require authorization for the jump host, destination network, and intended investigative traffic. Preserve normal host-key verification.

## Setup

Choose an unused local port and a case-specific control socket:

```bash
SOCKET="${TMPDIR:-/tmp}/secops-socks-CASE123.sock"
ssh -N \
  -D 127.0.0.1:1080 \
  -o ExitOnForwardFailure=yes \
  -o ControlMaster=yes \
  -o ControlPath="$SOCKET" \
  user@jumphost.example.com
```

Run in a managed terminal session or add `-f` only after verifying the forward succeeds. Never bind to `0.0.0.0`.

## Verify

```bash
curl --fail --show-error --socks5-hostname 127.0.0.1:1080 https://internal-tool.example.com/
```

Use `--socks5-hostname` or a `socks5h://` proxy URL when DNS must resolve through the proxy.

## Teardown

Close only the tunnel owned by the control socket:

```bash
ssh -S "$SOCKET" -O exit user@jumphost.example.com
```

Verify that the local port is no longer listening. Never use `pkill`, broad `killall`, or process-pattern matching because it can terminate unrelated SSH sessions.

## Guardrails

- Use approved key or short-lived certificate authentication; never place credentials in commands or artifacts.
- Route only scoped investigation traffic.
- Record jump host, local bind, start/end UTC, owner, purpose, and verification without recording secrets.
- Prefer an existing approved access mechanism over creating a new route.
