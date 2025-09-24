Modes (copy one line under your prompt)


/mode coding — `temp=0.1, top_p=0.85, max=1200, stop=````

Use for deterministic code generation.
Keeps answers consistent and safe for production.
Best for new features, bugfixes, or boilerplate you don’t want to drift.

/mode refactor — `temp=0.1, top_p=0.85, freq_penalty=0.2, max=1200, stop=````

Use for cleanups or reorganizing existing code.
Frequency penalty reduces repetition in suggestions.
Output should be a minimal diff — safe edits only.

/mode tests — temp=0.2, top_p=0.8, freq_penalty=0.2, max=1200

Use for writing unit/integration tests.
Slightly more freedom for variety but still controlled.
Emphasize semantic queries in RTL, avoid data-testid unless necessary.
No network calls — tests should be deterministic and local.

/mode spec — temp=0.2, top_p=0.85, max=1400, stop=[CONFIRM, ```]

Use for larger or riskier changes.
Produces a PLAN first (step-by-step).
Only after you reply CONFIRM will it output code.
Prevents the agent from running off with assumptions.

/mode summarize — temp=0.3, top_p=0.9, freq_penalty=0.3, max=800

Use for changelogs, PR notes, or concise recaps.
Forces brevity and avoids repetition.
Format: What / Why / Risk / Rollback bullets.

/mode brainstorm — temp=0.85, top_p=0.95, pres_penalty=0.5, max=800

Use for creative ideation.
Encourages multiple distinct options.
Must output 3–5 options, then recommend the best.

/mode json — temp=0.1, top_p=0.8, max=800, stop="}"

Use when you need machine-consumable output.
Emits only valid JSON matching the schema you provide.
Zero prose, zero markdown. Perfect for changelog objects, config, structured data.