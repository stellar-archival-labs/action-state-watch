# Local Setup & Development

This guide outlines how to set up the `action-state-watch` development environment, run test suites, check TypeScript types, and bundle the GitHub Action.

## Prerequisites

- **Node.js**: v20 or v24 (Action runtime is targetted for `node24`)
- **npm**: v9+
- **Rust / Cargo** (optional, required only if compiling `soroban-state-sentinel` locally)

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/stellar-archival-labs/action-state-watch.git
cd action-state-watch
npm ci
```

## Available Scripts

Sourced directly from `package.json`:

```bash
# Run unit tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Run TypeScript typechecking without emitting JS
npm run typecheck

# Run ESLint across src/ and __tests__/
npm run lint

# Build production bundle to dist/ via @vercel/ncc
npm run build
```

## Build Artifacts

The GitHub Action entry point is compiled into `dist/index.js` using `@vercel/ncc`. Whenever changes are made to TypeScript files in `src/`, run `npm run build` to update the distribution bundle prior to committing.
