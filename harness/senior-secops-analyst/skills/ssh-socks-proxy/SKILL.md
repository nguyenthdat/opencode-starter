---
name: ssh-socks-proxy
description: "Establish SSH SOCKS proxy for routing investigative tools through a jump host to internal networks. Covers setup, teardown, tool configuration (curl, httpx, browser), multi-hop, and security considerations."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# SSH SOCKS Proxy Workflow

Establish an SSH SOCKS proxy to route investigative tools through a jump host or internal network.

## Setup

```bash
ssh -D 1080 -f -C -q -N user@jumphost.example.com
```
- `-D 1080`: SOCKS proxy on local port 1080
- `-f`: Background
- `-C`: Compress
- `-q`: Quiet
- `-N`: No remote command

## Verify
```bash
curl --socks5 localhost:1080 https://internal-tool.example.com
```

## Teardown
```bash
pkill -f "ssh -D 1080"
```

## Tool Configuration

### curl
```bash
curl --socks5 localhost:1080 <URL>
```

### Python (httpx)
```python
client = httpx.Client(proxy="socks5://localhost:1080")
```

### Browser (Playwright / CloakBrowser)
```javascript
const browser = await chromium.launch({
  proxy: { server: 'socks5://localhost:1080' }
});
```

### SSH with ProxyJump
```bash
ssh -J user@jumphost user@internal-host
```

## Security
- Bind to localhost only (never 0.0.0.0).
- Close proxy when investigation complete.
- Use SSH key auth, not passwords.
- Route only investigation traffic through proxy.

## Fallback
- `sshuttle` for VPN-like routing.
- `kubectl port-forward` for Kubernetes-hosted tools.
- Cloud-native: AWS SSM Port Forwarding, Azure Bastion, GCP IAP.
