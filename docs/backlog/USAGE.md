# Backlog Steward Usage Guide

This repo maintains a human-readable backlog (`docs/backlog/BACKLOG.md`) and a machine-readable mirror (`docs/backlog/backlog.yaml`). Use this guide for adding, updating, and evolving backlog items via chat.

## Conventions
- IDs: Use incremental `BL-###` identifiers (e.g., BL-007).
- Types: `feature | bug | techdebt | docs`.
- Areas: `client | server | ops`.
- Priorities: `P0 (NOW) | P1 (NEXT) | P2 (LATER) | P3 (NICE TO HAVE)`.
- Sections in BACKLOG.md:
  - NOW (P0)
  - NEXT (P1)
  - LATER (P2)
  - NICE TO HAVE (P3)
  - DONE

## Quick Commands (chat syntax)
Write a line beginning with one of the following keywords; the steward will parse and persist updates in both files.

- add: <title> | <type> | <area> | <priority> | why <reason> | ac: <bullet1>; <bullet2>; ...
- idea: <title> | <area> | why <reason>
- todo: <title> | <area> | ac: <bullets>
- fix: <title> | area server | why <reason> | ac: <bullets>
- feat: <title> | area client | ac: <bullets>
- note: BL-### "<note text>"

If any field is missing, the steward will infer where possible; otherwise it will add a TODO note in the item.

### Parsing rules
- Split fields by `|` when present; trim whitespace.
- `why` is captured after the literal token `why ` until next `|` or end.
- `ac:` starts acceptance criteria; split bullets by `;` or line breaks.
- If `priority` missing, default to P2 unless the text implies urgency.
- If `type` missing, infer from keywords: fix/bug → bug, feat/feature → feature, idea/todo → techdebt by default.
- If `area` missing, infer from referenced files/branches; else set TODO.

### Formatting expectations
- BACKLOG.md: Keep section headers unchanged. Insert or move only the affected item.
- backlog.yaml: Mirror all fields (id, title, type, area, priority, why, acceptance[], status, links).
- IDs: Allocate next BL-### sequentially; do not reuse IDs.
- Links: Use keys `branch`, `pr`, `issue` when available.

## Lifecycle Commands
- promote BL-### to P0|P1|P2|P3
- demote BL-### to P1|P2|P3
- retitle BL-### "New Title"
- note BL-### "Additional context or decision"
- link BL-### branch <name> / pr <#> / issue <#>
- start BL-### (marks Status: in-progress)
- done BL-### (moves item to DONE)
  - Also set `status: done` in YAML; keep acceptance intact.

## Acceptance Criteria
- Keep AC concrete and testable. Prefer bullets that can be verified in CI/tests.
- Example:
  - CI runs eslint, typecheck, tests, build on PRs to dev/main
  - ESLint flat config is ESM and loads without errors

## Examples
- add: Improve replay filter UX | feature | client | P2 | why streamline user workflow | ac: keyboard nav; keep filters in URL; RTL tests
- fix: Pulse API retry jitter | bug | server | P1 | why reduce thundering-herd | ac: exponential backoff; de-dupe in-flight; tests
- note: BL-002 "Mock SC2Pulse responses exist under mockData/"
- promote BL-003 to P1
- link BL-001 pr 42

## File Locations
- Human: `docs/backlog/BACKLOG.md`
- Machine: `docs/backlog/backlog.yaml`

## Steward Behavior
- Capture & classify inputs from the chat based on the above grammar.
- Persist updates to BOTH files with minimal diffs and keep sections in sync.
- Consolidate near-duplicates; reference links (branch/pr/issue) when obvious.
- Produce a short "Backlog delta" at the end of each session summarizing created/updated/promoted/done items.
  - Format: Δ Backlog: +N created (IDs) · M updated (IDs) · K done (IDs)
  - If uncertain on any field: write "I don't know" and add a TODO note.

## Branch/Commit/PR Enforcement
- Branch naming: `<type>/<BL-###>-<kebab-title>` where type ∈ {feature, fix, chore, docs, refactor, spike}.
- Always create branches from `main` (default branch):
  - `git fetch origin`
  - `git checkout main && git pull --ff-only`
  - `git checkout -b <type>/<BL-###>-<kebab-title>`
- Commits: conventional commit + ticket suffix, e.g., `feat(client): concise message [BL-021]`.
- PRs: Title `[BL-###] Clear title`; body links branch, lists acceptance criteria, test notes, and a release checklist.
- Always link branch/PR/issue in both BACKLOG.md and backlog.yaml under the item’s Links.

## Guardrails (project practices)
- Delivery flow: feature from main → Draft PR to dev → rebase on main for release → PR to main → merge → sync main→dev (rebase + --force-with-lease).
- Quality: readability over cleverness; comment complex logic; error contract `{ error, code, context }`; structured logging; `process.env` for config; Vitest tests (server: axios + vi.hoisted; client: MSW + RTL).
