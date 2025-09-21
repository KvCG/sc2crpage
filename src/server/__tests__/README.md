Server tests live here organized by scope:

- unit: Fast, isolated tests for pure functions and small modules.
- integration: Exercise multiple modules together with mocks for externals.

Vitest picks up both `__tests__` folders and legacy `*.test.ts` colocated tests.