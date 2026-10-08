# Testing Against the Demo Contract

This guide demonstrates how to execute live verification scans against the real deployed testnet contract [`archival-fixtures-demo`](https://github.com/stellar-archival-labs/archival-fixtures-demo).

## Demo Contract Reference

- **Contract ID**: `CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4`
- **Network**: Stellar Public Testnet (`https://soroban-testnet.stellar.org`)
- **Threshold Overrides**: `healthy-days: 1`, `critical-days: 1`

## Setup & Configuration

To test against the live demo contract locally or in a workflow dispatch, use [`contracts.example.yml`](../../contracts.example.yml):

```yaml
network: testnet

contracts:
  - address: 'CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4'
    label: 'archival-fixtures-demo rapid-expiry entry'
    keys: []
    healthy-days: 1
    critical-days: 1

alert:
  dedupe-window-hours: 24
```

## Real Captured CI Output

The following log transcript was captured from live GitHub Actions Self-Check Run [#34473391497](https://github.com/Aycode01/action-state-watch/actions/runs/34473391497/job/102858324701) (Self-Check #5, executed via `workflow_dispatch`):

```text
=== Soroban State Watch ===
Config: contracts.example.yml
RPC URL: https://soroban-testnet.stellar.org
Loaded 1 contract(s) from config
Found sentinel CLI on PATH: /home/runner/work/action-state-watch/action-state-watch/sentinel-src/target/release/soroban-state-sentinel
Sentinel CLI: /home/runner/work/action-state-watch/action-state-watch/sentinel-src/target/release/soroban-state-sentinel
Starting contract scans...
Scanning CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4 (archival-fixtures-demo rapid-expiry entry)...
=== Scan Summary ===
Total: 1
Healthy: 1
Expiring Soon: 0
Critical: 0
Archived: 0
All contracts are healthy. No alerts to send.
=== Done ===
```

## Verification Confirmation

- **Workflow Status**: ✅ **Succeeded** (Run duration: 1m 34s)
- **Health Classification**: `Healthy`
- **Alert Dispatch**: Correctly suppressed alerts for Healthy contract state.
- **Reference Document**: See [`docs/live-verification.md`](../../docs/live-verification.md) for complete details.
