# Alert Channels & Fail-Fast Validation

`action-state-watch` supports three distinct notification delivery channels: **Slack**, **Discord**, and **GitHub Issues**.

## Fail-Fast Safeguard

The action enforces a strict operational requirement: **at least one valid alert channel must be configured**.

If a workflow invocation provides no `slack-webhook-url`, `discord-webhook-url`, or `github-token`, `action-state-watch` will immediately abort execution with a fatal error:

> 🚨 **Fail-Fast Rationale**: A monitoring bot that scans contracts but has no destination for alerts is a silent failure risk. Failing fast prevents operators from deploying misconfigured workflows that run without actually notifying anyone when contracts decay.

## Supported Channels

### 1. Slack Webhooks
Configured via `slack-webhook-url`. Sends formatted Slack Block Kit messages containing severity headers, health band summary, remaining ledgers, and days until archival.

### 2. Discord Webhooks
Configured via `discord-webhook-url`. Sends rich Discord Embeds colored by severity level (Blue for Info, Red for High, Dark for Critical).

### 3. GitHub Issues
Configured via `github-token`. Automatically creates, updates, and deduplicates GitHub Issues tagged with the `state-watch` label.

This channel needs `issues: write` on the calling workflow, otherwise the scan still succeeds but issue creation fails with `Resource not accessible by integration`:

```yaml
permissions:
  contents: read
  issues: write
```

## Multi-Channel Configuration Example

You can enable one, two, or all three channels simultaneously:

```yaml
- name: Run State Watch
  uses: stellar-archival-labs/action-state-watch@v0.1.0
  with:
    rpc-url: 'https://soroban-testnet.stellar.org'
    slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    discord-webhook-url: ${{ secrets.DISCORD_WEBHOOK_URL }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```
