# DEBUG.md

This document provides solutions for common issues encountered when setting up the Rust environment and building the application, specifically regarding **Tauri CLI** installation and **crates.io** network timeouts.

---

## 1. Command Not Found (Environment Issues)
If you have just installed Rust and the `cargo` or `rustc` commands are not recognized, your current shell session needs to be updated to include the Cargo binary directory.

### **Fix**
Run the following command to source the environment variables:
```bash
. "$HOME/.cargo/env"
```
*Note: For Windows (PowerShell), use `. "$HOME/.cargo/env.ps1"`.*

---

## 2. Network Timeouts (`[28] Timeout was reached`)
If the build or installation fails while downloading crates with an error stating the operation was "too slow" or "timed out," use one of the following methods.

### **Method A: Use a Registry Mirror (Recommended)**
Configuring a mirror can significantly speed up downloads if the default `crates.io` servers are slow or throttled in your region.

1. Open (or create) the Cargo configuration file:
   ```bash
   nano ~/.cargo/config.toml
   ```
2. Add the following configuration:
   ```toml
   [source.crates-io]
   # Change this from 'rsproxy' to 'rsproxy-sparse'
   replace-with = 'rsproxy-sparse'

   [source.rsproxy-sparse]
   registry = "sparse+https://rsproxy.cn/index/"

   [net]
   # Keeps the connection stable and retries on minor drops
   git-fetch-with-cli = true
   retry = 10
   ```

### **Method B: Increase Timeout Thresholds**
If you do not want to use a mirror, you can force Cargo to be more patient with slow connections by setting environment variables before running your build/install command:

```bash
export CARGO_HTTP_TIMEOUT=300
export CARGO_NET_RETRY=10
cargo install tauri-cli
```

---

## 3. Proxy Configuration
If you are working behind a corporate firewall or proxy, Cargo may fail to connect to the internet.

### **Fix**
Set your proxy environment variables in your terminal:
```bash
export http_proxy=http://your-proxy-address:port
export https_proxy=http://your-proxy-address:port
```

---

## 4. Re-installing Tauri CLI
If the initial installation was interrupted, clear the partial installation and try again:

```bash
# Ensure env is sourced
. "$HOME/.cargo/env"

# Re-attempt install with increased timeout
CARGO_HTTP_TIMEOUT=300 cargo install tauri-cli
```