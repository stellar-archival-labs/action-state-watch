# Action Inputs & Outputs

`action-state-watch` is configured using standard GitHub Actions `with:` inputs in your workflow file.

## Action Inputs

| Input Name | Description | Type | Required | Default |
|---|---|---|---|---|
| `rpc-url` | Stellar RPC node URL for querying contract state | `string` | **Yes** | — |
| `config-path` | Path to the `contracts.yml` configuration file | `string` | No | `'contracts.yml'` |
| `sentinel-cli-path` | Path to `soroban-state-sentinel` binary, or `'install'` to build/fetch | `string` | No | `'install'` |
| `slack-webhook-url` | Slack incoming webhook URL for alerts | `string` | No | — |
| `discord-webhook-url` | Discord webhook URL for alerts | `string` | No | — |
| `github-token` | GitHub token for issue creation and deduplication | `string` | No | — |
| `fail-on-critical` | Fail the run when a contract is `Critical` or `Archived` | `boolean` | No | `'true'` |

## Action Outputs

| Output Name | Description | Type |
|---|---|---|
| `contracts-critical` | JSON array of contract addresses in `Critical` or `Archived` state | `string` (JSON array) |
| `restore-xdr-artifact` | Name of uploaded workflow artifact containing unsigned restore XDR | `string` |

## Workflow Execution Example

```yaml
name: Contract Health Check

on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Soroban State Watch
        uses: stellar-archival-labs/action-state-watch@v0.1.0
        with:
          rpc-url: 'https://soroban-testnet.stellar.org'
          config-path: 'contracts.yml'
          github-token: ${{ secrets.GITHUB_TOKEN }}
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Fail-on-Critical Behavior

By default the action fails the run (`core.setFailed`) when any configured contract is `Critical` or `Archived`, so a decaying contract is visible as a red workflow run in addition to the alerts it dispatches.

Workflows that only want the alerts — monitoring dashboards, or verification workflows with an intentionally decayed fixture contract — can opt out:

```yaml
- name: Run State Watch
  uses: stellar-archival-labs/action-state-watch@v0.1.0
  with:
    rpc-url: 'https://soroban-testnet.stellar.org'
    fail-on-critical: 'false'
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

A genuine error (missing config, unusable sentinel binary, unparseable scan output) still fails the step either way.

## Required Workflow Permissions

The `github-token` channel creates and comments on issues, so the calling workflow must grant `issues: write`. Without it the scan succeeds but issue creation fails with `Resource not accessible by integration`:

```yaml
permissions:
  contents: read
  issues: write
```
