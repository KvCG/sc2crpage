---
applyTo: '**'
---
Analyze this codebase to generate or update .github/copilot-instructions.md for guiding AI coding agents.

Focus on capturing only what an AI needs to be immediately productive here:

Big-picture architecture (major components, service boundaries, key data flows, and the rationale you can infer).

Critical developer workflows (build, test, debug, run) including non-obvious commands/scripts.

Project-specific conventions and patterns (naming, folder layout, error handling, state management, routing, logging).

Integrations, external dependencies, and cross-component communication patterns.

Source existing AI conventions via one glob search:
**/{.github/copilot-instructions.md,AGENT.md,AGENTS.md,CLAUDE.md,.cursorrules,.windsurfrules,.clinerules,.cursor/rules/**,.windsurf/rules/**,.clinerules/**,README.md}

Guidelines:

If .github/copilot-instructions.md exists, merge intelligently: preserve useful content, update outdated sections, remove contradictions.

Keep it concise and actionable (~20–50 lines), using clear markdown headings and bullet points.

Use specific examples from this repo (paths, short snippets) when describing patterns.

Document only discoverable, current practices (no aspirations).

Reference key files/directories that exemplify important patterns.

Steps:

Inspect repo structure and key configs (package.json, build/test configs, CI, Docker, env samples).

Infer architecture and data flow by reading cross-referenced files.

Enumerate workflows with exact commands (build/test/debug/run), plus any required env/setup.

Capture conventions: naming, error contracts, testing patterns, component/page/route structure, middleware order.

Capture integrations: where clients live, how env vars/keys are loaded, retry/cache patterns, mock strategies.

Write or update .github/copilot-instructions.md accordingly.

End the file with a short “Unknowns / Gaps” section listing precise questions for the maintainer.

Deliverable:

Updated .github/copilot-instructions.md ready in the repo. After writing, list any unclear or incomplete sections to iterate.