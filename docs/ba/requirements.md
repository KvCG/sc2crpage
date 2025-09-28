# SC2CR Community Platform – Business Analysis & Requirements

## 1. Current State Analysis

**Capabilities:**
- **Ranking:** Daily/Live rankings, position change indicators, race/MMR display, snapshot baseline.
- **Search:** Player search by btag/name, race, region; basic filters.
- **Snapshots:** Daily baseline, position delta, localStorage caching, expiry logic.
- **Analytics:** Basic activity metrics, win/loss streaks, confidence scores, limited historical data.
- **Admin:** No dedicated admin dashboard; manual data management.

**Gaps:**
- No advanced ranking filters/sorts (by race, region, activity).
- No head-to-head leaderboards or matchup analytics.
- Limited player profile enrichment (history, external links).
- No snapshot history browser (only current/baseline).
- No admin tools for monitoring, troubleshooting, or feature flag control.
- Limited accessibility and mobile optimization.
- No system health/observability dashboard.

---

## 2. Stakeholder Personas & Needs

| Persona              | Objectives                                                      |
|----------------------|-----------------------------------------------------------------|
| Competitive Player   | Track ranking, progress, streaks, find strong opponents         |
| Casual Player        | Find friends, view personal stats, casual leaderboards          |
| Admin/Volunteer      | Monitor system health, manage data, troubleshoot, control flags |

---

## 3. Feature Definition & Prioritization

| Feature                        | Problem Statement                                   | Value      | Effort | Dependencies                | Priority |
|---------------------------------|-----------------------------------------------------|------------|--------|-----------------------------|----------|
| Admin Tools                     | Monitor health, manage flags, troubleshoot          | High       | Medium | API, feature flags          | Must     |
| Ranking Filters/Sorts           | Users need to filter/sort rankings by race, region  | High       | Low    | API query params, caching   | Must     |
| Player Search/Profiles          | Find players, view enriched profiles                | High       | Medium | API, external links         | Must     |
| Accessibility Improvements      | Ensure usability for all users                      | High       | Low    | UI, ARIA, semantic HTML     | Must     |
| Mobile Optimization             | Improve mobile experience                           | High       | Medium | UI, responsive layouts      | Must     |
| Head-to-Head Leaderboards       | Compare players directly                            | Medium     | Medium | API, historical data        | Should   |
| Analytics Dashboard             | View activity, streaks, confidence, trends          | High       | High   | API, metrics, caching       | Should   |
| Snapshot History Browser        | Browse past snapshots, see movers                   | Medium     | Medium | API, snapshot storage       | Should   |
| System Health Dashboard         | Monitor uptime, errors, cache status                | Medium     | Medium | Metrics, logging            | Could    |

---

## 4. Requirements Documentation

### User Stories & Acceptance Criteria

#### Ranking Filters/Sorts
- *As a player, I want to filter/sort rankings by race, region, activity so I can find relevant competitors.*
  - **Acceptance:** Filters/sorts available, responsive UI, paginated results, <500ms API latency, cached for 30s, accessible controls.

#### Player Search/Profiles
- *As a user, I want to search for players and view enriched profiles with history and external links.*
  - **Acceptance:** Search by btag/name/race/region, profile page with stats/history/links, paginated, <500ms API, accessible.

#### Head-to-Head Leaderboards
- *As a player, I want to compare my stats directly with another player.*
  - **Acceptance:** Select two players, see win/loss, MMR delta, recent games, paginated, <1s API, accessible.

#### Analytics Dashboard
- *As a user, I want to view activity, streaks, confidence, and trends for myself and others.*
  - **Acceptance:** Dashboard with metrics, confidence scores, historical charts, paginated, <1s API, accessible.

#### Snapshot History Browser
- *As a user, I want to browse past ranking snapshots and see movers.*
  - **Acceptance:** List of snapshots, position change indicators, paginated, <1s API, accessible.

#### Admin Tools
- *As an admin, I want to monitor system health, manage feature flags, and troubleshoot issues.*
  - **Acceptance:** Dashboard with uptime, error logs, flag toggles, <1s API, secure access.

#### Accessibility Improvements
- *As any user, I want the site to be usable with keyboard, screen reader, and high contrast.*
  - **Acceptance:** Pass accessibility checklist, ARIA attributes, semantic HTML, tested on screen readers.

#### Mobile Optimization
- *As a mobile user, I want the site to be easy to use on my phone.*
  - **Acceptance:** Responsive layouts, touch-friendly controls, tested on multiple devices.

