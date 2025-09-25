# Copilot Guide (SC2CR)

This file explains how to use GitHub Copilot effectively for **SC2CR** development.  
It combines the quickstart workflow, best practices, modes, and a cheat sheet for fast reference.

---

## 🎯 Purpose
- Keep Copilot outputs scoped, deterministic, and production-ready.  
- Align Copilot with our **harness** and **modes**.  
- Provide both **detailed guidance** and a **quick cheat sheet**.

---

## 🔑 Context Rules
- **Selection matters most** → Copilot prioritizes selected code in the editor. Always select the block you want fixed or tested.
- **@workspace** → pulls in repo-wide context; use only when changes span multiple files.
- **#file / #symbol tags** → pin specific files or functions into the prompt (e.g., `#src/server/logger.ts`).
- **Slash commands** → quickly declare intent (`/fix`, `/tests`, `/explain`).

---

## 🚀 Core Slash Commands

### `/fix`
Use for targeted bugfixes or edits.
```text
/fix
Respect invariants; output a single ```ts block; no prose.
```

### `/tests`
Use for generating unit/integration tests.
```text
/tests
RTL semantic queries preferred; avoid data-testid unless required.
Arrange-act-assert structure. No network calls.
Output a single ```ts block.
```

### `/explain`
Use before large refactors.
```text
/explain
Highlight risks, edge cases, and contracts that must not change.
Keep explanation scoped and concise.
```

---

## 📦 Repo-Wide Tasks

When changes span multiple files (e.g., requestId propagation, logging config):
```text
@workspace #src/server/middleware/requestLogger.ts #src/server/services/logger.ts
PLAN only; await CONFIRM before code.
Respect invariants; output ```ts blocks only.
```

---

## 🎚️ Modes (copy one line under your prompt)

### `/mode coding` — `temp=0.1, top_p=0.85, max=1200, stop=`````
Use for **deterministic code generation**.  
Keeps answers consistent and safe for production.  
Best for **new features, bugfixes, or boilerplate** you don’t want to drift.

### `/mode refactor` — `temp=0.1, top_p=0.85, freq_penalty=0.2, max=1200, stop=`````
Use for **cleanups or reorganizing existing code**.  
Frequency penalty reduces repetition in suggestions.  
Output should be a **minimal change set** (small, safe edits).

### `/mode tests` — `temp=0.2, top_p=0.8, freq_penalty=0.2, max=1200`
Use for **writing unit/integration tests**.  
Slightly more freedom for variety but still controlled.  
Emphasize **semantic queries in RTL**, avoid `data-testid` unless necessary.  
**No network calls** — tests should be deterministic and local.

### `/mode spec` — `temp=0.2, top_p=0.85, max=1400, stop=[CONFIRM, ```]`
Use for **larger or riskier changes**.  
Produces a **PLAN first** (step-by-step).  
Only after you reply `CONFIRM` will it output code.  
Prevents the agent from **running off with assumptions**.

### `/mode summarize` — `temp=0.3, top_p=0.9, freq_penalty=0.3, max=800`
Use for **changelogs, PR notes, or concise recaps**.  
Forces brevity and avoids repetition.  
Format: **What / Why / Risk / Rollback** bullets.

### `/mode brainstorm` — `temp=0.85, top_p=0.95, pres_penalty=0.5, max=800`
Use for **creative ideation**.  
Encourages **multiple distinct options**.  
Must output **3–5 options**, then recommend the best.

### `/mode json` — `temp=0.1, top_p=0.8, max=800, stop="}"`
Use when you need **machine-consumable output**.  
Emits **only valid JSON** matching the schema you provide.  
Zero prose, zero markdown. Perfect for **changelog objects, config, structured data**.

---

## ⚖️ Best Practices
- Always include **invariants**:  
  *“Do not change API contracts, env handling, or logging formats.”*
- Keep **OUTPUT FORMAT** tight: code fences (` ```ts `), no prose.  
  - **Code tasks** → return **full file or precise code blocks** in `ts` fences.  
  - **Docs tasks** → prefer `diff` fences scoped to specific files/sections.  
  - **Plan-first** → PLAN → wait for `CONFIRM` → then code.
- Start fresh (new chat) when switching task types (docs ↔ code ↔ brainstorm).
- If a process is immature, explicitly say:  
  *“Propose best practices; label them as recommendations, not current truth.”*

---

## 🛠️ Quick Examples

**Fix a logger bug**
```text
/fix
TASK: Fix log level not applied from process.env.LOG_LEVEL.
Respect invariants; output a single ```ts block; no prose.
```

**Generate tests**
```text
/tests
TASK: Add unit tests for snapshot refresh at 12:00 AM America/Costa_Rica.
Prefer semantic queries, arrange-act-assert. No network calls.
Output a single ```ts block.
```

**Cross-cutting change**
```text
@workspace #src/server/middleware/requestLogger.ts #src/server/services/logger.ts
/mode spec
TASK: Introduce request-scoped logger bound to requestId across middleware + services.
PLAN only; await CONFIRM before code.
```

---

## 🧰 Harness (concise veteran persona)

Use this wrapper at the top of significant prompts (adjust TASK/CONTEXT/FORMAT as needed).

```text
ROLE:
You are a seasoned software engineer with 20+ years of experience building and maintaining large-scale systems.
You focus on clarity, maintainability, and operational safety.
Explain reasoning briefly when it affects correctness or ops. Keep answers scoped and concise.

INVARIANTS (non-negotiables):
- Preserve API/contract shapes, env handling, logging formats, and error behavior.
- No scope creep; touch only what is requested.
- Prefer clear, maintainable solutions over clever shortcuts.

TASK:
<one sentence, precise>

CONTEXT:
<files/modules; versions; constraints; timezone America/Costa_Rica>

OUTPUT FORMAT:
Return updated **full file(s)** or **targeted code blocks** in ```ts fences (no prose).
(For docs, use ```diff fences scoped to named files/sections.)

SELF-CHECK BEFORE OUTPUT:
1) Exact task only?
2) Invariants preserved?
3) Correct format?
4) Maintainable & test-ready?
```

---

# 📑 Cheat Sheet (Fast Reference)

### Slash Commands
- `/fix` → Propose a fix for selected code.
- `/tests` → Generate unit tests for selection.
- `/explain` → Explain selected code.
- `@workspace` → repo-wide context (use for multi-file tasks).
- `#file` / `#symbol` → pin specific files/functions.

### Modes
- **/mode coding** → deterministic code (safe for prod).
- **/mode refactor** → cleanup with minimal changes.
- **/mode tests** → generate tests, semantic queries only.
- **/mode spec** → PLAN first, await `CONFIRM`, then code.
- **/mode summarize** → docs/PR notes, What/Why/Risk/Rollback.
- **/mode brainstorm** → 3–5 options, then best pick.
- **/mode json** → JSON only, schema enforced.

### Output Formats
- **Code** → single ```ts fenced block (no prose).
- **Docs** → ```diff fenced block, scoped to specific files.
- **Plan-first** → PLAN → wait for `CONFIRM` → then code.
- **JSON** → valid JSON only, schema provided.

---

👉 Save this file as `.github/ai/copilot-guide.md`. Open it side-by-side with Copilot Chat and copy the snippets you need.
