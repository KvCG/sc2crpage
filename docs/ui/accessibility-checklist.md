# SC2CR Accessibility Checklist

## Overview
This checklist ensures all UI components and layouts meet accessibility standards for usability, inclusivity, and compliance.

---

## General Guidelines
- Use semantic HTML elements (table, section, nav, input, ul, li)
- Provide ARIA labels for interactive controls, tables, charts, status cards
- Ensure keyboard navigation for all controls (filters, pagination, search, sorting)
- Maintain sufficient color contrast (WCAG AA)
- Provide alt text for images and icons
- Use ARIA live regions for loading, error, and status updates
- Show visible focus states for all interactive elements
- Test with screen readers and keyboard-only navigation

---

## Component-Specific Requirements
### RankingList
- Table semantics, ARIA labels, keyboard navigation, color contrast for position indicators
### PlayerSearchBar
- ARIA autocomplete, live region, keyboard navigation
### ProfileCard
- Section region, alt text for avatar/race icons, ARIA labels for stats
### ComparisonTable
- Table semantics, sortable headers with ARIA-sort, keyboard navigation
### AnalyticsPanel
- Figure/table semantics, ARIA chart labels, color contrast
### SnapshotTimeline
- Nav/timeline semantics, ARIA labels, keyboard navigation
### AdminStatusCard
- Status region, ARIA live region

---

## References
- See docs/ui/component-inventory.md for component specs
- See docs/ux/guidelines/ux-guidelines.md for additional accessibility principles
