# Testing Guide (Vitest)

This repo uses Vitest for both client (jsdom) and server (node) tests.

## Commands

```bash
# All tests (client + server)
npm test

# Client-only
npm run test:client

# Server-only
npm run test:server

# Coverage reports (both sides)
npm run coverage
```

## Configuration

- Client config: `vitest.client.config.ts` (jsdom, RTL setup `src/test/setup.ts`).
- Server config: `vitest.server.config.ts` (node env).
- Global coverage thresholds: 85% lines/statements/functions/branches on both configs.

## Structure

- Client tests: `src/client/**/*.test.{ts,tsx}`
- Server tests: `src/server/**/*.{test,spec}.{ts,tsx}`
- Test setup: `src/test/setup.ts` (includes `@testing-library/jest-dom` and MSW)
- MSW handlers: `src/test/mocks/server.ts`

## Priorities (high ROI)

1. Client utils and hooks: pure logic and loading/error flows.
2. Client API layer: request shape, encoding, and error propagation.
3. Server utils: cache TTL (fake timers), UA parsing, time zone conversion.
4. Key components: initial render, empty/loading/error states, accessible queries.

## Guidelines

- Deterministic tests (<100ms typical), no real network or I/O.
- Mock axios with `vi.mock('axios')`; use MSW for integration-like HTTP.
- Prefer RTL semantic queries; avoid implementation details.

## CI

Coverage thresholds are enforced via Vitest configs. Tests must pass on PRs before merge.