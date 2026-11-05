# The Island — agent guide

A mobile-friendly web app of story-based guided relaxation sessions set in places on a fictional island, structured as a 100-day programme with a new session about weekly. Done-2026 (milestone `done-2026`): the full 100-day curriculum map, phase 1 sessions published, and a before/after calm rating.

## Commands
- Not scaffolded yet. The first issue sets up Astro + a Svelte audio player as a PWA on Cloudflare and fills in `.ops.yml`.

## Rules specific to this repo
- This repo is public: no secrets, no API keys, no personal data.
- Never claim to treat or cure anxiety or any condition. Use "relaxation" and "evidence-informed" wording.
- Scripts must pass the safety rules (to be added in `docs/script-guardrails.md`): invitational language, always allow stopping, no deep water, storms, caves, darkness or cliffs.
- Publishing a session is never automatic: Jordan listens and approves first.

<!-- portfolio-ops:common:start -->
## Development system (managed by portfolio-ops — do not edit this section in app repos)

**Tasks.** Work only on the linked GitHub issue: one issue, one branch (`claude/<issue>` or `codex/<issue>`), one PR. Don't touch files outside the issue's scope. If the issue is larger than about 3 hours of work, stop and comment proposing a split.

**Product questions.** If the issue or its spec doesn't answer a product question (wording, flow, what to show or leave out), don't guess. Open an issue labelled `decision` with 2–3 options and a recommendation, link it from the PR, and finish only the parts that don't depend on it. Read `docs/vision.md` (where it exists) before any user-facing change.

**Never edit**: `.github/**`, `AGENTS.md`, `CLAUDE.md`, `.ops.yml`, `.claude/**`, `docs/vision.md`, `docs/decisions/**`, `specs/**`, unless the issue explicitly asks for it. Never add, remove or change the labels `human-approved`, `review:override` or `review:blocking`, and never resolve review threads: those are the owner's decisions. Never commit secrets, personal data (names, emails, habits, goals, health data) or generated artifacts.

**Before opening the PR**: run the verify command from `.ops.yml` and paste its result in the PR description. For UI changes, attach screenshots at 375px and 1280px wide. Then enable auto-merge: `gh pr merge --auto --squash`. The `review-gate` check decides whether it may merge.

**Decisions.** If you make a decision that isn't visible in the code, add `docs/decisions/NNNN-title.md` in the same PR (date, context, choice, alternatives). Supersede old decisions; never delete them.

## Review guidelines

Report only real problems, ranked:
- **P0**: data loss or corruption, security or privacy issues, secrets or personal data committed, broken build, a failing user journey, a change that weakens or skips tests or CI checks.
- **P1**: new logic without tests, accessibility regressions, the PR contradicts `docs/vision.md` or a decision record without a new decision record, scope creep beyond the linked issue, changes to protected paths the issue didn't ask for.
- Ignore style the linter allows. Don't suggest refactors outside the diff.
<!-- portfolio-ops:common:end -->
