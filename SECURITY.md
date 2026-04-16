# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | ✅ Active  |
| 0.1.x   | ⚠️ Critical fixes only |
| < 0.1.0 | ❌ No longer supported |

---

## Security Model

LLM Wallet is a **local-first** credential manager. Understanding its security model helps set the right expectations:

- **All data stays on your machine.** Credentials are stored in `~/.llm-wallet/wallet.json` — a plain JSON file on your local filesystem. Nothing is transmitted to any remote server by this application.
- **No encryption at rest.** API keys are stored in plaintext in `wallet.json`. The security of your credentials depends entirely on the security of your local user account and filesystem permissions.
- **Network requests are user-initiated.** The app and CLI only make outbound HTTP requests when you explicitly trigger a connectivity test, chat session, model discovery, or `.env` export. No background sync or telemetry occurs.
- **The desktop app uses Tauri 2.** The Rust backend handles all file I/O and outbound HTTP (via `reqwest`). The WebView frontend has no direct filesystem access.

### What this tool does NOT protect against

- A compromised local user account with read access to `~/.llm-wallet/wallet.json`
- Malicious processes running under the same user on your machine
- Backup systems or cloud sync tools (e.g. iCloud, Dropbox) that may upload `wallet.json` to a remote location

### Recommended practices

- Set restrictive file permissions on your wallet: `chmod 600 ~/.llm-wallet/wallet.json`
- Exclude `~/.llm-wallet/` from any cloud sync or backup service that stores data remotely
- Rotate API keys promptly if you suspect your machine has been compromised
- Use the expiry tracking feature to set reminders for key rotation

---

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please **do not open a public GitHub issue**.

Instead, report it privately via one of these channels:

- **GitHub private vulnerability reporting** — use the [Security tab](https://github.com/cwang0126/a-simple-llm-wallet/security/advisories/new) on this repository (recommended)
- **Email** — contact the maintainer directly via the email listed on the [GitHub profile](https://github.com/cwang0126)

### What to include

A useful report includes:

1. A clear description of the vulnerability and its potential impact
2. Steps to reproduce or a proof-of-concept
3. The version(s) affected
4. Any suggested fix or mitigation, if you have one

### Response timeline

| Stage | Target |
|-------|--------|
| Acknowledgement | Within 48 hours |
| Initial assessment | Within 5 business days |
| Fix or mitigation | Depends on severity — critical issues are prioritised |
| Public disclosure | Coordinated with the reporter after a fix is available |

---

## Scope

The following are **in scope** for security reports:

- Unintended exfiltration of credentials or wallet data
- Path traversal or arbitrary file read/write via CLI arguments or the desktop app
- Injection vulnerabilities in the Tauri IPC layer
- Dependency vulnerabilities with a realistic exploit path in this application's context

The following are **out of scope**:

- Vulnerabilities in third-party LLM provider APIs (report those to the respective provider)
- Issues that require physical access to an already-compromised machine
- Social engineering attacks
- The fact that `wallet.json` is not encrypted (this is a known, documented design decision)

---

## Dependencies

This project uses the following dependency ecosystems. Known vulnerabilities in dependencies can be checked with:

```bash
# CLI (Node.js)
npm audit

# Desktop app frontend
cd app && npm audit

# Desktop app backend (Rust)
cd app/src-tauri && cargo audit
```

`cargo-audit` can be installed with `cargo install cargo-audit` if not already present.

---

## Disclosure Policy

This project follows **coordinated disclosure**. We ask that you give us a reasonable window to address a reported issue before publishing details publicly. We will credit reporters in the release notes unless they prefer to remain anonymous.
