#!/usr/bin/env bash
#
# create-issue-backlog.sh — idempotently file the contributor-ready backlog for
# action-state-watch.
#
# Idempotent: skips any issue whose exact title already exists (open or closed),
# and uses `gh label create --force` so labels are created/updated safely.
#
# Usage:
#   ./scripts/create-issue-backlog.sh
#   GITHUB_REPOSITORY=owner/repo ./scripts/create-issue-backlog.sh
#
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-stellar-archival-labs/action-state-watch}"
WAVE_LABEL="Stellar Wave"

gh label create "$WAVE_LABEL" --repo "$REPO" --force \
  --color "6f42c1" --description "Scoped for a Drips Wave contributor sprint" >/dev/null

EXISTING_TITLES="$(gh issue list --repo "$REPO" --state all --limit 500 --json title --jq '.[].title')"

mk() {
  local title="$1" body="$2"
  if printf '%s\n' "$EXISTING_TITLES" | grep -Fxq "$title"; then
    echo "skip (already exists): $title"
    return 0
  fi
  gh issue create --repo "$REPO" --title "$title" --label "$WAVE_LABEL" --body "$body" >/dev/null
  echo "created: $title"
}

mk "Add a workflow summary step detailing decayed contracts" "$(cat <<'BODY'
## Summary
Write a Markdown summary of the scan to `GITHUB_STEP_SUMMARY` so a run's
decayed contracts are visible without expanding raw logs.

## Why it matters
Reviewers and on-call operators land on the run page, not the log. A rendered
table (contract, band, ledgers/days remaining) makes the outcome obvious.

## Acceptance Criteria
- [ ] After scanning, append a Markdown table to `$GITHUB_STEP_SUMMARY`.
- [ ] Contracts needing action (Critical/Archived) are called out first.
- [ ] Includes the RPC URL and scan timestamp.
- [ ] Unit test the summary builder (rows for each band).

## Tech Stack / files to touch
TypeScript, `@actions/core` `summary` API. `src/index.ts`, a new `src/summary.ts`.

## Out of scope
Posting the summary anywhere other than the job summary.
BODY
)"

mk "Allow a per-contract RPC URL override" "$(cat <<'BODY'
## Summary
The action takes a single `rpc-url` input for all contracts. Allow an optional
per-contract `rpc-url` in `contracts.yml` so contracts on different networks/
endpoints can be monitored in one run.

## Why it matters
Teams commonly run some contracts against a dedicated/archival RPC and others
against the public endpoint. One global URL forces a separate workflow per
endpoint.

## Acceptance Criteria
- [ ] `contracts.yml` entries may set `rpc-url`; it overrides the action input for that contract.
- [ ] The effective URL per contract is logged.
- [ ] `src/config.ts` validates the field; README documents it.
- [ ] Unit test the precedence (per-contract wins; falls back to the input).

## Tech Stack / files to touch
TypeScript. `src/config.ts`, `src/types.ts`, `src/run-scan.ts`, `README.md`.

## Out of scope
Per-contract auth headers / custom RPC credentials.
BODY
)"

mk "Add tests for the Slack/Discord webhook success and failure paths" "$(cat <<'BODY'
## Summary
`__tests__/slack.test.ts` and `__tests__/discord.test.ts` exist but do not cover
the POST success body and the non-2xx / network-failure paths end to end. Fill
the gaps so a webhook regression is caught in CI.

## Why it matters
Alert delivery is the action's whole point. A silent webhook failure is worse
than no action, because it looks green.

## Acceptance Criteria
- [ ] Test the success path: correct payload shape and the POST target URL.
- [ ] Test a non-2xx response surfaces a warning/failure.
- [ ] Test a thrown fetch error does not crash the whole run.
- [ ] No real network calls (fetch mocked).

## Tech Stack / files to touch
TypeScript, Jest. `__tests__/slack.test.ts`, `__tests__/discord.test.ts`, `src/alerts/`.

## Out of scope
Testing the remote services themselves.
BODY
)"

mk "Add a mainnet-passphrase safety check" "$(cat <<'BODY'
## Summary
`contracts.yml` accepts `network: mainnet`. Add an explicit, loud guard so the
action cannot silently run what the operator thinks is testnet (or vice versa)
against the wrong RPC/passphrase.

## Why it matters
The suite's posture is testnet-first; a mainnet run by accident is exactly the
kind of silent misconfiguration that should fail fast and loudly.

## Acceptance Criteria
- [ ] When `network` and the RPC's reported passphrase disagree, fail with a clear message.
- [ ] A mainnet selection requires an explicit acknowledgement input (e.g. `allow-mainnet: 'true'`).
- [ ] README documents the guard.
- [ ] Unit test both the mismatch and the acknowledgement paths.

## Tech Stack / files to touch
TypeScript. `src/config.ts`, `src/index.ts`, new input in `action.yml`, `README.md`.

## Out of scope
Performing any mainnet write — the action never signs or submits.
BODY
)"

mk "Validate inputs against contracts.yml schema early" "$(cat <<'BODY'
## Summary
Move `contracts.yml` validation to the very start of the run so a malformed
config fails immediately with a precise message, before any network or binary
work happens.

## Why it matters
A late failure wastes runner minutes and produces a confusing error far from the
actual cause.

## Acceptance Criteria
- [ ] A single validation entrypoint runs before `resolveSentinelCli`/`runScan`.
- [ ] Errors name the offending field and contract index.
- [ ] Unknown-but-tolerated keys are listed as warnings, not hard failures.
- [ ] Unit tests for each invalid shape (missing address, bad network, wrong types).

## Tech Stack / files to touch
TypeScript, `js-yaml`. `src/config.ts`, `src/index.ts`, `__tests__/config.test.ts`.

## Out of scope
Auto-migrating old config formats.
BODY
)"

mk "Support matrix strategy for parallel testnet/mainnet monitoring" "$(cat <<'BODY'
## Summary
Document and support a `strategy.matrix` example so the same contract set is
monitored on testnet and mainnet in parallel workflows.

## Why it matters
Teams deploy to both networks; a copy-paste matrix example removes a common
sourcing mistake (hardcoded `rpc-url`).

## Acceptance Criteria
- [ ] A documented `.github/workflows` example using `matrix` over `rpc-url` (and passphrase).
- [ ] Inputs are clearly parameterizable (no hardcoded network values).
- [ ] README links the example.

## Tech Stack / files to touch
GitHub Actions YAML, Markdown. `README.md`, `docs-site/`.

## Out of scope
Cross-network result aggregation.
BODY
)"

mk "Post a GitHub PR comment if fixture states change" "$(cat <<'BODY'
## Summary
When the action runs on a `pull_request` event, post or update a single PR
comment summarising any contract that has drifted into Critical/Archived.

## Why it matters
A reviewer updating a fixture should see the resulting health change in the PR,
not have to open the run logs.

## Acceptance Criteria
- [ ] Detect `pull_request` and use the GitHub REST API to create/update one comment (no duplicates).
- [ ] Comment lists changed/changed-state contracts with their band.
- [ ] No-op when nothing needs attention.
- [ ] Unit test the comment body builder and the update-vs-create decision.

## Tech Stack / files to touch
TypeScript, `@actions/github`, `@octokit/rest`. `src/alerts/github-issue.ts` (sibling flow), `src/index.ts`.

## Out of scope
Branch protection / merge gating based on the comment.
BODY
)"

echo "backlog complete for $REPO"
