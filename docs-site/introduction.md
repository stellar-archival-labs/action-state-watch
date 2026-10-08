# Introduction

`action-state-watch` is a scheduled GitHub Action that monitors deployed Soroban smart contracts on the Stellar network for TTL (Time-To-Live) decay and state archival risks, alerting operators before contract state is archived. Running on a configurable cron schedule, it periodically evaluates contract entries against defined health thresholds and dispatches alerts to Slack, Discord, or GitHub Issues when attention is required.

## The Problem Solved

Soroban smart contracts utilize state archival to manage ledger growth. Persistent data entries (contract instance and contract code WASM) must have their TTL extended periodically. If a contract's TTL expires without bump transactions, its state is evicted to archival storage, rendering the contract unusable until an expensive restore operation is executed.

This is not a theoretical risk: during live verification of the companion tool [`soroban-state-sentinel`](https://github.com/stellar-archival-labs/soroban-state-sentinel), scanning a real testnet contract discovered an entry in `Critical` state with approximately 3 days remaining before eviction. Without automated monitoring, production contracts silently lose access to persistent data when operators miss decay windows.

## Strict Security Model

`action-state-watch` operates with a strict, minimal trust boundary: **it never holds, generates, or uses private keys**, and it never signs or submits transactions to the Stellar network. It acts purely as a read-only scanner and alert notifier.
