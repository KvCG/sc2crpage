# SC2CR Design System Notes

## Overview
This document outlines the design tokens, style conventions, and theming principles for the SC2CR UI, ensuring consistency and maintainability.

---

## Color, Typography, Spacing
- Use Mantine/Material theme tokens for colors, typography, and spacing
- Maintain consistent color palette and type scale across components
- Spacing tokens for margin, padding, grid gaps
- Border radius and shadow tokens for cards, panels

---

## Responsive Breakpoints
- Mobile: <600px
- Tablet: 600-1024px
- Desktop: >1024px
- Use grid/flexbox for adaptable layouts

---

## Component Naming
- Use agnostic, semantic names (e.g., RankingList, PlayerSearchBar, ProfileCard)

---

## Caching & Data States
- Display loading skeletons for async data
- Show stale/cached data indicators and refresh controls
- Handle loading, error, empty, and cached states explicitly

---

## References
- See docs/ui/component-inventory.md for component specs
- See docs/ux/guidelines/ux-guidelines.md for design principles
- See .github/instructions/copilot-instructions.md for naming and style conventions
