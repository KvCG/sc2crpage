# Testing Guide

This project uses Vitest for both server and client tests.

## Commands

```bash
# Run all tests
npm test

# Server-only tests
npm run test:server

# Client-only tests
npm run test:client

# Coverage
npm run test:coverage
```

## Structure

- Server tests:
   - Unit: `src/server/__tests__/unit/**/*.test.ts`
   - Integration: `src/server/__tests__/integration/**/*.test.ts`
   - Legacy catch-all still supported: `src/server/**/*.test.ts`
- Client tests: `src/client/**/*.test.tsx`
- Test setup: `src/test/setup.ts`
- MSW handlers: `src/test/mocks/server.ts`

## What to Test First

1. Caching behavior (`src/server/utils/cache.ts`)
2. SC2Pulse service (`src/server/services/pulseApi.ts`)
   - Cache hits/misses
   - In-flight promise sharing (stampede prevention)
   - Error handling and retries
3. Data formatting (`src/server/utils/formatData.ts`)
4. Critical UI components (Ranking table, Replays)

## Writing Tests

- Prefer unit tests for pure utilities
- Use MSW to mock external APIs for integration-like tests
- Avoid brittle selectors in UI tests; use accessible roles/text

## Coverage Targets

- Server core (cache + pulseApi): 80%+
- Utilities (formatters/helpers): 70%+
- UI components: 60%+ (grow over time)

## CI

Tests must pass on PRs before merge. Add/update tests alongside code changes.

## Questions / Gaps

- Define critical E2E flows (Playwright/Cypress)
- Confirm acceptable flakiness thresholds for networked tests
- Establish snapshot testing policy for UI
