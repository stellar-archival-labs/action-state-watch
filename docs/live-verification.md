# Live Verification — action-state-watch

Date: September 10, 2026  
Contract: `CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4` (archival-fixtures-demo)  
Workflow Run: [Run #34473391497](https://github.com/Aycode01/action-state-watch/actions/runs/34473391497/job/102858324701) (Self-Check #5, succeeded in 1m 34s)

---

## 1. Live GitHub Actions Workflow Verification

`self-check.yml` was manually triggered via `workflow_dispatch` against the real, deployed `archival-fixtures-demo` contract (`CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4`), using the thresholds defined in `contracts.example.yml`.

### Workflow Output Log

```
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

- **Workflow Status**: ✅ **Succeeded**
- **Health Band Reported**: **Healthy**
- **Alert Channel Outcome**: **None** — correct behavior, since the contract is Healthy. No GitHub Issue was created or needed to be. A Healthy result producing zero alerts demonstrates the alert-suppression logic working as designed.

### What This Confirms

- The sentinel binary builds from source successfully in CI and is found on `PATH` (fixing the prior `cargo install` failure — `soroban-state-sentinel` is not published to crates.io, so the workflow builds it from source each run instead).
- The action's fail-fast alert-channel check passes with `github-token` configured.
- `run-scan.ts`'s `execFileSync` invocation works against a real, installed binary — not mocked test data.
- The `Healthy` classification is consistent with the demo contract's known decay timeline as of this run.

### Prior Failures Fixed to Reach This Result

1. **`cargo install soroban-state-sentinel` failure** (crate not published to crates.io) — fixed by building the binary from source in the workflow (`54036dd`).
2. **Node 20 deprecation warning** on the action runtime — fixed by updating `action.yml` to `node24` (`148bcb4`).
3. **Cargo workspace resolution error** (`no bin target ... in default-run packages`) — fixed by adding `-p sentinel-cli` to the build command (`92a1b45`).
4. **Missing alert channel** causing the fail-fast check to block the run before scanning — fixed by adding `github-token: ${{ secrets.GITHUB_TOKEN }}` (`cd2d612`).

---

## 2. Local CLI & Schema Verification

**Note:** this section is a separate, direct invocation of the sentinel CLI against the same live contract, run independently of the CI workflow in Section 1. The `ledgers_remaining` figures below come from this direct run, not from the `self-check.yml` workflow output shown above.

### Sentinel Binary
Built from source at `soroban-state-sentinel` (commit `3033ba4`):
```
cargo build --release -p sentinel-cli
```
Binary location: `target/release/soroban-state-sentinel`

### Real Sentinel Output (JSON)
Captured by running the sentinel directly against live testnet:

```json
{
  "schema_version": "1.1.0",
  "generated_at_unix": 1789029181,
  "command": {
    "subcommand": "scan",
    "contract_id": "CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4",
    "rpc_url": "https://soroban-testnet.stellar.org"
  },
  "summary": {
    "entries_scanned": 2,
    "healthy": 2,
    "expiring_soon": 0,
    "critical": 0,
    "archived": 0,
    "has_critical": false
  },
  "entries": [
    {
      "id": "instance",
      "label": "contract instance",
      "kind": "contract_instance",
      "band": "healthy",
      "live_until_ledger_seq": 4704623,
      "ledgers_remaining": 103505,
      "days_remaining": 5
    },
    {
      "id": "code",
      "label": "contract code (wasm)",
      "kind": "contract_code",
      "band": "healthy",
      "live_until_ledger_seq": 4704622,
      "ledgers_remaining": 103504,
      "days_remaining": 5
    }
  ]
}
```

**Note on entry counts:** Section 1's `Total: 1` counts *contracts configured* in `contracts.example.yml` (one contract). This section's `entries_scanned: 2` counts *ledger entries within that one contract* (the contract instance and the contract code/wasm entry, tracked separately since each has its own TTL). These are not inconsistent — they're counting different things at different levels.

### Schema Verification Summary

| Field | types.ts | Sentinel (SCHEMA.md v1.1.0) | Status |
|-------|----------|------------------------------|--------|
| `band` | `"healthy" \| "expiring_soon" \| "critical" \| "archived"` | `"healthy" \| "expiring_soon" \| "critical" \| "archived"` | ✅ Match |
| `live_until_ledger_seq` | `number` | `u32 \| null` | ✅ Match |
| `ledgers_remaining` | `number` | `u32 \| null` | ✅ Match |
| `days_remaining` | `number` | `u64 \| null` | ✅ Match |
| `schema_version` | `string` | `"1.1.0"` | ✅ Match |
| `generated_at_unix` | `number` | `u64` | ✅ Match |

### CLI Flags Verified

| Flag | In types.ts/run-scan.ts | In sentinel args.rs | Status |
|------|-------------------------|---------------------|--------|
| `--rpc-url` | ✅ | ✅ | ✅ Match |
| `--keys` | ✅ | ✅ | ✅ Match |
| `--healthy-days` | ✅ | ✅ | ✅ Match |
| `--critical-days` | ✅ | ✅ | ✅ Match |
| `--json` | ✅ | ✅ | ✅ Match |
| `--safety-margin-ledgers` | ❌ Removed | ❌ Does not exist | ✅ Correctly removed |

---

## 3. Known Gap & Next Steps

This run confirms the `Healthy` path end-to-end: scan → classify → correctly suppress alerts. It does not yet confirm the `Critical`/`Archived` alert-dispatch path against real data, since the demo contract hasn't decayed that far yet as of this run.

That path is covered by unit tests with mocked sentinel output (see [`run-scan.test.ts`](file:///home/gamp/stellar-archival-labs/action-state-watch/__tests__/run-scan.test.ts), [`github-issue.test.ts`](file:///home/gamp/stellar-archival-labs/action-state-watch/__tests__/github-issue.test.ts)). Once the `archival-fixtures-demo` contract reaches `Critical` or `Archived` — expected within the following days per that repo's decay timeline — trigger `self-check.yml` again and append the transcript to close this last gap.

---

## 4. Install-mode dogfood — 2026-10-08

A second verification pass, after `sentinel-cli-path: install` replaced the
manual sentinel checkout/build in `self-check.yml`. The action now downloads the
published release asset and verifies its sha256 itself.

Workflow Run: [Run #37747797994](https://github.com/stellar-archival-labs/action-state-watch/actions/runs/37747797994) (Self-Check, succeeded in 11s, `workflow_dispatch`)

### Real Workflow Output

```
=== Soroban State Watch ===
Config: contracts.example.yml
RPC URL: https://soroban-testnet.stellar.org
Loaded 1 contract(s) from config
Downloading soroban-state-sentinel v0.1.0 (x86_64-unknown-linux-gnu) from https://github.com/stellar-archival-labs/soroban-state-sentinel/releases/download/v0.1.0
Installed sentinel CLI v0.1.0 (x86_64-unknown-linux-gnu) at /tmp/sentinel-rFnolg/soroban-state-sentinel-v0.1.0-x86_64-unknown-linux-gnu/soroban-state-sentinel
Sentinel CLI: /tmp/sentinel-rFnolg/soroban-state-sentinel-v0.1.0-x86_64-unknown-linux-gnu/soroban-state-sentinel
Starting contract scans...
Scanning CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4 (archival-fixtures-demo rapid-expiry entry)...
=== Scan Summary ===
Total: 1
Healthy: 0
Expiring Soon: 0
Critical: 0
Archived: 1
##[warning]1 contract(s) need attention!
Commented on issue #6 for CAEDHSOD3TXIAZF2BZMMNX7A2OKBCVE4WU7A6RWTHGGHWHJXHEQUMAT4
Findings: 0 contract(s) Critical, 1 Archived — not failing the run (fail-on-critical: false)
=== Done ===
```

### What This Confirms

- The `install` mode works end-to-end: the action downloaded
  `soroban-state-sentinel-v0.1.0-x86_64-unknown-linux-gnu.tar.gz`, verified its
  sha256 against the published `.sha256`, extracted it, and added it to `PATH`
  with no manual sentinel checkout or Rust build step in the workflow.
- The demo entry has now decayed to **Archived** (`Archived: 1`), and the
  GitHub-Issues alert channel dispatched against it (issue #6), closing the
  `Critical`/`Archived` gap noted in Section 3.
- With `fail-on-critical: false` the run stays green while still reporting the
  Archived finding — the opt-out behaves as designed.

### Note on Sections 1–2

The Section 1 transcript (`Found sentinel CLI on PATH: .../sentinel-src/target/release/...`,
`Healthy: 1`) and the Section 2 local JSON (`healthy: 2`) are now historical: the
workflow no longer builds the sentinel from source, and the contract has since
archived. They are kept verbatim as the record of those earlier runs.
