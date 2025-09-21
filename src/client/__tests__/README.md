Client tests live here. Suggested structure:

- unit: Pure component logic/hooks (mock DOM as needed)
- integration: Components rendering with RTL + MSW for API

Use `src/test/setup.ts` for jsdom and MSW.