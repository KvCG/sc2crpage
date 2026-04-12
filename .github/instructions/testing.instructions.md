---
description: "Use when writing, reviewing, or fixing tests. Covers test structure, mocking patterns, fixture conventions, integration vs unit boundaries, and the filterConsistency invariant. See also docs/development/testing.md."
---

# Testing Patterns

Full reference: `docs/development/testing.md`

## Runner & Config

Vitest with separate configs per side:
- `vitest.client.config.ts` — jsdom environment
- `vitest.server.config.ts` — Node environment

Test files live under `src/server/__tests__/` (unit and integration) and mirror the source structure.

## Test Organization

```
src/server/__tests__/
  unit/                   Isolated service/utility tests
    services/             Service-specific unit tests
  integration/            Route-level and cross-service tests
    filterConsistency.test.ts   MUST stay green — enforces min games invariant
  dataDerivations.test.ts
  logging-and-debug.spec.ts
```

## Mocking

Use `vi.hoisted()` to hoist mock factories above imports:

```typescript
const hoisted = vi.hoisted(() => ({
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('../../logging/logger', () => ({ default: hoisted.mockLogger }))

// Import module under test AFTER mocks
import { myFunction } from '../../services/myService'
```

Mock at the boundary (external APIs, logger, env vars) — never mock the module under test itself.

## Fixtures

- Naming: scenario-based (e.g., `deltas_normal.json`, `deltas_no_baseline.json`)
- Schema naming: endpoint-agnostic domain names (`RankingRow`, `PlayerDelta`)
- Always include edge cases: empty responses, missing data, partial coverage, error states
- Meta fields for degraded states: `meta.limits.reason`
- `mockData/` holds shared fixture JSON; test-specific fixtures sit next to the test file

## Integration Tests

Test at the route-handler level with mocked service dependencies. Do not call live external APIs. The `filterConsistency.test.ts` integration test is a required invariant — never skip or disable it.

## Edge Cases to Always Cover

- Empty API responses / null data
- Invalid or missing DTO fields
- Unexpected HTTP status codes from external services
- Feature flag enabled vs disabled states
- Boundary values (min/max games, MMR range, empty player lists)

## Snapshot Testing

Use sparingly — only for complex derived data structures. Update deliberately; never auto-accept snapshot diffs without reviewing the diff.
