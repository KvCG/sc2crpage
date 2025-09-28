# Annotated Wireframes: SC2CR Major Pages

## 1. Ranking Page
```
[Header]
  - Logo | Navigation | Profile/Login
[Filters]
  - Season [dropdown] | Region [dropdown] | Queue [dropdown] | TeamType [dropdown] | Date Range [picker]
[Sort Controls]
  - Sort by: MMR | Win Rate | Activity | [Asc/Desc toggle]
[Ranking List]
  - Paginated table/grid
    - Position | Player Name | MMR | Race | Activity | Position Change Indicator
    - [Row click → Player Profile]
[Pagination]
  - Prev/Next | Page numbers | Items per page
[Footer]
  - Community links | About | Contact
```
- Responsive: Table collapses to cards on mobile, filters stack vertically.
- Accessibility: Table headers, ARIA for controls, keyboard navigation.

## 2. Player Profile Page
```
[Header]
  - Back to Rankings | Player Name | Cross-realm links
[Profile Summary]
  - Avatar | Name | Race | Region | Achievements
[Analytics]
  - MMR Delta | Win/Loss Streaks | Activity Level | Confidence Score
[Historical Data]
  - Chart: MMR over time | Match history (paginated)
[Head-to-Head]
  - Quick compare with rival (search/select)
[Community]
  - Badges | Weekly challenge status
```
- Responsive: Charts resize, sections stack.
- Accessibility: Semantic sections, alt text, ARIA for charts.

## 3. Head-to-Head Page
```
[Header]
  - Back | Player 1 vs Player 2
[Comparison Summary]
  - Win/Loss record | Recent matches | Streaks
[Leaderboard]
  - Top rivalries (paginated)
[Filters]
  - Date range | Queue | TeamType
```
- Responsive: Cards for summary, leaderboard collapses.
- Accessibility: ARIA for comparison, keyboard support.

## 4. Analytics Page
```
[Header]
  - Back | Analytics Overview
[Aggregate Metrics]
  - MMR distribution | Activity classification | Top streaks
[Player-Level Analytics]
  - Search/select player | Detailed stats
[Snapshot History]
  - Timeline of rank changes | Movers table
```
- Responsive: Charts and tables adapt.
- Accessibility: ARIA for metrics, semantic charts.

## 5. Admin/Observability Page (Admin only)
```
[Header]
  - Admin Dashboard
[Scheduler Status]
  - Next run | Last run | Errors
[Snapshot Retention]
  - List of snapshots | Retention policy
[Backup Status]
  - Last backup | Restore options
[Community Management]
  - Feature toggles | User management
```
- Responsive: Dashboard cards, collapsible sections.
- Accessibility: ARIA for admin controls, clear error states.

## 6. Community Features Page
```
[Header]
  - Community Hub
[Custom Leaderboards]
  - Create/view leaderboards
[Weekly Challenges]
  - Challenge list | Join/track progress
[Achievements]
  - Badges | Recent unlocks
```
- Responsive: Cards and lists adapt.
- Accessibility: Semantic badges, ARIA for challenge controls.

---

Each wireframe is described for layout, controls, and accessibility. Figma or Miro can be used for visual mockups if needed.
