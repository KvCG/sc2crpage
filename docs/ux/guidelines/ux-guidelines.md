# SC2CR UX Guidelines

## Responsive Design
- Mobile-first layouts: Prioritize usability on small screens, then scale up for desktop.
- Flexible grids and cards: Use CSS grid/flexbox for adaptable layouts.
- Touch-friendly controls: Large tap targets, swipeable lists, collapsible filters.
- Test on multiple devices and orientations.

## Caching & Data Loading
- Use client-side caching (localStorage, SWR pattern) for ranking lists, profiles, and analytics.
- Display cached (stale) data immediately, with a refresh indicator and option to reload.
- Show loading spinners only if no cached data is available.
- Clearly indicate data freshness and last update time.
- Minimize API calls by batching requests and paginating data.

## Pagination & Filtering
- All lists (rankings, search, leaderboards) must support pagination with clear controls.
- Filters and sorting should be accessible, easy to reset, and persist across navigation.
- Gracefully handle empty states (no results, end of list) with helpful messaging.

## Accessibility
- Use semantic HTML elements (tables, lists, headings, buttons).
- Ensure keyboard navigation for all interactive elements (tab order, focus states).
- Add ARIA attributes for custom controls, charts, and dynamic content.
- Maintain color contrast and provide alt text for images/icons.
- Test with screen readers and keyboard-only navigation.

## Developer Communication
- Document API query parameters, pagination, and caching strategies in code and README.
- Annotate wireframes and journey maps with expected data flows and error states.
- Use clear naming conventions for components, hooks, and services (see COPILOT_INSTRUCTIONS).
- Flag accessibility and responsive requirements in PRs and code reviews.

## Community & Volunteer Considerations
- Prioritize features that drive engagement but are feasible for a small team.
- Use modular, reusable components to minimize maintenance overhead.
- Provide admin tools for monitoring and troubleshooting without exposing sensitive controls to regular users.

---

These guidelines ensure a consistent, accessible, and maintainable UX for SC2CR, supporting both community needs and volunteer resources.
