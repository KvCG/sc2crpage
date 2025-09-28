# SC2CR UI Component Inventory

## Overview
This document catalogs the key UI components and patterns for the SC2CR app, including props, behaviour, data states, and accessibility notes. It supports implementation and future enhancements for a cohesive, responsive, and accessible user experience.

---

## Component Specs

### RankingList
- **Props:** data, filters, sort, pagination, baseline, loading, error, onFilterChange, onSortChange, onPageChange
- **Behaviour:** Table with filter/sort/pagination, position change indicators, loading skeleton, stale data indicator
- **Data States:** loading, error, empty, cached
- **Accessibility:** Semantic table, ARIA labels, keyboard navigation, color contrast

### PlayerSearchBar
- **Props:** value, suggestions, loading, error, onInputChange, onSelectSuggestion
- **Behaviour:** Debounced input, autosuggest, cross-realm links, loading spinner, error message
- **Data States:** loading, error, empty, cached
- **Accessibility:** ARIA autocomplete, live region, keyboard navigation

### ProfileCard
- **Props:** player, stats, snapshot, loading, error
- **Behaviour:** Player info, race, league, snapshot deltas, loading skeleton, error fallback
- **Data States:** loading, error, empty
- **Accessibility:** Section region, alt text, ARIA labels

### ComparisonTable
- **Props:** players, stats, sort, loading, error
- **Behaviour:** Head-to-head stats, sortable columns, loading skeleton, error banner
- **Data States:** loading, error, empty
- **Accessibility:** Table semantics, ARIA-sort, keyboard navigation

### AnalyticsPanel
- **Props:** deltas, streaks, activity, loading, error
- **Behaviour:** Charts/tables for deltas, streaks, activity, loading skeleton, error banner
- **Data States:** loading, error, empty
- **Accessibility:** Figure/table, ARIA chart labels, color contrast

### SnapshotTimeline
- **Props:** snapshots, movers, retention, loading, error
- **Behaviour:** Timeline of snapshots/movers, retention indicators, loading skeleton, error banner
- **Data States:** loading, error, empty
- **Accessibility:** Nav/timeline, ARIA labels, keyboard navigation

### AdminStatusCard
- **Props:** schedulerStatus, backupStatus, error, loading
- **Behaviour:** Status cards for scheduler/backup, error/loading/empty states
- **Data States:** loading, error, empty
- **Accessibility:** Status region, ARIA live region

---

## Responsive Layouts
- Grid/flexbox layouts for ranking, profile, head-to-head, analytics, snapshot, and admin pages
- Mobile: stacked cards, sticky filter/search bars, swipeable lists
- Tablet: multi-column layouts, collapsible panels
- Desktop: multi-column, sidebar panels
- Breakpoints: mobile (<600px), tablet (600-1024px), desktop (>1024px)

---

## Accessibility Guidelines
- Semantic HTML, ARIA labels, keyboard navigation, color contrast, alt text, live regions, focus states
- Test with screen readers and keyboard-only navigation

---

## Design System Notes
- Use Mantine/Material theme tokens for colors, typography, spacing
- Style tokens for spacing, border radius, shadows
- Component naming: agnostic, semantic
- Caching: loading skeletons, stale data indicators, refresh controls

---

## API Integration Points
- Query params for filters, sorts, pagination
- Components handle loading, error, empty, and cached states
- Show cached data with stale indicator, refresh controls

---

## References
- See docs/ux/guidelines/ux-guidelines.md for additional UX principles
- See .github/instructions/copilot-instructions.md for naming, style, and caching conventions
