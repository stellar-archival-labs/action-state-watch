#!/usr/bin/env bash
set -euo pipefail
REPO="${GITHUB_REPOSITORY:-Aycode01/action-state-watch}"

mk() {
    gh issue create --repo "$REPO" --title "$1" --body "$2"
}

mk "Validate inputs against contracts.yml schema early" "$(cat <<'BODY'
## Summary
The action should fail fast if the provided `contracts.yml` config is malformed, missing required fields, or specifying unknown environments. This prevents confusing errors deeper in the execution.
## Acceptance Criteria
- Add a strict JSON/YAML schema validation step at the beginning of the action.
- Fail with a descriptive error message if the schema is violated.
## Tech Stack
TypeScript/JavaScript, ajv, js-yaml
BODY
)"

mk "Add a workflow summary step detailing decayed contracts" "$(cat <<'BODY'
## Summary
Users need a quick way to see which contracts are in Critical or Archived states without digging through the raw logs. The action should generate a rich GitHub Actions Job Summary.
## Acceptance Criteria
- Use `@actions/core` `summary` API to append a Markdown table to the job run.
- Highlight contracts that need immediate remediation.
## Tech Stack
Node.js, @actions/core
BODY
)"

mk "Support matrix strategy for parallel testnet/mainnet monitoring" "$(cat <<'BODY'
## Summary
Teams often deploy the same contracts to testnet and mainnet. The action should gracefully support GitHub Actions matrix strategies so both environments can be monitored in parallel workflows.
## Acceptance Criteria
- Ensure inputs like `rpc-url` and `network-passphrase` are easily parameterized.
- Document an example workflow `.yml` that uses `strategy.matrix` to run both simultaneously.
## Tech Stack
GitHub Actions syntax, Markdown
BODY
)"

mk "Post a GitHub PR comment if fixture states change" "$(cat <<'BODY'
## Summary
If the action runs on a pull request (e.g., as part of a fixture update), it should proactively comment on the PR if any contract has drifted into the Critical or Archived bands.
## Acceptance Criteria
- Detect if the event is a `pull_request`.
- Use the GitHub REST API to post or update a comment with the health band status.
## Tech Stack
Node.js, @actions/github, GitHub API
BODY
)"

mk "Publish the action to the GitHub Marketplace" "$(cat <<'BODY'
## Summary
To make it easier for other Stellar developers to use this action, it needs to be published to the GitHub Marketplace. This requires a specific release process and metadata.
## Acceptance Criteria
- Ensure `action.yml` has the correct branding (icon and color).
- Draft a new release and check the 'Publish this Action to the GitHub Marketplace' box.
- Verify the action appears in the marketplace search.
## Tech Stack
GitHub Marketplace, YAML
BODY
)"

echo "5 backlog issues created on $REPO"
