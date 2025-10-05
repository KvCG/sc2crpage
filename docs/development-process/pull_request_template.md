# PR Title

Same as commit or branch

## Summary
- What changed and why
- Scope and any exclusions

## Acceptance Checklist
- [ ] Branch created from `dev` (default) or from `main` for hotfix
- [ ] PR base is `dev` (default). Release PRs target `main`.
- [ ] Includes a valid backlog ID in title and body (e.g., [BL-008])
- [ ] CI green: eslint, tsc, tests, build
- [ ] Minimal diff; unrelated changes excluded
- [ ] For release PRs: curated changes only (interactive rebase or cherry-pick plan noted)
- [ ] Updated docs/backlog entries if applicable
