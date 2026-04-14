---
description: "Use when working on client-side code: React components, hooks, pages, or services under src/client/. Covers API config, data fetching, ranking snapshot, UX patterns, and accessibility requirements."
applyTo: "src/client/**"
---

# Client-Side Patterns

## API Config

`services/config.ts` selects the API base URL based on `window.location.hostname`:

| Hostname | API |
|----------|-----|
| Vercel / Render domains | Render production API |
| Fly.io dev domains | Fly.io dev API |
| `localhost` | `http://localhost:3000/` |

Config files: `src/client/config/{prod,dev,local}.config.json`

## Data Fetching

- `hooks/useFetch.tsx` — GET requests with caching
- `hooks/usePost.tsx` — POST requests
- `services/api.ts` — typed API call helpers

Display stale data immediately when cache exists; show a refresh indicator rather than a blank spinner. Only show a full spinner when no cached data is available at all.

## Ranking Snapshot & Position Indicators

- `GET /api/snapshot` → `{ data: RankingRow[], createdAt: ISO, expiry: number }`
- FE stores baseline in `localStorage` under key `dailySnapshot`; uses `expiry` for validity
- Live data: `GET /api/top`
- `utils/rankingHelper.addPositionChangeIndicator(current, baseline)` decorates rows with `positionChangeIndicator` arrows using `btag` position; index 0 is handled correctly
- `pages/Ranking.tsx` loads baseline then computes indicators on live data

## UX Guidelines

### Layout
- Mobile-first; scale up for desktop
- CSS grid/flexbox for fluid layouts
- Touch targets: large tap areas, swipeable lists, collapsible filters

### Lists & Filtering
- Pagination required on all lists with clear controls
- Filters must be easy to reset and persist across navigation
- Graceful empty states with helpful messaging

### Accessibility
- Semantic HTML: tables, lists, headings, buttons
- Keyboard navigation for all interactive elements
- ARIA attributes for custom controls, charts, and dynamic content
- Sufficient color contrast; alt text for images and icons

### Performance
- Client-side caching (localStorage, SWR pattern) for rankings, profiles, analytics
- Show data freshness / last-update time to the user
- Minimize API calls with batching and pagination
