# Testing Guide

Status: Vitest is planned but not configured yet in this repo (no vitest config or npm scripts exist). This guide outlines the intended setup and first targets so we can align code and CI next.

## Planned Commands

Suggested npm scripts to add:
```bash
# Run all tests
npm test

# Server-only
npm run test:server

# Client-only
npm run test:client

# Coverage
npm run test:coverage
```

## Suggested Structure

- Server tests:
  - Unit: `src/server/__tests__/unit/**/*.test.ts`
  - Integration: `src/server/__tests__/integration/**/*.test.ts`
- Client tests: `src/client/**/*.test.tsx`
- Optional setup: `src/test/setup.ts` and `src/test/mocks/server.ts` (MSW)

## First Targets

1. Cache behavior: `src/server/utils/cache.ts`
2. SC2Pulse service: `src/server/services/pulseApi.ts`
   - Cache hit/miss, in-flight promise sharing
3. Data formatting: `src/server/utils/formatData.ts`

## Minimal Next Steps

- Add Vitest deps and config files:
  - `vitest.config.ts` (node for server) and optional `vitest.client.config.ts` (jsdom)
- Add npm scripts as above; scope coverage to relevant folders
- Use MSW for API interactions as needed

## CI Note

CI currently runs `npm run test -- --coverage || true` in `.github/workflows/Deploy.yml`. Once scripts/configs are added, remove the `|| true` to enforce failures.

## Open Questions

- Do we want a single root Vitest config or split client/server configs?
- Any preferred E2E runner (Playwright/Cypress) to integrate later?
