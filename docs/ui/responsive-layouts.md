# SC2CR Responsive Page Layouts

## Overview
This document describes the grid/flexbox layouts and responsive behaviour for key SC2CR pages, supporting mobile, tablet, and desktop breakpoints.

---

## Ranking Page
- Filters (top), RankingList (main), Pagination (bottom)
- Mobile: Single column, sticky filter bar, swipeable pagination
- Tablet: Two columns (filters/sidebar), RankingList
- Desktop: Three columns (filters, RankingList, snapshot timeline)

## Player Profile Page
- ProfileCard (top), AnalyticsPanel (middle), SnapshotTimeline (bottom)
- Mobile: Stacked cards, collapsible analytics
- Tablet: ProfileCard + Analytics side-by-side, timeline below
- Desktop: ProfileCard (left), AnalyticsPanel (center), Timeline (right)

## Head-to-Head Leaderboard
- ComparisonTable (main), PlayerSearchBar (top)
- Mobile: Stacked, sortable table
- Tablet/Desktop: Table with sticky headers, search bar inline

## Analytics Dashboard
- AnalyticsPanel (main), filters (sidebar/top)
- Responsive charts, collapsible panels on mobile

## Snapshot/Admin Panel
- SnapshotTimeline (main), AdminStatusCard (sidebar/top)
- Mobile: Stacked, swipeable timeline
- Desktop: Timeline and status side-by-side

---

## Breakpoints
- Mobile: <600px
- Tablet: 600-1024px
- Desktop: >1024px

---

## References
- See docs/ui/component-inventory.md for component specs
- See docs/ux/guidelines/ux-guidelines.md for UX guidelines
