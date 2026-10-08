<p align="center">
  <img src="assets/banner.svg" alt="action-state-watch banner" width="100%" />
</p>

# action-state-watch

[![CI](https://github.com/stellar-archival-labs/action-state-watch/actions/workflows/ci.yml/badge.svg)](https://github.com/stellar-archival-labs/action-state-watch/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

📖 **[Documentation](https://soroban-state-sentinel.gitbook.io/action-state-watch/)**

Scheduled TTL/archival health monitor for deployed Soroban contracts.

This GitHub Action runs on a cron schedule to monitor the health of Soroban smart contracts on the Stellar network. It checks contract state archival status and sends alerts via Slack, Discord, or GitHub Issues before contracts are archived.

## What It Does

On a cron schedule (not on pull requests), this action:

1. **Reads** contract addresses from a `contracts.yml` config file
2. **Scans** each contract using the `soroban-state-sentinel` CLI
3. **Classifies** health bands: `Healthy`, `ExpiringSoon`, `Critical`, `Archived`
4. **Alerts** via Slack, Discord, or GitHub Issues with severity-formatted messages
5. **Deduplicates** GitHub Issues per contract address
6. **Auto-closes** issues when contracts recover to Healthy
7. **Uploads** unsigned restore XDR as workflow artifacts (never signs or submits)

## Quick Start

### 1. Create `contracts.yml`

```yaml
network: testnet

contracts:
  - address: 'CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4'
    label: 'my-contract'
    keys: ['<padded SCVal XDR for your key>']
    healthy-days: 30
    critical-days: 7

alert:
  dedupe-window-hours: 24
```

### 2. Create the workflow

```yaml
name: Contract Health Monitor

on:
  schedule:
    # Run every 6 hours
    - cron: '0 */6 * * *'
  workflow_dispatch:

permissions:
  contents: read
  issues: write   # required by the github-token alert channel

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4   # so the action can read your contracts.yml

      - uses: stellar-archival-labs/action-state-watch@v0.1.0
        with:
          # Install the sentinel from its GitHub release (downloaded and
          # sha256-verified against the published .sha256 before it is run).
          sentinel-cli-path: 'install'
          sentinel-version: 'v0.1.0'
          config-path: 'contracts.yml'
          rpc-url: 'https://soroban-testnet.stellar.org'
          # Fail the run when a contract is Critical/Archived. Set to 'false' to
          # only alert (e.g. for a deliberately-decaying demo fixture).
          fail-on-critical: 'true'
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          # Or discord-webhook-url: ${{ secrets.DISCORD_WEBHOOK_URL }}
          # Or github-token: ${{ secrets.GITHUB_TOKEN }}
```

Pin `@v0.1.0` for a fixed version, or use `@v1` — the floating tag that tracks
the latest `1.x` release (the standard GitHub Actions convention).

### Thresholds

The example above uses the sentinel's **defaults** — `healthy-days: 30` and
`critical-days: 7`. Those are sensible for production contracts, but a
deliberately short-lived test/demo fixture decays far faster, so this suite's
`archival-fixtures-demo` config uses much tighter values (single-digit days).
Set `healthy-days` / `critical-days` per contract in `contracts.yml` whenever
the default 30/7 window does not match the contract's real TTL.

### 3. Configure Secrets

In your repository settings, add:

- **`SLACK_WEBHOOK_URL`** — Your Slack incoming webhook URL
- **`DISCORD_WEBHOOK_URL`** — Your Discord webhook URL
- **`GITHUB_TOKEN`** — Provided automatically if using `${{ secrets.GITHUB_TOKEN }}`

At least one alert channel must be configured.

If you use the `github-token` channel, the calling workflow needs `issues: write` permission:

```yaml
permissions:
  contents: read
  issues: write
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `sentinel-cli-path` | No | `install` | Path to `soroban-state-sentinel` binary, or `install` to fetch |
| `sentinel-version` | No | `v0.1.0` | `soroban-state-sentinel` release tag to install when `sentinel-cli-path` is `install` |
| `config-path` | No | `contracts.yml` | Path to contracts config file |
| `rpc-url` | **Yes** | — | Stellar RPC node URL |
| `slack-webhook-url` | No | — | Slack incoming webhook URL |
| `discord-webhook-url` | No | — | Discord webhook URL |
| `github-token` | No | — | GitHub token for issue dedup |
| `fail-on-critical` | No | `true` | Fail the run when a contract is Critical/Archived. Set to `false` to only alert |

When `sentinel-cli-path` is `install`, the action first checks `PATH`. If the
binary is absent it downloads the matching release asset for the runner's OS/arch
from `stellar-archival-labs/soroban-state-sentinel`, verifies its sha256 against
the published `.sha256`, extracts it to a temp directory, and adds it to `PATH`.
A checksum mismatch or download failure aborts the run — an unverified binary is
never executed. Platforms without a prebuilt asset fall back to
`cargo install --git https://github.com/stellar-archival-labs/soroban-state-sentinel --tag <version> sentinel-cli --locked`.

## Outputs

| Output | Description |
|--------|-------------|
| `contracts-critical` | JSON array of addresses in Critical/Archived state |
| `restore-xdr-artifact` | Name of uploaded workflow artifact with unsigned XDR |

## Alert Severity

| Health Band | Severity | Behavior |
|-------------|----------|----------|
| ✅ Healthy | None | No alert |
| ⚠️ ExpiringSoon | Info | Informational alert |
| 🔴 Critical | High | Alert with ping/mention |
| 💀 Archived | Critical | "Action required now" alert |

## Configuration

### contracts.yml

```yaml
network: testnet  # or mainnet

contracts:
  - address: 'C...'       # Required: Stellar contract address
    label: 'My Contract'  # Optional: human-readable label
    keys: ['AAAAAQ==']    # Optional: padded SCVal XDR keys
    healthy-days: 30       # Optional: override default threshold
    critical-days: 7       # Optional: override default threshold

alert:
  dedupe-window-hours: 24  # Optional: dedup window for GitHub Issues
```

### Threshold Overrides

You can override the sentinel's default thresholds (30 days healthy, 7 days critical) per contract. This is critical for test/demo contracts with short TTLs.

## Security

This action **never** holds, generates, or uses private keys. It never signs or submits transactions. It shells out to the sentinel CLI for scanning and POSTs alerts only.

See [SECURITY.md](SECURITY.md) for details.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Typecheck
npm run typecheck

# Build (bundles to dist/)
npm run build
```

## Maintainers

<table align="center">
<tr>
<td align="center">
<strong>Aycode01</strong> — maintainer
<br />
<a href="https://github.com/Aycode01">github.com/Aycode01</a>
</td>
</tr>
</table>

## Community

- [Discord](https://discord.gg/pMwVZf8TX)
- [Telegram](https://t.me/+RZKO3ffLffY0NDg0)

## License

MIT