#### System Health Dashboard
- *As an admin, I want to see system status, error rates, and cache efficiency.*
  - **Acceptance:** Real-time metrics, error logs, cache stats, <1s API, secure access.

---

### API Requirements

- **Query Params:** All list endpoints support filters (race, region, activity), sorts, pagination (`page`, `limit`).
- **Pagination:** Default 25 items/page, max 100, with `next/prev` links.
- **Caching:** Rankings/analytics: 30s TTL; snapshots: 24h TTL; metrics: 5min TTL.
- **Accessibility:** All endpoints return semantic, well-typed DTOs.
- **Performance:** p95 <500ms for ranking/search, <1s for analytics/snapshots.
- **Free-tier Constraints:** API rate limits (10 RPS), data freshness (max 25h staleness), no new infra.

---

### TDD Notes

- Use fixtures in `docs/fixtures/` for edge cases (empty, partial, error, low confidence).
- Validate API contracts against `docs/contracts/api-contracts.json`.
- Write tests for filters, sorts, pagination, caching, accessibility, and error handling.

---

## 5. Roadmap & Risk Assessment

### Roadmap

| Milestone                | Description                                 | Target Date      |
|--------------------------|---------------------------------------------|------------------|
| Requirements Gathering   | Finalize user stories, acceptance criteria  | Week 1           |
| Design                   | Wireframes, API spec updates                | Week 2           |
| Implementation Phase 1   | Ranking filters, search, accessibility      | Weeks 3-4        |
| Implementation Phase 2   | Analytics dashboard, snapshot history       | Weeks 5-6        |
| Implementation Phase 3   | Admin tools, system health dashboard        | Weeks 7-8        |
| Rollout & Feedback       | Deploy, collect feedback, iterate           | Weeks 9-10       |

### Risk Register

| Risk                        | Impact   | Likelihood | Mitigation                        |
|-----------------------------|----------|------------|-----------------------------------|
| API changes/breakage        | High     | Medium     | Feature flags, contract tests     |
| Volunteer bandwidth         | High     | High       | Prioritize Must/Should, phase out |
| Data freshness issues       | Medium   | Medium     | Caching, fallback strategies      |
| Accessibility gaps          | Medium   | Low        | Checklist, automated tests        |
| Mobile usability gaps       | Medium   | Medium     | Responsive design, user testing   |

---

## 6. Prioritization Table

| Feature                        | Value   | Effort | Priority |
|---------------------------------|---------|--------|----------|
| Admin Tools                     | High    | Medium | Must     |
| Ranking Filters/Sorts           | High    | Low    | Must     |
| Player Search/Profiles          | High    | Medium | Must     |
| Accessibility Improvements      | High    | Low    | Must     |
| Mobile Optimization             | High    | Medium | Must     |
| Head-to-Head Leaderboards       | Medium  | Medium | Should   |
| Analytics Dashboard             | High    | High   | Should   |
| Snapshot History Browser        | Medium  | Medium | Should   |
| System Health Dashboard         | Medium  | Medium | Could    |

---

## 7. Instruction Doc Patch Proposal

If prioritization tags (Must/Should/Could/Won’t) and feature tables are not yet standardized, propose the following patch to `.github/COPILOT_INSTRUCTIONS.md`:

```
*** Begin Patch
*** Update File: .github/instructions/copilot-instructions.md
@@
-## Feature Definition & Prioritization
+## Feature Definition & Prioritization
+
+### Prioritization Tags
+Use the following tags for feature prioritization:
+  - **Must**: Essential for core user value; implement first.
+  - **Should**: Important, but not critical; implement after Musts.
+  - **Could**: Nice-to-have; implement if resources allow.
+  - **Won’t**: Out of scope for current cycle.
+
+### Feature Table Format
+Document features in a table with columns: Feature, Value, Effort, Priority.
+
+| Feature | Value | Effort | Priority |
+|---------|-------|--------|----------|
+| ...     | ...   | ...    | ...      |
*** End Patch
```

---

If needed, create documentation under `docs/ba/` for business analysis artifacts.

---

**Self-Check:**
1. Features are aligned with community needs and volunteer feasibility.
2. Acceptance criteria are clear, measurable, and testable.
3. Prioritization reflects user value vs. effort.
4. API constraints, accessibility, and caching are considered.
5. Roadmap and risk mitigation are included.
